-- Esquema inicial e dados de exemplo (executado na primeira subida do PostgreSQL).
CREATE TABLE IF NOT EXISTS estoque (
  sku        TEXT PRIMARY KEY,
  quantidade INTEGER NOT NULL CHECK (quantidade >= 0)
);
CREATE TABLE IF NOT EXISTS pedidos (
  id        BIGSERIAL PRIMARY KEY,
  cliente   TEXT NOT NULL,
  itens     JSONB NOT NULL,
  total     NUMERIC(12,2) NOT NULL,
  status    TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO estoque (sku, quantidade) VALUES
  ('CAMISA-001', 100), ('TENIS-042', 50), ('MOCHILA-007', 25)
ON CONFLICT (sku) DO NOTHING;
