#!/usr/bin/env node
'use strict';

/*
 * Собирает демо-базу SQLite из schema.sqlite.sql + seed.sql.
 * Запуск: node db/import.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.join(__dirname, '..');
const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
const schemaPath = path.join(__dirname, 'schema.sqlite.sql');
const seedPath = path.join(__dirname, 'seed.sql');
const breedsSeedPath = path.join(__dirname, 'seed-breeds.sql');

if (fs.existsSync(dbPath)) fs.rmSync(dbPath);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(schemaPath, 'utf8'));
db.exec(fs.readFileSync(seedPath, 'utf8'));
// seed-breeds.sql генерируется из db/breeds-data.json: 24 породы, веса, риски, гентесты.
if (fs.existsSync(breedsSeedPath)) db.exec(fs.readFileSync(breedsSeedPath, 'utf8'));

// Поисковый индекс для уже загруженных SKU.
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

const counts = {
  products: db.prepare('SELECT COUNT(*) AS n FROM product').get().n,
  breeds: db.prepare('SELECT COUNT(*) AS n FROM breed').get().n,
  nutrients: db.prepare('SELECT COUNT(*) AS n FROM nutrient').get().n,
  product_nutrients: db.prepare('SELECT COUNT(*) AS n FROM product_nutrient').get().n,
  predispositions: db.prepare('SELECT COUNT(*) AS n FROM breed_predisposition').get().n
};

// Средняя цена упаковки и ₽/г из снимков цен — сразу, чтобы чистая сборка была консистентной.
const { computePrices } = require('./compute-prices');
const priceStats = computePrices(db);

db.close();

console.log(`DB: ${dbPath}`);
console.log(JSON.stringify({ ...counts, packages_with_price: priceStats.with_price }, null, 2));
