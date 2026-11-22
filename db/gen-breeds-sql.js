#!/usr/bin/env node
'use strict';

/*
 * Генерирует db/seed-breeds.sql из db/breeds-data.json.
 * Запуск: node db/gen-breeds-sql.js
 *
 * Файл детерминированный: повторный запуск даёт тот же результат.
 * Все вставки идемпотентные (INSERT OR IGNORE / WHERE NOT EXISTS),
 * поэтому один и тот же SQL годится и для чистой сборки, и для миграции живой базы.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dataPath = path.join(__dirname, 'breeds-data.json');
const outPath = path.join(__dirname, 'seed-breeds.sql');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// ---------------------------------------------------------------------------
// Валидация
// ---------------------------------------------------------------------------

const errors = [];

/*
 * Справочник condition частично уже живёт в seed.sql (id 1–13).
 * Читаем его оттуда, чтобы коды старых заболеваний резолвились в их реальные id
 * и не приходилось дублировать определения в двух файлах.
 */
function seedConditionCodes() {
  const seedPath = path.join(__dirname, 'seed.sql');
  const text = fs.readFileSync(seedPath, 'utf8');
  const start = text.indexOf('INSERT INTO condition (id, code, name_ru, name_en, category) VALUES');
  if (start === -1) throw new Error('в seed.sql не найден блок INSERT INTO condition');
  const block = text.slice(start, text.indexOf(';', start));
  const codes = new Map();
  for (const match of block.matchAll(/\((\d+),\s*'([^']+)'/g)) {
    codes.set(match[2], Number(match[1]));
  }
  if (!codes.size) throw new Error('в seed.sql не удалось разобрать коды condition');
  return codes;
}

const conditionIdByCode = seedConditionCodes();
const conditionByCode = new Map();
for (const [code, id] of conditionIdByCode) conditionByCode.set(code, { id, code });

for (const item of data.conditions) {
  if (conditionByCode.has(item.code)) errors.push(`дубль condition: ${item.code}`);
  conditionByCode.set(item.code, item);
}

const ids = new Set();
for (const breed of data.breeds) {
  if (ids.has(breed.id)) errors.push(`дубль breed id: ${breed.id}`);
  ids.add(breed.id);
  if (!['dog', 'cat'].includes(breed.species)) errors.push(`${breed.name_ru}: species=${breed.species}`);
  for (const key of ['size_class', 'coat_length', 'grooming_level', 'exercise_level']) {
    if (breed[key] !== null && breed[key] !== undefined) continue;
    errors.push(`${breed.name_ru}: пустое поле ${key}`);
  }
  if (breed.brachycephalic !== 0 && breed.brachycephalic !== 1) errors.push(`${breed.name_ru}: brachycephalic`);
  if (!(breed.lifespan_min_years <= breed.lifespan_max_years)) errors.push(`${breed.name_ru}: lifespan`);
  if (breed.weight_min_kg && breed.weight_max_kg && breed.weight_min_kg > breed.weight_max_kg) {
    errors.push(`${breed.name_ru}: weight range`);
  }
  if (breed.height_min_cm && breed.height_max_cm && breed.height_min_cm > breed.height_max_cm) {
    errors.push(`${breed.name_ru}: height range`);
  }
  for (const pred of breed.predispositions) {
    if (!conditionByCode.has(pred.condition)) errors.push(`${breed.name_ru}: неизвестный condition ${pred.condition}`);
    if (!['A', 'B', 'C', 'D'].includes(pred.evidence_level)) errors.push(`${breed.name_ru}: evidence ${pred.evidence_level}`);
  }
  for (const test of breed.genetic_tests) {
    if (!test.gene || !test.mutation) errors.push(`${breed.name_ru}: гентест без гена/мутации`);
  }
}

if (errors.length) {
  console.error('Данные не прошли валидацию:');
  for (const error of errors) console.error('  - ' + error);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Сериализация
// ---------------------------------------------------------------------------

const q = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return "'" + String(value).replace(/'/g, "''") + "'";
};

const extraJson = (breed) => {
  const extra = {
    fci_number: breed.extra && breed.extra.fci_number !== undefined ? breed.extra.fci_number : null,
    data_quality: breed.data_quality,
    wiki: (breed.extra && breed.extra.wiki) || null
  };
  return Object.values(extra).some((value) => value !== null) ? JSON.stringify(extra) : null;
};

const line = '\n';
const sql = [];

sql.push('-- СГЕНЕРИРОВАНО db/gen-breeds-sql.js из db/breeds-data.json — не редактировать вручную.');
sql.push('-- Повторный запуск генератора перезаписывает файл.');
sql.push('-- Вставки идемпотентные: работают и на чистой базе, и как миграция.');
sql.push('PRAGMA foreign_keys = ON;');
sql.push('');

sql.push('-- Новые источники данных');
sql.push('INSERT OR IGNORE INTO source (id, kind, name, url, license, reliability, notes) VALUES');
sql.push(
  data.sources
    .map((s) => `(${s.id}, ${q(s.kind)}, ${q(s.name)}, ${q(s.url)}, ${q(s.license)}, ${s.reliability}, ${q(s.notes)})`)
    .join(',' + line) + ';'
);
sql.push('');

sql.push('-- Новые заболевания');
sql.push('INSERT OR IGNORE INTO condition (id, code, name_ru, name_en, category) VALUES');
sql.push(
  data.conditions
    .map((c) => `(${c.id}, ${q(c.code)}, ${q(c.name_ru)}, ${q(c.name_en)}, ${q(c.category)})`)
    .join(',' + line) + ';'
);
sql.push('');

sql.push('-- Породы');
const breedColumns = [
  'id', 'species', 'name_ru', 'name_en', 'fci_group', 'origin_country', 'size_class',
  'height_min_cm', 'height_max_cm', 'weight_min_kg', 'weight_max_kg',
  'lifespan_min_years', 'lifespan_max_years', 'coat_type', 'coat_length',
  'grooming_level', 'brachycephalic', 'exercise_level', 'temperament', 'extra_json', 'source_id'
];
sql.push(`INSERT INTO breed (${breedColumns.join(', ')}) VALUES`);
sql.push(
  data.breeds
    .map(
      (b) =>
        `(${b.id}, ${q(b.species)}, ${q(b.name_ru)}, ${q(b.name_en)}, ${q(b.fci_group)}, ${q(b.origin_country)}, ${q(
          b.size_class
        )}, ${q(b.height_min_cm)}, ${q(b.height_max_cm)}, ${q(b.weight_min_kg)}, ${q(b.weight_max_kg)}, ${q(
          b.lifespan_min_years
        )}, ${q(b.lifespan_max_years)}, ${q(b.coat_type)}, ${q(b.coat_length)}, ${q(b.grooming_level)}, ${
          b.brachycephalic
        }, ${q(b.exercise_level)}, ${q(b.temperament)}, ${q(extraJson(b))}, ${b.source_id})`
    )
    .join(',' + line)
);
// JSON — единственный источник правды: повторный прогон обновляет карточку породы.
sql.push(
  'ON CONFLICT(id) DO UPDATE SET ' +
    breedColumns
      .filter((column) => column !== 'id')
      .map((column) => `${column} = excluded.${column}`)
      .join(', ') +
    ';'
);
sql.push('');

sql.push('-- Вес по полу (у breed_weight нет уникального ключа, поэтому через NOT EXISTS)');
const weightRows = [];
for (const breed of data.breeds) {
  for (const weight of breed.weights) {
    weightRows.push(
      `(${breed.id}, ${q(weight.sex)}, ${q(weight.age_stage)}, ${q(weight.min_kg)}, ${q(weight.max_kg)}, ${breed.source_id})`
    );
    sql.push(
      'INSERT INTO breed_weight (breed_id, sex, age_stage, min_kg, max_kg, source_id)' +
        line +
        `SELECT ${breed.id}, ${q(weight.sex)}, ${q(weight.age_stage)}, ${q(weight.min_kg)}, ${q(weight.max_kg)}, ${
          breed.source_id
        }` +
        line +
        ` WHERE NOT EXISTS (SELECT 1 FROM breed_weight WHERE breed_id = ${breed.id} AND sex = ${q(
          weight.sex
        )} AND age_stage = ${q(weight.age_stage)});`
    );
  }
}
sql.push('');

sql.push('-- Предрасположенности');
const predRows = [];
for (const breed of data.breeds) {
  for (const pred of breed.predispositions) {
    const condition = conditionByCode.get(pred.condition);
    predRows.push(
      `(${breed.id}, ${condition.id}, ${q(pred.prevalence_text)}, ${q(pred.evidence_level)}, ${q(
        pred.age_of_onset
      )}, ${q(pred.source_id)}, ${q(pred.notes)})`
    );
  }
}
sql.push(
  'INSERT OR IGNORE INTO breed_predisposition (breed_id, condition_id, prevalence_text, evidence_level, age_of_onset, source_id, notes) VALUES'
);
sql.push(predRows.join(',' + line) + ';');
sql.push('');

sql.push('-- Генетические тесты (без уникального ключа в схеме, поэтому через NOT EXISTS)');
for (const breed of data.breeds) {
  for (const test of breed.genetic_tests) {
    sql.push(
      `INSERT INTO genetic_test (breed_id, gene, mutation, inheritance, test_available, source_id)` +
        line +
        `SELECT ${breed.id}, ${q(test.gene)}, ${q(test.mutation)}, ${q(test.inheritance)}, ${
          test.test_available ? 1 : 0
        }, ${q(test.source_id)}` +
        line +
        ` WHERE NOT EXISTS (SELECT 1 FROM genetic_test WHERE breed_id = ${breed.id} AND gene = ${q(test.gene)});`
    );
  }
}
sql.push('');

// Идемпотентные правки данных, найденные проверкой db/check-breeds.js.
if (data.corrections && data.corrections.length) {
  sql.push('-- Правки исходных данных (идемпотентные)');
  for (const correction of data.corrections) {
    sql.push('-- ' + correction.description);
    sql.push(correction.sql);
  }
  sql.push('');
}

// Версия датасета: расширение Breed DB меняет состав базы, фиксируем это явно.
const dogs = data.breeds.filter((b) => b.species === 'dog').length;
const cats = data.breeds.filter((b) => b.species === 'cat').length;
const notes = `Breed DB расширена: +${data.breeds.length} пород (${dogs} собак, ${cats} кошек), +${data.conditions.length} заболеваний, +${data.breeds.reduce(
  (sum, b) => sum + b.genetic_tests.length,
  0
)} гентестов`;
sql.push('-- Версия датасета');
sql.push('INSERT INTO dataset_version (version, released_at, notes)');
sql.push(`SELECT '2026.11-demo-2', date('now'), ${q(notes)}`);
sql.push(` WHERE NOT EXISTS (SELECT 1 FROM dataset_version WHERE version = '2026.11-demo-2');`);
sql.push('');

fs.writeFileSync(outPath, sql.join(line) + line, 'utf8');

const counts = {
  sources: data.sources.length,
  conditions: data.conditions.length,
  breeds: data.breeds.length,
  dogs: data.breeds.filter((b) => b.species === 'dog').length,
  cats: data.breeds.filter((b) => b.species === 'cat').length,
  weights: weightRows.length,
  predispositions: predRows.length,
  genetic_tests: data.breeds.reduce((sum, b) => sum + b.genetic_tests.length, 0)
};

console.log(`SQL: ${outPath}`);
console.log(JSON.stringify(counts, null, 2));
