.PHONY: up down test smoke logs k8s-local
up:      ; test -f .env || cp .env.example .env; docker compose up --build -d
down:    ; docker compose down -v
logs:    ; docker compose logs -f --tail=50
test:    ; cd services && npm ci && npm run lint && npm test
smoke:   ; ./scripts/smoke.sh
