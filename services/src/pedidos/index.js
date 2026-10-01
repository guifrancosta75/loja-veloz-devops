'use strict';
const { createBase, start, log } = require('../shared/common');

function createApp({ pool, estoqueUrl = process.env.ESTOQUE_URL, pagamentosUrl = process.env.PAGAMENTOS_URL, fetchFn = fetch }) {
  const app = createBase('pedidos', () => pool.query('SELECT 1'));
  const post = (url, body) =>
    fetchFn(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000) });

  app.post('/pedidos', async (req, res) => {
    const { cliente, itens } = req.body || {};
    if (!cliente || !Array.isArray(itens) || !itens.length) return res.status(400).json({ erro: 'cliente e itens são obrigatórios' });
    const total = itens.reduce((s, i) => s + i.quantidade * i.preco, 0);
    try {
      const r1 = await post(`${estoqueUrl}/reservas`, { itens });
      if (r1.status === 409) return res.status(409).json({ erro: 'estoque insuficiente' });
      if (!r1.ok) return res.status(502).json({ erro: 'falha no serviço de estoque' });

      const r2 = await post(`${pagamentosUrl}/pagamentos`, { valor: total, metodo: 'cartao' });
      let status = 'confirmado';
      if (!r2.ok) {
        status = 'pagamento_recusado';
        await post(`${estoqueUrl}/liberacoes`, { itens }).catch(() => {}); // compensação
      }
      const { rows } = await pool.query(
        'INSERT INTO pedidos (cliente, itens, total, status) VALUES ($1, $2, $3, $4) RETURNING id, cliente, total, status, criado_em',
        [cliente, JSON.stringify(itens), total, status]
      );
      // Evento de domínio (hoje registrado em log; ponto de evolução para mensageria).
      log('info', 'PedidoCriado', { evento: 'PedidoCriado', pedidoId: rows[0].id, status });
      res.status(status === 'confirmado' ? 201 : 402).json(rows[0]);
    } catch (e) {
      log('error', 'falha ao criar pedido', { erro: e.message });
      res.status(503).json({ erro: 'dependência indisponível' });
    }
  });

  app.get('/pedidos/:id', async (req, res) => {
    const { rows } = await pool.query('SELECT id, cliente, itens, total, status, criado_em FROM pedidos WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ erro: 'pedido não encontrado' });
    res.json(rows[0]);
  });
  return app;
}

module.exports = { createApp };
if (require.main === module) {
  const { createPool } = require('../shared/db');
  start(createApp({ pool: createPool() }), process.env.PORT || 3001);
}
