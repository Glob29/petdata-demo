#!/usr/bin/env node
'use strict';

/*
 * Достраивает package по всем доступным фасовкам, которые перечислены на странице.
 *
 * Зачем: карточка товара часто продаётся в нескольких весовках
 * («ДОСТУПНЫЕ ВЕСОВКИ 300g, 3kg, 7kg»), а сборщик раньше сохранял только первую —
 * обычно самую мелкую. В таблице это выглядело как ошибка разрядности: 300 г вместо линейки до 7 кг.
 *
 * Работает по локальному кэшу страниц (agent/cache), сайты не обходит.
 * Запуск: node db/backfill-weights.js [--dry-run]
 * Идемпотентен: повторный запуск не создаёт дублей.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { extractAvailableWeights } = require('../agent/lib/extract');

const root = path.join(__dirname, '..');
const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
const cacheDir = path.join(root, 'agent', 'cache');
const dryRun = process.argv.includes('--dry-run');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

const rows = db
  .prepare(
    `SELECT p.id, p.name, p.form, p.source_id,
            psp.url, psp.source_id AS page_source_id,
            (SELECT COUNT(*) FROM package pk WHERE pk.product_id = p.id) AS package_count
       FROM product p
       JOIN product_source_page psp ON psp.product_id = p.id
      ORDER BY p.id`
  )
  .all();

const stats = {
  products: rows.length,
  pages_found: 0,
  pages_with_block: 0,
  products_changed: 0,
  packages_added: 0,
  skipped_no_page: 0
};
const changes = [];

db.exec('BEGIN');
try {
  for (const row of rows) {
    const file = path.join(cacheDir, crypto.createHash('sha1').update(row.url).digest('hex') + '.html');
    if (!fs.existsSync(file)) {
      stats.skipped_no_page += 1;
      continue;
    }
    stats.pages_found += 1;

    const weights = extractAvailableWeights(fs.readFileSync(file, 'utf8'));
    if (!weights.length) continue;
    stats.pages_with_block += 1;

    const existing = new Set(
      db.prepare('SELECT weight_g FROM package WHERE product_id = ?').all(row.id).map((item) => item.weight_g)
    );
    const missing = weights.filter((weight) => !existing.has(weight));
    if (!missing.length) continue;

    const sourceId = row.page_source_id || row.source_id;
    for (const weight of missing) {
      if (!dryRun) {
        db.prepare(
          'INSERT INTO package (product_id, weight_g, pack_count, gtin, currency, region, source_id) VALUES (?, ?, 1, NULL, ?, ?, ?)'
        ).run(row.id, weight, 'RUB', 'RU', sourceId);
      }
      stats.packages_added += 1;
    }
    stats.products_changed += 1;
    changes.push({ id: row.id, name: row.name.slice(0, 55), added: missing, all: weights });
  }

  if (dryRun) {
    db.exec('ROLLBACK');
  } else {
    db.exec('COMMIT');
  }
} catch (error) {
  db.exec('ROLLBACK');
  db.close();
  console.error('Откатано:', error.message);
  process.exit(1);
}

db.close();

console.log(`DB: ${dbPath}${dryRun ? ' (dry-run, без записи)' : ''}`);
console.log(JSON.stringify(stats, null, 2));
if (changes.length) {
  console.log('\nИзменённые SKU:');
  for (const change of changes) {
    console.log(`  #${String(change.id).padEnd(4)} +${change.added.join(', ')} г  (всего: ${change.all.join(', ')})  ${change.name}`);
  }
}
