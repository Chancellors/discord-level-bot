const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.db);

let hasConnected = false;

async function query(text, params) {
  if (!hasConnected) {
    hasConnected = true;
    console.log(`[DB] PostgreSQL havuzuna baglanildi: ${config.db.host}:${config.db.port}/${config.db.database}`);
  }
  return pool.query(text, params);
}

module.exports = { pool, query };
