'use strict';

/*
 * Расчёт справочного расхода корма на килограмм веса животного.
 *
 * RER = 70 × W^0.75
 * MER = RER × k
 * граммы/сут = MER / (ME ккал/кг / 100)
 * г/кг/сут = граммы/сут / W
 *
 * Референс: взрослый кастрированный, кошка 4 кг (k=1.2), собака 10 кг (k=1.6).
 * Это справочная величина, не индивидуальная норма.
 *
 * Запуск: node db/compute-feeding.js
 */

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.PETDATA_DB || path.join(__dirname, 'petdata.db');
const db = new DatabaseSync(dbPath);

function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}
function addColumn(column, definition) {
  if (!columnExists('product', column)) db.exec(`ALTER TABLE product ADD COLUMN ${column} ${definition}`);
}

addColumn('food_per_kg_day', 'REAL');
addColumn('reference_weight_kg', 'REAL');
addColumn('food_per_kg_basis', 'TEXT');
addColumn('food_per_kg_confidence', 'REAL');

const products = db.prepare(`
  SELECT p.id, p.species,
         (SELECT pn.amount FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id
           WHERE pn.product_id = p.id AND n.code = 'me' AND pn.basis = 'as_fed'
           ORDER BY CASE pn.value_type WHEN 'declared' THEN 1 WHEN 'typical' THEN 2 ELSE 3 END LIMIT 1) AS me
    FROM product p
`).all();

const update = db.prepare(`
  UPDATE product
     SET food_per_kg_day = ?, reference_weight_kg = ?, food_per_kg_basis = ?, food_per_kg_confidence = ?
   WHERE id = ?
`);

let calculated = 0;
let skipped = 0;

for (const row of products) {
  if (!row.me || !(row.me > 0) || !row.species) {
    skipped += 1;
    continue;
  }

  const weight = row.species === 'cat' ? 4 : 10;
  const factor = row.species === 'cat' ? 1.2 : 1.6;
  const rer = 70 * Math.pow(weight, 0.75);
  const mer = rer * factor;
  const grams = mer / (row.me / 100);
  const perKg = grams / weight;

  update.run(
    Math.round(perKg * 100) / 100,
    weight,
    `справочно: ${row.species === 'cat' ? 'кошка 4 кг' : 'собака 10 кг'}, взрослый кастрированный, ME ×${factor}`,
    0.7,
    row.id
  );
  calculated += 1;
}

console.log(JSON.stringify({ products: products.length, calculated, skipped }, null, 2));
db.close();
