#!/usr/bin/env bash
# Teste de fumaça ponta a ponta contra o gateway (local: http://localhost:8080).
set -euo pipefail
BASE="${1:-http://localhost:8080}"
echo ">> Criando pedido..."
RESP=$(curl -sf -X POST "$BASE/api/pedidos" -H 'content-type: application/json' \
  -d '{"cliente":"maria","itens":[{"sku":"CAMISA-001","quantidade":2,"preco":59.9}]}')
echo "$RESP"
ID=$(echo "$RESP" | sed -E 's/.*"id":"?([0-9]+)"?.*/\1/')
echo ">> Consultando pedido $ID..."
curl -sf "$BASE/api/pedidos/$ID"; echo
echo ">> OK. Traces: http://localhost:16686  |  Métricas: http://localhost:9090"
