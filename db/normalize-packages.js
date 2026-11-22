#!/usr/bin/env node
'use strict';

/*
 * Нормализует таблицу package перед расчётом цены за грамм.
 *
 * Что делает:
 * 1. Мультипаки: в названии «10х85 гр», вес записан как 85 г при pack_count = 1.
 *    Ставит pack_count = 10, вес оставляет за единицу — иначе цена за грамм завышается в 10 раз.
 * 2. Дубли package: повторный обход сайта создавал вторую строку с тем же (product, weight, pack_count).
 *    Оставляет одну (минимальный id), перепривязывает к ней цены, лишние удаляет.
 * 3. Дубли цен: одинаковая цена с того же URL и в ту же дату — артефакт повторного сбора.
 *
 * Запуск: node db/normalize-packages.js [--dry-run]
 * Идемпотентен: повторный запуск ничего не меняет.
 */

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.join(__dirname, '..');
const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
const dryRun = process.argv.includes('--dry-run');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

const stats = { multipacks_fixed: 0, packages_merged: 0, prices_reassigned: 0, price_rows_removed: 0 };
const details = [];

db.exec('BEGIN');
try {
  // --- 1. Мультипаки -------------------------------------------------------
  const multipackRe = /(\d+)\s*[xх×]\s*(\d+(?:[.,]\d+)?)\s*гр/i;
  const products = db.prepare('SELECT id, name FROM product').all();
  for (const product of products) {
    const match = product.name.match(multipackRe);
    if (!match) continue;

    const count = Number(match[1]);
    const unitGrams = Math.round(Number(String(match[2]).replace(',', '.')));
    if (!count || !unitGrams) continue;

    const packages = db.prepare('SELECT id, weight_g, pack_count FROM package WHERE product_id = ?').all(product.id);
    for (const pkg of packages) {
      if (pkg.pack_count === count && pkg.weight_g === unitGrams) continue;
      // Мультипак описан как N единиц по M грамм: вес за единицу, pack_count — количество.
      const weight = pkg.weight_g === unitGrams ? pkg.weight_g : unitGrams;
      if (!dryRun) {
        db.prepare('UPDATE package SET weight_g = ?, pack_count = ? WHERE id = ?').run(weight, count, pkg.id);
      }
      stats.multipacks_fixed += 1;
      details.push(`мультипак #${product.id}: package ${pkg.id} ${pkg.weight_g} г ×${pkg.pack_count} → ${weight} г ×${count}`);
    }
  }

  // --- 2. Дубли package ----------------------------------------------------
  const duplicateGroups = db
    .prepare(
      `SELECT product_id, weight_g, pack_count, MIN(id) AS keep_id, COUNT(*) AS n
         FROM package
        GROUP BY product_id, weight_g, pack_count
       HAVING n > 1`
    )
    .all();

  for (const group of duplicateGroups) {
    const dups = db
      .prepare(
        `SELECT id FROM package
          WHERE product_id = ? AND weight_g = ? AND pack_count = ? AND id <> ?`
      )
      .all(group.product_id, group.weight_g, group.pack_count, group.keep_id);

    for (const dup of dups) {
      const moved = db.prepare('SELECT COUNT(*) AS n FROM price_snapshot WHERE package_id = ?').get(dup.id).n;
      if (!dryRun) {
        db.prepare('UPDATE price_snapshot SET package_id = ? WHERE package_id = ?').run(group.keep_id, dup.id);
        db.prepare('DELETE FROM package WHERE id = ?').run(dup.id);
      }
      stats.packages_merged += 1;
      stats.prices_reassigned += moved;
    }
  }

  // --- 3. Дубли цен --------------------------------------------------------
  const duplicatePrices = db
    .prepare(
      `SELECT package_id, price, url, observed_at, MIN(id) AS keep_id, COUNT(*) AS n
         FROM price_snapshot
        GROUP BY package_id, price, url, observed_at
       HAVING n > 1`
    )
    .all();

  for (const group of duplicatePrices) {
    if (!dryRun) {
      db.prepare(
        `DELETE FROM price_snapshot
          WHERE package_id = ? AND price = ? AND url IS ? AND observed_at = ? AND id <> ?`
      ).run(group.package_id, group.price, group.url, group.observed_at, group.keep_id);
    }
    stats.price_rows_removed += group.n - 1;
  }

  if (dryRun) db.exec('ROLLBACK');
  else db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  db.close();
  console.error('Откатано:', error.message);
  process.exit(1);
}

const after = {
  packages: db.prepare('SELECT COUNT(*) AS n FROM package').get().n,
  prices: db.prepare('SELECT COUNT(*) AS n FROM price_snapshot').get().n
};
db.close();

console.log(`DB: ${dbPath}${dryRun ? ' (dry-run, без записи)' : ''}`);
console.log(JSON.stringify({ ...stats, after }, null, 2));
if (details.length) {
  console.log('\nМультипаки:');
  for (const line of details) console.log('  ' + line);
}
