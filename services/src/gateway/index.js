'use strict';
const { createBase, start } = require('../shared/common');

// API Gateway mínimo: expõe /api/pedidos e encaminha ao serviço de pedidos.
function createApp({ pedidosUrl = process.env.PEDIDOS_URL, fetchFn = fetch } = {}) {
  const app = createBase('gateway');
  const forward = async (req, res, path) => {
    try {
      const r = await fetchFn(`${pedidosUrl}${path}`, {
        method: req.method,
        headers: { 'content-type': 'application/json' },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
        signal: AbortSignal.timeout(5000),
      });
      res.status(r.status).type('application/json').send(await r.text());
    } catch {
      res.status(504).json({ erro: 'serviço de pedidos indisponível' });
    }
  };
  app.post('/api/pedidos', (req, res) => forward(req, res, '/pedidos'));
  app.get('/api/pedidos/:id', (req, res) => forward(req, res, `/pedidos/${encodeURIComponent(req.params.id)}`));
  return app;
}

module.exports = { createApp };
if (require.main === module) start(createApp(), process.env.PORT || 8080);
