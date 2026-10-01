'use strict';
const { createBase, start, log } = require('../shared/common');

function createApp({ pool }) {
  const app = createBase('estoque', () => pool.query('SELECT 1'));

  app.get('/estoque/:sku', async (req, res) => {
    const { rows } = await pool.query('SELECT sku, quantidade FROM estoque WHERE sku = $1', [req.params.sku]);
    if (!rows.length) return res.status(404).json({ erro: 'sku não encontrado' });
    res.json(rows[0]);
  });

  // Reserva atômica: ou reserva todos os itens, ou nenhum.
  app.post('/reservas', async (req, res) => {
    const itens = req.body && req.body.itens;
    if (!Array.isArray(itens) || !itens.length) return res.status(400).json({ erro: 'itens obrigatórios' });
    const conn = await pool.connect();
    try {
      await conn.query('BEGIN');
      for (const { sku, quantidade } of itens) {
        const r = await conn.query('UPDATE estoque SET quantidade = quantidade - $2 WHERE sku = $1 AND quantidade >= $2', [sku, quantidade]);
        if (r.rowCount !== 1) {
          await conn.query('ROLLBACK');
          log('warn', 'estoque insuficiente', { sku });
          return res.status(409).json({ erro: 'estoque insuficiente', sku });
        }
      }
      await conn.query('COMMIT');
      res.status(201).json({ status: 'reservado' });
    } catch (e) {
      await conn.query('ROLLBACK').catch(() => {});
      log('error', 'falha na reserva', { erro: e.message });
      res.status(500).json({ erro: 'erro interno' });
    } finally {
      conn.release();
    }
  });

  // Compensação (saga): devolve itens quando o pagamento é recusado.
  app.post('/liberacoes', async (req, res) => {
    const itens = (req.body && req.body.itens) || [];
    for (const { sku, quantidade } of itens) {
      await pool.query('UPDATE estoque SET quantidade = quantidade + $2 WHERE sku = $1', [sku, quantidade]);
    }
    res.json({ status: 'liberado' });
  });
  return app;
}

module.exports = { createApp };
if (require.main === module) {
  const { createPool } = require('../shared/db');
  start(createApp({ pool: createPool() }), process.env.PORT || 3003);
}
