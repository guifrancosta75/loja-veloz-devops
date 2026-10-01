'use strict';
const express = require('express');
const client = require('prom-client');
const { trace } = require('@opentelemetry/api');

// Logs como stream de eventos em stdout, em JSON, com trace_id para correlação (12-factor XI).
function log(level, msg, extra = {}) {
  const span = trace.getActiveSpan();
  const trace_id = span ? span.spanContext().traceId : undefined;
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level, service: process.env.SERVICE, msg, trace_id, ...extra }) + '\n');
}

// Cria app Express com /healthz (liveness), /readyz (readiness) e /metrics (Prometheus).
function createBase(service, readyCheck = async () => true) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  const register = new client.Registry();
  register.setDefaultLabels({ service });
  client.collectDefaultMetrics({ register });
  const duration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Latência das requisições HTTP',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register],
  });

  app.use((req, res, next) => {
    const end = duration.startTimer();
    const t0 = Date.now();
    res.on('finish', () => {
      const route = req.route ? req.route.path : 'outros';
      end({ method: req.method, route, status: res.statusCode });
      if (!/^\/(healthz|readyz|metrics)/.test(req.path)) {
        log('info', 'request', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - t0 });
      }
    });
    next();
  });

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.get('/readyz', async (_req, res) => {
    try {
      await readyCheck();
      res.json({ status: 'ready' });
    } catch (e) {
      res.status(503).json({ status: 'not-ready', error: e.message });
    }
  });
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  });
  return app;
}

// Sobe o servidor e trata SIGTERM com encerramento gracioso (12-factor IX: disposability).
function start(app, port) {
  const server = app.listen(port, () => log('info', 'servico iniciado', { port }));
  process.on('SIGTERM', () => {
    log('info', 'SIGTERM recebido, encerrando');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
  return server;
}

module.exports = { createBase, start, log };
