'use strict';

/*
 * Нормализация товарной модели:
 * - чистит названия от веса;
 * - заполняет name_key;
 * - сливает дубли (400 г / 2 кг одного продукта);
 * - ведёт product_source_page;
 * - перестраивает FTS.
 *
 * Запуск: node db/normalize.js
 */

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { cleanProductName, nameKey } = require('./name-utils');

const dbPath = process.env.PETDATA_DB || path.join(__dirname, 'petdata.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function addColumn(table, column, definition) {
  if (!columnExists(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumn('product', 'name_key', 'TEXT');
addColumn('package', 'gtin', 'TEXT');
addColumn('certificate', 'scope', "TEXT NOT NULL DEFAULT 'brand'");
addColumn('extraction_run', 'product_id', 'INTEGER REFERENCES product(id)');
db.exec(`
  CREATE TABLE IF NOT EXISTS product_source_page (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    source_id INTEGER REFERENCES source(id),
    url TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'parsed',
    UNIQUE (product_id, url)
  );
  CREATE TABLE IF NOT EXISTS review_queue (
    id INTEGER PRIMARY KEY,
    product_id INTEGER REFERENCES product(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  );
`);

// Убираем уникальный индекс на время слияния брендов/товаров.
db.exec('DROP INDEX IF EXISTS uq_product_name_key');

// Приводим алиасы брендов к каноническим названиям.
db.exec(`
  UPDATE brand SET name = 'Purina Pro Plan'
   WHERE lower(trim(replace(name, '®', ''))) = 'pro plan';
  UPDATE brand SET name = 'Purina Pro Plan Veterinary Diets'
   WHERE lower(trim(replace(name, '®', ''))) = 'pro plan veterinary diets';
`);

const brandGroups = db.prepare(`
  SELECT lower(trim(name)) AS key, GROUP_CONCAT(id) AS ids, COUNT(*) AS n
    FROM brand GROUP BY key HAVING n > 1
`).all();

for (const group of brandGroups) {
  const ids = group.ids.split(',').map(Number).sort((a, b) => a - b);
  const keep = ids.shift();
  for (const duplicate of ids) {
    db.prepare('UPDATE product SET brand_id = ? WHERE brand_id = ?').run(keep, duplicate);
    db.prepare('UPDATE certificate SET brand_id = ? WHERE brand_id = ?').run(keep, duplicate);
    db.prepare('DELETE FROM brand WHERE id = ?').run(duplicate);
  }
}

const products = db.prepare('SELECT id, brand_id, name, species, form, market, source_id, source_url, updated_at FROM product').all();

for (const product of products) {
  const cleaned = cleanProductName(product.name) || product.name;
  const key = nameKey(cleaned);
  db.prepare('UPDATE product SET name = ?, name_key = ? WHERE id = ?').run(cleaned, key, product.id);

  if (product.source_url) {
    db.prepare(
      `INSERT OR IGNORE INTO product_source_page (product_id, source_id, url, fetched_at, status)
       VALUES (?, ?, ?, ?, 'validated')`
    ).run(product.id, product.source_id, product.source_url, product.updated_at || new Date().toISOString().slice(0, 10));
  }
}

// Слияние дублей по name_key.
const groups = db.prepare(`
  SELECT brand_id, name_key, species, form, market, GROUP_CONCAT(id) AS ids, COUNT(*) AS n
    FROM product
   WHERE name_key IS NOT NULL AND name_key <> ''
   GROUP BY brand_id, name_key, species, form, market
  HAVING n > 1
`).all();

for (const group of groups) {
  const ids = group.ids.split(',').map(Number).sort((a, b) => a - b);
  const keep = ids.shift();

  for (const duplicate of ids) {
    for (const table of ['package', 'product_ingredient', 'product_protein_source', 'claim', 'feeding_guide', 'price_snapshot', 'certificate']) {
      if (columnExists(table, 'product_id')) {
        db.prepare(`UPDATE OR IGNORE ${table} SET product_id = ? WHERE product_id = ?`).run(keep, duplicate);
      }
    }
    db.prepare('UPDATE OR IGNORE product_nutrient SET product_id = ? WHERE product_id = ?').run(keep, duplicate);
    db.prepare('UPDATE OR IGNORE extraction_run SET product_id = ? WHERE product_id = ?').run(keep, duplicate);
    db.prepare('DELETE FROM product WHERE id = ?').run(duplicate);
  }
}

// Уникальность товара по очищенному имени.
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS uq_product_name_key
    ON product (brand_id, name_key, species, form, market)
    WHERE name_key IS NOT NULL
`);

// Пересборка FTS.
db.exec('DELETE FROM product_fts');
db.exec(`
  INSERT INTO product_fts (product_id, name, brand, composition)
  SELECT p.id, p.name, b.name,
         COALESCE((
           SELECT GROUP_CONCAT(i.name_ru, ' ')
             FROM product_ingredient pi
             JOIN ingredient i ON i.id = pi.ingredient_id
            WHERE pi.product_id = p.id
         ), '')
    FROM product p
    JOIN brand b ON b.id = p.brand_id
`);

const stats = {
  products: db.prepare('SELECT COUNT(*) AS n FROM product').get().n,
  merged_groups: groups.length,
  source_pages: db.prepare('SELECT COUNT(*) AS n FROM product_source_page').get().n,
  fts: db.prepare('SELECT COUNT(*) AS n FROM product_fts').get().n
};

db.close();
console.log(JSON.stringify(stats, null, 2));
