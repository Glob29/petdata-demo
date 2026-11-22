'use strict';

/*
 * Классификация кормов: economy / premium / super_premium / holistic.
 * Это маркетинговая сегментация, а не оценка питательности.
 * Значение можно переопределить вручную (class_source='manual').
 *
 * Запуск: node db/classify.js
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

addColumn('class', "TEXT NOT NULL DEFAULT 'unknown'");
addColumn('class_source', 'TEXT');
addColumn('class_confidence', 'REAL');

const CLASS_BY_BRAND = {
  'whiskas': 'economy',
  'felix': 'economy',
  'мнямс': 'economy',
  'mnyams': 'economy',
  'grandin': 'economy',
  'alphapet': 'economy',
  'purina one': 'premium',
  'perfect fit': 'premium',
  'royal canin': 'premium',
  "hill's": 'premium',
  'purina pro plan': 'premium',
  'purina pro plan veterinary diets': 'super_premium',
  'pro plan': 'premium',
  'monge': 'super_premium',
  'farmina': 'super_premium',
  'wellkiss': 'super_premium',
  'alleva': 'super_premium',
  'grandorf': 'holistic',
  'ownat': 'holistic',
  'mealfeel': 'holistic',
  'авва': 'premium',
  'dog & dog wild': 'premium',
  'inaba ciao': 'super_premium',
  'unica': 'premium',
  'yummy': 'economy',
  'четвероногий гурман': 'premium',
  'berkley': 'economy',
  "dr. alder's": 'premium',
  'sirius': 'premium'
};

const rows = db.prepare(`
  SELECT p.id, p.name, p.line_name, p.class_source, b.name AS brand
    FROM product p JOIN brand b ON b.id = p.brand_id
`).all();

const update = db.prepare(`
  UPDATE product SET class = ?, class_source = ?, class_confidence = ? WHERE id = ?
`);

const stats = { economy: 0, premium: 0, super_premium: 0, holistic: 0, unknown: 0, manual: 0 };

for (const row of rows) {
  if (row.class_source === 'manual') {
    stats.manual += 1;
    continue;
  }

  const brand = String(row.brand || '').toLowerCase().replace(/®/g, '').trim();
  const text = `${row.name || ''} ${row.line_name || ''}`.toLowerCase();

  let value = CLASS_BY_BRAND[brand];
  let source = value ? 'brand_default' : 'unknown';
  let confidence = value ? 0.5 : 0.1;

  if (/холистик|holistic/.test(text)) {
    value = 'holistic';
    source = 'name_rule';
    confidence = 0.7;
  } else if (/эконом|economy/.test(text)) {
    value = 'economy';
    source = 'name_rule';
    confidence = 0.7;
  } else if (/супер.?премиум|super.?premium/.test(text)) {
    value = 'super_premium';
    source = 'name_rule';
    confidence = 0.7;
  } else if (/премиум|premium/.test(text) && !value) {
    value = 'premium';
    source = 'name_rule';
    confidence = 0.6;
  }

  if (!value) value = 'unknown';
  update.run(value, source, confidence, row.id);
  stats[value] += 1;
}

console.log(JSON.stringify(stats, null, 2));
db.close();
