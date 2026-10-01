'use strict';
const crypto = require('node:crypto');
const { createBase, start, log } = require('../shared/common');

// Simula a integração externa (adquirente). Em produção, chamaria a API do provedor
// usando PAYMENT_PROVIDER_API_KEY (vinda de Secret) - a chave nunca é logada.
function createApp({ failPercent = Number(process.env.PAGAMENTO_FALHA_PERCENT || 0), latencyMs = Number(process.env.PAGAMENTO_LATENCIA_MS || 50) } = {}) {
  const app = createBase('pagamentos');

  app.post('/pagamentos', async (req, res) => {
    const { valor, metodo } = req.body || {};
    if (!(valor > 0)) return res.status(400).json({ erro: 'valor inválido' });
    await new Promise((r) => setTimeout(r, latencyMs));
    if (Math.random() * 100 < failPercent) {
      log('warn', 'pagamento recusado', { metodo });
      return res.status(402).json({ status: 'recusado' });
    }
    res.status(201).json({ status: 'aprovado', transacaoId: crypto.randomUUID(), valor, metodo: metodo || 'cartao' });
  });
  return app;
}

module.exports = { createApp };
if (require.main === module) start(createApp(), process.env.PORT || 3002);
