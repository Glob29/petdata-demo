#!/usr/bin/env node
'use strict';

/*
 * Готовит базу к переносу на VPS: схлопывает WAL и кладёт копию в ./data.
 * Запуск: node scripts/export-db.js
 *
 * После этого файл data/petdata.db загружается на сервер (scp) и монтируется
 * в контейнер как /data/petdata.db. В git он не попадает (см. .gitignore).
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.join(__dirname, '..');
const source = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
const targetDir = path.join(root, 'data');
const target = path.join(targetDir, 'petdata.db');

if (!fs.existsSync(source)) {
  console.error(`Нет базы: ${source}`);
  process.exit(1);
}

// Важно: без checkpoint изменения из WAL не попадут в копию.
const db = new DatabaseSync(source);
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
const counts = {
  products: db.prepare('SELECT COUNT(*) AS n FROM product').get().n,
  packages: db.prepare('SELECT COUNT(*) AS n FROM package').get().n,
  prices: db.prepare('SELECT COUNT(*) AS n FROM price_snapshot').get().n,
  breeds: db.prepare('SELECT COUNT(*) AS n FROM breed').get().n
};
db.close();

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);

// WAL/SHM рядом с копией не нужны
for (const suffix of ['-wal', '-shm']) {
  const extra = target + suffix;
  if (fs.existsSync(extra)) fs.rmSync(extra);
}

const sizeMb = (fs.statSync(target).size / 1024 / 1024).toFixed(1);
console.log(`копия: ${target} (${sizeMb} МБ)`);
console.log(JSON.stringify(counts, null, 2));
