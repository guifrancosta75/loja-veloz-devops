// Tracing distribuído com OpenTelemetry. Carregado com `node -r ./src/shared/tracing.js`.
// Só é ativado se OTEL_EXPORTER_OTLP_ENDPOINT estiver definido (12-factor: config por ambiente).
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
  const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
  const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg');
  const { UndiciInstrumentation } = require('@opentelemetry/instrumentation-undici');

  const sdk = new NodeSDK({
    // endpoint e nome do serviço vêm de OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_SERVICE_NAME
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => /^\/(healthz|readyz|metrics)/.test(req.url) }),
      new ExpressInstrumentation(),
      new PgInstrumentation(),
      new UndiciInstrumentation(), // propaga o contexto (traceparent) nas chamadas fetch entre serviços
    ],
  });
  sdk.start();
  process.on('SIGTERM', () => sdk.shutdown().catch(() => {}));
}
