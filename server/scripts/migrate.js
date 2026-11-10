#!/usr/bin/env node
// Applies pending SQL migrations from server/migrations in name order.
// Applied ones are recorded in the `schema_migrations` table.
//
//   node server/scripts/migrate.js            # apply pending
//   node server/scripts/migrate.js --dry-run  # only list pending
//
// DB settings come from DB_* env vars (server/.env is loaded if present).

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    const [rows] = await conn.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    const pending = files.filter((f) => !applied.has(f));

    console.log(`DB ${process.env.DB_NAME}@${process.env.DB_HOST}: ${applied.size} applied, ${pending.length} pending`);
    for (const file of pending) {
      if (dryRun) {
        console.log(`  pending: ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`  applying ${file} ... `);
      await conn.query(sql); // DDL in MySQL autocommits, so no transaction here
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      console.log('ok');
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.code || '', err.message);
  process.exit(1);
});
