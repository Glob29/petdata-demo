#!/usr/bin/env node
'use strict';

/*
 * Проверки целостности Breed DB. Запуск: node db/check-breeds.js
 * Возвращает код 1, если есть проблемы. Годится как гейт перед миграцией в прод.
 */

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.join(__dirname, '..');
const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');

const db = new DatabaseSync(dbPath, { readOnly: true });
const all = (sql, ...params) => db.prepare(sql).all(...params);
const get = (sql, ...params) => db.prepare(sql).get(...params);

const problems = [];
const add = (message) => problems.push(message);

const breeds = all('SELECT * FROM breed ORDER BY id');
const conditions = all('SELECT * FROM condition');
const predispositions = all('SELECT * FROM breed_predisposition');
const weights = all('SELECT * FROM breed_weight');
const tests = all('SELECT * FROM genetic_test');
const sources = new Set(all('SELECT id FROM source').map((row) => row.id));

// 1. Уникальность
const names = new Set();
for (const breed of breeds) {
  const key = `${breed.species}:${breed.name_ru}`;
  if (names.has(key)) add(`дубль породы: ${key}`);
  names.add(key);
}

// 2. Обязательные поля
const qualityValues = new Set(['fci', 'mixed', 'estimate']);
for (const breed of breeds) {
  if (!breed.name_en) add(`${breed.name_ru}: нет name_en`);
  if (!breed.size_class) add(`${breed.name_ru}: нет size_class`);
  if (!breed.temperament) add(`${breed.name_ru}: нет temperament`);
  if (!(breed.lifespan_min_years > 0) || !(breed.lifespan_max_years >= breed.lifespan_min_years)) {
    add(`${breed.name_ru}: некорректная продолжительность жизни`);
  }
  if (!breed.source_id || !sources.has(breed.source_id)) add(`${breed.name_ru}: битый source_id`);
  if (breed.extra_json) {
    let extra;
    try {
      extra = JSON.parse(breed.extra_json);
    } catch {
      add(`${breed.name_ru}: extra_json не парсится`);
    }
    if (extra && extra.data_quality && !qualityValues.has(extra.data_quality)) {
      add(`${breed.name_ru}: неизвестный data_quality ${extra.data_quality}`);
    }
  }
}

// 3. Вес: у каждой породы есть хотя бы одна запись, диапазон согласован
for (const breed of breeds) {
  const rows = weights.filter((row) => row.breed_id === breed.id);
  if (!rows.length) add(`${breed.name_ru}: нет записей breed_weight`);
  for (const row of rows) {
    if (!(row.min_kg > 0) || !(row.max_kg >= row.min_kg)) add(`${breed.name_ru}: битый вес (${row.sex})`);
    if (breed.weight_min_kg && row.min_kg < breed.weight_min_kg - 0.01) {
      add(`${breed.name_ru}: вес по полу (${row.sex}) ниже общего диапазона`);
    }
    if (breed.weight_max_kg && row.max_kg > breed.weight_max_kg + 0.01) {
      add(`${breed.name_ru}: вес по полу (${row.sex}) выше общего диапазона`);
    }
  }
}

// 4. Предрасположенности
const conditionById = new Map(conditions.map((row) => [row.id, row]));
for (const pred of predispositions) {
  if (!conditionById.has(pred.condition_id)) add(`predisposition ${pred.id}: нет condition`);
  if (!['A', 'B', 'C', 'D'].includes(pred.evidence_level)) add(`predisposition ${pred.id}: evidence_level`);
  if (!pred.source_id || !sources.has(pred.source_id)) add(`predisposition ${pred.id}: битый source_id`);
  if (!pred.prevalence_text) add(`predisposition ${pred.id}: пустой prevalence_text`);
}

// 5. Гентесты
for (const test of tests) {
  if (!test.gene) add(`genetic_test ${test.id}: пустой gene`);
  if (!test.mutation) add(`genetic_test ${test.id}: пустая mutation`);
  if (!test.inheritance) add(`genetic_test ${test.id}: пустое inheritance`);
}

// 6. Коды условий уникальны
const codes = new Set();
for (const condition of conditions) {
  if (codes.has(condition.code)) add(`дубль code условия: ${condition.code}`);
  codes.add(condition.code);
}

db.close();

const summary = {
  breeds: breeds.length,
  dogs: breeds.filter((row) => row.species === 'dog').length,
  cats: breeds.filter((row) => row.species === 'cat').length,
  conditions: conditions.length,
  predispositions: predispositions.length,
  weights: weights.length,
  genetic_tests: tests.length
};

console.log(`DB: ${dbPath}`);
console.log(JSON.stringify(summary, null, 2));

if (problems.length) {
  console.error(`\nПроблемы (${problems.length}):`);
  for (const problem of problems) console.error('  - ' + problem);
  process.exitCode = 1;
} else {
  console.log('\nOK: целостность Breed DB в порядке');
}
