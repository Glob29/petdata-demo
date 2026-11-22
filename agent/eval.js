#!/usr/bin/env node
'use strict';

/*
 * Оценка качества извлечения на gold set.
 * Запуск: node agent/eval.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { fetchText } = require('./lib/http');
const { extractProduct } = require('./lib/extract');

const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'gold.json'), 'utf8'));

function nutrient(draft, code) {
  return draft.nutrients.find((row) => row.code === code)?.amount ?? null;
}

function near(actual, expected, tolerance = 0.5) {
  if (actual == null || expected == null) return false;
  return Math.abs(actual - expected) <= tolerance;
}

(async () => {
  let checks = 0;
  let passed = 0;

  for (const item of gold.items) {
    const response = await fetchText(item.url);
    const draft = extractProduct({ html: response.html, url: item.url, brand: item.brand });
    const expect = item.expect;

    const fields = [
      ['protein', nutrient(draft, 'protein'), expect.protein],
      ['fat', nutrient(draft, 'fat'), expect.fat],
      ['me', nutrient(draft, 'me'), expect.me]
    ];

    console.log(`\n${item.brand}: ${draft.name}`);
    for (const [field, actual, expected] of fields) {
      if (expected == null) continue;
      checks += 1;
      const ok = near(actual, expected);
      if (ok) passed += 1;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${field}: ${actual} (ожидалось ${expected})`);
    }

    for (const field of ['weight_g', 'species', 'form', 'completeness']) {
      if (expect[field] == null) continue;
      checks += 1;
      const ok = draft[field] === expect[field];
      if (ok) passed += 1;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${field}: ${draft[field]} (ожидалось ${expect[field]})`);
    }
  }

  const accuracy = checks ? (passed / checks) * 100 : 0;
  console.log(`\nТочность: ${passed}/${checks} (${accuracy.toFixed(1)}%)`);
  if (accuracy < 90) process.exitCode = 1;
})();
