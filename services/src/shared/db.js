'use strict';
const { Pool } = require('pg');
// DATABASE_URL vem de Secret (K8s) ou .env (Compose): nunca fica no código.
function createPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 3000 });
}
module.exports = { createPool };
