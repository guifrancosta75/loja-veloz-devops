'use strict';
const test = require('node:test');
const assert = require('node:assert');

// Sobe o app em porta efêmera e devolve helper de requisição.
async function serve(app) {
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}
const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('todos os serviços expõem /healthz e /metrics', async () => {
  const apps = [
    require('../src/gateway').createApp({ pedidosUrl: 'http://x' }),
    require('../src/pagamentos').createApp(),
    require('../src/pedidos').createApp({ pool: { query: async () => ({ rows: [] }) } }),
    require('../src/estoque').createApp({ pool: { query: async () => ({ rows: [] }) } }),
  ];
  for (const app of apps) {
    const s = await serve(app);
    assert.strictEqual((await fetch(`${s.base}/healthz`)).status, 200);
    const m = await fetch(`${s.base}/metrics`);
    assert.strictEqual(m.status, 200);
    assert.match(await m.text(), /http_request_duration_seconds/);
    await s.close();
  }
});

test('/readyz retorna 503 quando o banco está fora e 200 quando está ok', async () => {
  const down = await serve(require('../src/pedidos').createApp({ pool: { query: async () => { throw new Error('db down'); } } }));
  assert.strictEqual((await fetch(`${down.base}/readyz`)).status, 503);
  await down.close();
  const up = await serve(require('../src/pedidos').createApp({ pool: { query: async () => ({ rows: [] }) } }));
  assert.strictEqual((await fetch(`${up.base}/readyz`)).status, 200);
  await up.close();
});

test('pagamentos aprova valor válido e rejeita inválido', async () => {
  const s = await serve(require('../src/pagamentos').createApp({ latencyMs: 0 }));
  const ok = await fetch(`${s.base}/pagamentos`, json('POST', { valor: 10 }));
  assert.strictEqual(ok.status, 201);
  assert.strictEqual((await ok.json()).status, 'aprovado');
  assert.strictEqual((await fetch(`${s.base}/pagamentos`, json('POST', { valor: -1 }))).status, 400);
  await s.close();
});

test('estoque reserva com sucesso e responde 409 quando insuficiente', async () => {
  const mk = (rowCount) => ({
    query: async () => ({ rows: [] }),
    connect: async () => ({ query: async (sql) => ({ rowCount: /UPDATE/.test(sql) ? rowCount : 0 }), release() {} }),
  });
  let s = await serve(require('../src/estoque').createApp({ pool: mk(1) }));
  assert.strictEqual((await fetch(`${s.base}/reservas`, json('POST', { itens: [{ sku: 'A', quantidade: 1 }] }))).status, 201);
  await s.close();
  s = await serve(require('../src/estoque').createApp({ pool: mk(0) }));
  assert.strictEqual((await fetch(`${s.base}/reservas`, json('POST', { itens: [{ sku: 'A', quantidade: 999 }] }))).status, 409);
  await s.close();
});

test('pedidos: fluxo feliz confirma; pagamento recusado aciona compensação', async () => {
  const calls = [];
  const pool = { query: async (_sql, p) => ({ rows: [{ id: 1, cliente: p[0], total: p[2], status: p[3] }] }) };
  const mkFetch = (pagStatus) => async (url) => {
    calls.push(url);
    if (url.endsWith('/pagamentos')) return { ok: pagStatus < 400, status: pagStatus };
    return { ok: true, status: 201 };
  };
  const body = { cliente: 'ana', itens: [{ sku: 'A', quantidade: 2, preco: 10 }] };

  let s = await serve(require('../src/pedidos').createApp({ pool, estoqueUrl: 'http://e', pagamentosUrl: 'http://p', fetchFn: mkFetch(201) }));
  let r = await fetch(`${s.base}/pedidos`, json('POST', body));
  assert.strictEqual(r.status, 201);
  assert.strictEqual((await r.json()).status, 'confirmado');
  assert.ok(!calls.some((u) => u.endsWith('/liberacoes')));
  await s.close();

  calls.length = 0;
  s = await serve(require('../src/pedidos').createApp({ pool, estoqueUrl: 'http://e', pagamentosUrl: 'http://p', fetchFn: mkFetch(402) }));
  r = await fetch(`${s.base}/pedidos`, json('POST', body));
  assert.strictEqual(r.status, 402);
  assert.ok(calls.some((u) => u.endsWith('/liberacoes')), 'deve liberar o estoque reservado');
  await s.close();
});

test('gateway encaminha e devolve 504 se pedidos estiver fora', async () => {
  let s = await serve(require('../src/gateway').createApp({ pedidosUrl: 'http://p', fetchFn: async () => ({ status: 201, text: async () => '{"id":1}' }) }));
  const r = await fetch(`${s.base}/api/pedidos`, json('POST', { a: 1 }));
  assert.strictEqual(r.status, 201);
  await s.close();
  s = await serve(require('../src/gateway').createApp({ pedidosUrl: 'http://p', fetchFn: async () => { throw new Error('x'); } }));
  assert.strictEqual((await fetch(`${s.base}/api/pedidos/1`)).status, 504);
  await s.close();
});
