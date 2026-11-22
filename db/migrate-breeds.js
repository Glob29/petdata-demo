#!/usr/bin/env node
'use strict';

/*
 * Применяет db/seed-breeds.sql к уже собранной базе, не пересоздавая её.
 * Нужен, чтобы добавить породы, не потеряв SKU, собранные агентом.
 *
 * Запуск: node db/migrate-breeds.js
 * Идемпотентен: повторный запуск ничего не дублирует.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.join(__dirname, '..');
const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
const breedsSeedPath = path.join(__dirname, 'seed-breeds.sql');

if (!fs.existsSync(dbPath)) {
  console.error(`Нет базы: ${dbPath}. Соберите её через node db/import.js.`);
  process.exit(1);
}
if (!fs.existsSync(breedsSeedPath)) {
  console.error('Нет db/seed-breeds.sql. Сгенерируйте: node db/gen-breeds-sql.js');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

const snapshot = () => ({
  breeds: db.prepare('SELECT COUNT(*) AS n FROM breed').get().n,
  conditions: db.prepare('SELECT COUNT(*) AS n FROM condition').get().n,
  predispositions: db.prepare('SELECT COUNT(*) AS n FROM breed_predisposition').get().n,
  genetic_tests: db.prepare('SELECT COUNT(*) AS n FROM genetic_test').get().n,
  products: db.prepare('SELECT COUNT(*) AS n FROM product').get().n
});

const before = snapshot();

db.exec('BEGIN');
try {
  db.exec(fs.readFileSync(breedsSeedPath, 'utf8'));
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  db.close();
  console.error('Миграция откатана:', error.message);
  process.exit(1);
}

const after = snapshot();
db.close();

console.log(`DB: ${dbPath}`);
for (const key of Object.keys(before)) {
  const delta = after[key] - before[key];
  console.log(`${key.padEnd(16)} ${String(before[key]).padStart(5)} → ${String(after[key]).padStart(5)}  (${delta >= 0 ? '+' : ''}${delta})`);
}
