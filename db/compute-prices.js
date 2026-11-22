#!/usr/bin/env node
'use strict';

/*
 * Считает цену упаковки и цену за грамм и сохраняет их в package.
 *
 * Зачем: клиенту нужна не «средняя цена упаковки», а ₽/г — чтобы сравнивать фасовки
 * и планировать бюджет кормления. Чем больше упаковка, тем ниже цена за грамм,
 * и это должно быть видно в данных, а не считаться в голове.
 *
 * Формулы:
 *   total_weight_g = weight_g * pack_count     (85 г × 10 = 850 г)
 *   price_avg      = AVG(price_snapshot.price) по этой упаковке
 *   price_per_g    = price_avg / total_weight_g
 *
 * Запуск: node db/compute-prices.js
 * Идемпотентен: значения пересчитываются из price_snapshot, руками не правятся.
 * При первом запуске на старой базе сам добавляет недостающие колонки.
 */

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const COLUMNS = [
  ['total_weight_g', 'REAL'],
  ['price_avg', 'REAL'],
  ['price_per_g', 'REAL'],
  ['price_samples', 'INTEGER NOT NULL DEFAULT 0'],
  ['price_updated_at', 'TEXT']
];

function ensureColumns(db) {
  const existing = new Set(db.prepare('PRAGMA table_info(package)').all().map((row) => row.name));
  const added = [];
  for (const [name, type] of COLUMNS) {
    if (existing.has(name)) continue;
    db.exec(`ALTER TABLE package ADD COLUMN ${name} ${type}`);
    added.push(name);
  }
  return added;
}

function computePrices(db) {
  const addedColumns = ensureColumns(db);

  // Вес всей упаковки: мультипак 10×85 г → 850 г.
  db.exec('UPDATE package SET total_weight_g = weight_g * COALESCE(pack_count, 1)');

  // Сначала сбрасываем: если наблюдений не осталось, старое значение не должно «залипать».
  db.exec('UPDATE package SET price_per_g = NULL, price_avg = NULL');

  // Средняя цена и число наблюдений по каждой упаковке.
  db.exec(`
    UPDATE package SET
      price_avg = (SELECT ROUND(AVG(ps.price), 2) FROM price_snapshot ps WHERE ps.package_id = package.id),
      price_samples = (SELECT COUNT(*) FROM price_snapshot ps WHERE ps.package_id = package.id),
      price_updated_at = datetime('now')
  `);

  // Цена за грамм. Округляем до 4 знаков: у мелких фасовок значения порядка 0,4–1,5 ₽/г.
  db.exec(`
    UPDATE package
       SET price_per_g = ROUND(price_avg / total_weight_g, 4)
     WHERE price_avg IS NOT NULL
       AND total_weight_g > 0
  `);

  // Версия датасета: появились средние цены упаковок и ₽/г.
  db.exec(`
    INSERT INTO dataset_version (version, released_at, notes)
    SELECT '2026.11-demo-3', date('now'), 'Цены по фасовкам: средняя цена упаковки и цена за грамм'
     WHERE NOT EXISTS (SELECT 1 FROM dataset_version WHERE version = '2026.11-demo-3')
  `);

  return {
    columns_added: addedColumns,
    packages: db.prepare('SELECT COUNT(*) AS n FROM package').get().n,
    with_price: db.prepare('SELECT COUNT(*) AS n FROM package WHERE price_per_g IS NOT NULL').get().n,
    multipacks: db.prepare('SELECT COUNT(*) AS n FROM package WHERE pack_count > 1').get().n
  };
}

function report(db) {
  const rows = db
    .prepare(
      `SELECT p.id AS product_id, p.name, b.name AS brand,
              pk.weight_g, pk.pack_count, pk.total_weight_g, pk.price_avg, pk.price_per_g, pk.price_samples
         FROM package pk
         JOIN product p ON p.id = pk.product_id
         JOIN brand b ON b.id = p.brand_id
        WHERE pk.price_per_g IS NOT NULL
        ORDER BY pk.price_per_g`
    )
    .all();
  return rows;
}

function main() {
  const root = path.join(__dirname, '..');
  const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec('BEGIN');
  let stats;
  try {
    stats = computePrices(db);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    console.error('Откатано:', error.message);
    process.exit(1);
  }

  const rows = report(db);
  db.close();

  console.log(`DB: ${dbPath}`);
  console.log(JSON.stringify(stats, null, 2));

  if (!rows.length) {
    console.log('\nНет упаковок с ценами — считать нечего.');
    return;
  }

  const cheapest = rows.slice(0, 5);
  const priciest = rows.slice(-5).reverse();
  const format = (row) =>
    `  ${row.price_per_g.toFixed(4)} ₽/г  ${String(row.total_weight_g).padStart(6)} г  ` +
    `${String(row.price_avg).padStart(8)} ₽  (${row.price_samples} набл.)  ${row.brand}: ${row.name.slice(0, 45)}`;

  console.log('\nДешевле всего за грамм:');
  for (const row of cheapest) console.log(format(row));
  console.log('\nДороже всего за грамм:');
  for (const row of priciest) console.log(format(row));
}

if (require.main === module) main();

module.exports = { computePrices, ensureColumns };
