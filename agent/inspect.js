#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.PETDATA_DB || path.join(__dirname, '..', 'db', 'petdata.db');
const db = new DatabaseSync(dbPath);

const rows = db.prepare(`
  SELECT p.id, b.name AS brand, p.name, p.species, p.form, p.completeness, p.source_url,
         (SELECT pn.amount FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id
           WHERE pn.product_id = p.id AND n.code = 'protein' AND pn.basis = 'as_fed' LIMIT 1) AS protein,
         (SELECT pn.amount FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id
           WHERE pn.product_id = p.id AND n.code = 'fat' AND pn.basis = 'as_fed' LIMIT 1) AS fat,
         (SELECT pn.amount FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id
           WHERE pn.product_id = p.id AND n.code = 'me' AND pn.basis = 'as_fed' LIMIT 1) AS me,
         (SELECT GROUP_CONCAT(ps.code, ',') FROM product_protein_source pps
           JOIN protein_source ps ON ps.id = pps.protein_source_id WHERE pps.product_id = p.id) AS protein_sources,
         (SELECT COUNT(*) FROM certificate c WHERE c.product_id = p.id) AS certificates
    FROM product p JOIN brand b ON b.id = p.brand_id
   WHERE p.id > 7
   ORDER BY b.name, p.name
`).all();

console.log(`Агентских продуктов: ${rows.length}\n`);
for (const row of rows) {
  console.log(
    `#${row.id} ${row.brand} | ${row.name}\n` +
    `   species=${row.species} form=${row.form} completeness=${row.completeness} ` +
    `protein=${row.protein ?? '—'} fat=${row.fat ?? '—'} me=${row.me ?? '—'} ` +
    `sources=${row.protein_sources || '—'} certs=${row.certificates}`
  );
}

const coverage = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM product WHERE id > 7) AS products,
    (SELECT COUNT(*) FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id WHERE n.code = 'me') AS with_me,
    (SELECT COUNT(*) FROM product_protein_source) AS protein_links,
    (SELECT COUNT(*) FROM certificate) AS certificates,
    (SELECT COUNT(*) FROM extraction_run WHERE status = 'failed') AS failed_runs
`).get();

console.log('\nCoverage:', JSON.stringify(coverage));
db.close();
