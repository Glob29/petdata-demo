#!/usr/bin/env node
'use strict';

/*
 * Минимальный API демо-базы (Nutrition DB + Breed DB).
 * Без внешних зависимостей: node:http + node:sqlite.
 *
 * Запуск: node api/server.js
 * Порт: PETDATA_PORT (по умолчанию 8787)
 * Ключ: если задан PETDATA_API_KEY, требуется заголовок X-API-Key.
 */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.PETDATA_DB || path.join(__dirname, '..', 'db', 'petdata.db');
if (!fs.existsSync(DB_PATH)) {
  throw new Error(`База не найдена: ${DB_PATH}. Сначала выполните: node db/import.js`);
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

const REQUIRED_KEY = process.env.PETDATA_API_KEY || '';

function plain(row) {
  return row ? { ...row } : null;
}

function all(sql, ...params) {
  return db.prepare(sql).all(...params).map(plain);
}

function get(sql, ...params) {
  return plain(db.prepare(sql).get(...params));
}

const sourceGroupMap = Object.fromEntries(
  all('SELECT code, group_code FROM protein_source').map((row) => [row.code, row.group_code])
);

function round(value, digits = 4) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function datasetVersion() {
  const row = get('SELECT version, released_at FROM dataset_version ORDER BY released_at DESC LIMIT 1');
  return row || { version: 'unknown', released_at: null };
}

function parseLimit(value, fallback = 20, max = 100) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

function parseOffset(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
    'X-Data-Version': datasetVersion().version
  });
  res.end(body);
}

function ok(res, data, meta = {}) {
  sendJson(res, 200, { data, meta: { ...meta, dataset_version: datasetVersion().version } });
}

function fail(res, status, code, message) {
  sendJson(res, status, { error: { code, message } });
}

/* -------------------------------------------------------------------------- */
/* Продукты                                                                   */
/* -------------------------------------------------------------------------- */

function keyNutrientsFor(productIds) {
  const result = {};
  if (!productIds.length) return result;

  const placeholders = productIds.map(() => '?').join(',');
  const rows = all(
    `SELECT pn.product_id, n.code, pn.amount, pn.unit, pn.basis, pn.value_type, pn.confidence
       FROM product_nutrient pn
       JOIN nutrient n ON n.id = pn.nutrient_id
      WHERE pn.product_id IN (${placeholders})
        AND pn.basis = 'as_fed'
        AND n.code IN ('protein', 'fat', 'me', 'moisture')
      ORDER BY CASE pn.value_type
                 WHEN 'declared' THEN 1
                 WHEN 'typical' THEN 2
                 WHEN 'min' THEN 3
                 WHEN 'max' THEN 4
                 ELSE 5
               END`,
    ...productIds
  );

  for (const row of rows) {
    if (!result[row.product_id]) result[row.product_id] = {};
    if (!result[row.product_id][row.code]) {
      result[row.product_id][row.code] = {
        amount: row.amount,
        unit: row.unit,
        value_type: row.value_type,
        confidence: row.confidence
      };
    }
  }
  return result;
}

function mapProduct(row) {
  return {
    id: row.id,
    brand: row.brand_name,
    manufacturer: row.manufacturer_name || null,
    line: row.line_name || null,
    name: row.name,
    gtin: row.gtin || null,
    species: row.species,
    life_stage: row.life_stage,
    size_class: row.size_class,
    form: row.form,
    completeness: row.completeness,
    class: row.class || 'unknown',
    food_per_kg_day: row.food_per_kg_day ?? null,
    reference_weight_kg: row.reference_weight_kg ?? null,
    therapeutic: Boolean(row.therapeutic),
    therapeutic_class: row.therapeutic_class || null,
    market: row.market,
    confidence: row.confidence,
    updated_at: row.updated_at
  };
}

function priceRangeFor(productIds) {
  const result = {};
  if (!productIds.length) return result;
  const placeholders = productIds.map(() => '?').join(',');
  const rows = all(
    `SELECT product_id, MIN(price) AS min, MAX(price) AS max, COUNT(*) AS observations
       FROM price_snapshot
      WHERE product_id IN (${placeholders})
      GROUP BY product_id`,
    ...productIds
  );
  for (const row of rows) {
    result[row.product_id] = {
      min: row.min,
      max: row.max,
      mid: round((row.min + row.max) / 2, 2),
      observations: row.observations
    };
  }
  return result;
}

function qualityFor(productIds) {
  const result = {};
  if (!productIds.length) return result;
  const placeholders = productIds.map(() => '?').join(',');
  const rows = all(
    `SELECT product_id, protein_quality_score
       FROM product_quality
      WHERE product_id IN (${placeholders})`,
    ...productIds
  );
  for (const row of rows) result[row.product_id] = row.protein_quality_score;
  return result;
}

function allergensFor(productIds) {
  const result = {};
  for (const id of productIds) {
    result[id] = {
      sources: [],
      contains: [],
      groups: [],
      may_contain: [],
      hydrolyzed_components: false,
      cross_reactivity: []
    };
  }
  if (!productIds.length) return result;

  const placeholders = productIds.map(() => '?').join(',');
  const rows = all(
    `SELECT pps.product_id,
            ps.code, ps.name_ru, ps.group_code,
            ag.name_ru AS group_name, ag.cross_reactivity_note,
            pps.role, pps.declared_percent, pps.is_hydrolyzed, pps.confidence
       FROM product_protein_source pps
       JOIN protein_source ps ON ps.id = pps.protein_source_id
       JOIN allergen_group ag ON ag.code = ps.group_code
      WHERE pps.product_id IN (${placeholders})
      ORDER BY CASE pps.role WHEN 'primary' THEN 1 WHEN 'secondary' THEN 2 ELSE 3 END, ps.name_ru`,
    ...productIds
  );

  for (const row of rows) {
    const item = result[row.product_id];
    item.sources.push({
      code: row.code,
      name: row.name_ru,
      group: row.group_code,
      group_name: row.group_name,
      role: row.role,
      declared_percent: row.declared_percent,
      hydrolyzed: Boolean(row.is_hydrolyzed),
      confidence: row.confidence
    });
    if (!item.contains.includes(row.code)) item.contains.push(row.code);
    if (!item.groups.includes(row.group_code)) item.groups.push(row.group_code);
    if (row.code.endsWith('_unspecified') && !item.may_contain.includes(row.group_code)) {
      item.may_contain.push(row.group_code);
    }
    if (row.is_hydrolyzed) item.hydrolyzed_components = true;
    if (row.cross_reactivity_note && !item.cross_reactivity.includes(row.cross_reactivity_note)) {
      item.cross_reactivity.push(row.cross_reactivity_note);
    }
  }
  return result;
}

function nutrientAmount(productId, code) {
  const row = get(
    `SELECT pn.amount
       FROM product_nutrient pn
       JOIN nutrient n ON n.id = pn.nutrient_id
      WHERE pn.product_id = ? AND n.code = ? AND pn.basis = 'as_fed'
      ORDER BY CASE pn.value_type WHEN 'declared' THEN 1 WHEN 'typical' THEN 2 ELSE 3 END
      LIMIT 1`,
    productId,
    code
  );
  return row ? row.amount : null;
}

/*
 * Метрики цены считаются по фасовкам: у каждой упаковки своя средняя цена и свой ₽/г.
 * Для клиента важен именно ₽/г — он не зависит от размера упаковки и позволяет сравнивать SKU.
 * Диапазоны min/max — это разброс по фасовкам, а не по магазинам.
 */
function productMetrics(productId) {
  const packages = all(
    `SELECT id, weight_g, COALESCE(pack_count, 1) AS pack_count,
            COALESCE(total_weight_g, weight_g) AS total_weight_g,
            price_avg, price_per_g
       FROM package
      WHERE product_id = ?
      ORDER BY COALESCE(total_weight_g, weight_g)`,
    productId
  );

  const smallest = packages[0] || null;
  const priced = packages.filter((item) => item.price_per_g != null && item.price_avg != null);

  if (!priced.length) {
    return { weight_g: smallest ? smallest.weight_g : null, price: null, note: 'price_or_package_missing' };
  }

  const protein = nutrientAmount(productId, 'protein');
  const me = nutrientAmount(productId, 'me');

  const perGramValues = priced.map((item) => item.price_per_g);
  const priceValues = priced.map((item) => item.price_avg);
  const cheapest = priced.reduce((best, item) => (item.price_per_g < best.price_per_g ? item : best), priced[0]);

  const minPerGram = Math.min(...perGramValues);
  const maxPerGram = Math.max(...perGramValues);

  const per100g = (perGram) => perGram * 100;
  const per100gProtein = (perGram) => (protein ? per100g(perGram) / (protein / 100) : null);
  const per100kcal = (perGram) => (me ? (perGram * 1000 * 100) / me : null);

  // Отдельно — разброс по конкретным наблюдениям цен (а не по средним):
  // это «самое дешёвое предложение на рынке», которое было в метриках раньше.
  const observations = all(
    `SELECT ps.price, COALESCE(pk.total_weight_g, pk.weight_g) AS total_weight_g
       FROM price_snapshot ps
       JOIN package pk ON pk.id = ps.package_id
      WHERE ps.product_id = ? AND COALESCE(pk.total_weight_g, pk.weight_g) > 0`,
    productId
  ).map((row) => row.price / row.total_weight_g);

  const observedBlock = observations.length
    ? {
        count: observations.length,
        price_per_g: { min: round(Math.min(...observations), 4), max: round(Math.max(...observations), 4) },
        price_per_100g_protein: protein
          ? {
              min: round(per100gProtein(Math.min(...observations)), 2),
              max: round(per100gProtein(Math.max(...observations)), 2)
            }
          : null
      }
    : null;

  return {
    weight_g: smallest ? smallest.weight_g : null,
    currency: 'RUB',
    packages_priced: priced.length,
    price: { min: Math.min(...priceValues), max: Math.max(...priceValues) },
    price_per_g: { min: round(minPerGram, 4), max: round(maxPerGram, 4) },
    price_per_kg: { min: round(minPerGram * 1000, 2), max: round(maxPerGram * 1000, 2) },
    price_per_100g: { min: round(per100g(minPerGram), 2), max: round(per100g(maxPerGram), 2) },
    price_per_100g_protein: protein
      ? { min: round(per100gProtein(minPerGram), 2), max: round(per100gProtein(maxPerGram), 2) }
      : null,
    price_per_100kcal: me
      ? { min: round(per100kcal(minPerGram), 2), max: round(per100kcal(maxPerGram), 2) }
      : null,
    // Лучшее предложение по цене за грамм: по нему удобно строить бюджет кормления.
    best_value: {
      total_weight_g: cheapest.total_weight_g,
      pack_count: cheapest.pack_count,
      price: cheapest.price_avg,
      price_per_g: cheapest.price_per_g
    },
    // Минимум/максимум по отдельным наблюдениям цен — «самое дешёвое предложение на рынке».
    observed_offers: observedBlock,
    protein_percent: protein,
    me_kcal_per_kg: me,
    protein_g_per_1000kcal: protein && me ? round((protein * 10) / me * 1000, 1) : null
  };
}

function listProducts(query) {
  let rows = all(
    `SELECT p.*, b.name AS brand_name, m.name AS manufacturer_name
       FROM product p
       JOIN brand b ON b.id = p.brand_id
       LEFT JOIN manufacturer m ON m.id = b.manufacturer_id
      ORDER BY b.name, p.name`
  );

  const q = (query.get('q') || '').trim().toLowerCase();
  const species = query.get('species');
  const lifeStage = query.get('life_stage');
  const productClass = query.get('class');
  const brand = (query.get('brand') || '').trim().toLowerCase();
  const excludeAllergen = (query.get('exclude_allergen') || '').trim().toLowerCase();
  const proteinSource = (query.get('protein_source') || '').trim().toLowerCase();
  const hydrolyzed = (query.get('hydrolyzed') || '').trim().toLowerCase();
  const allergens = allergensFor(rows.map((row) => row.id));

  rows = rows.filter((row) => {
    if (species && row.species !== species) return false;
    if (lifeStage && row.life_stage !== lifeStage) return false;
    if (productClass && row.class !== productClass) return false;
    if (brand && !row.brand_name.toLowerCase().includes(brand)) return false;
    if (q) {
      const haystack = `${row.brand_name} ${row.name} ${row.line_name || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    const allergen = allergens[row.id];
    if (excludeAllergen) {
      const group = sourceGroupMap[excludeAllergen];
      if (
        allergen.contains.includes(excludeAllergen) ||
        allergen.groups.includes(excludeAllergen) ||
        (group && allergen.groups.includes(group))
      ) {
        return false;
      }
    }
    if (proteinSource) {
      const match =
        allergen.contains.includes(proteinSource) ||
        allergen.groups.includes(proteinSource);
      if (!match) return false;
    }
    if (hydrolyzed === 'true' && !allergen.hydrolyzed_components) return false;

    return true;
  });

  const total = rows.length;
  const limit = parseLimit(query.get('limit'));
  const offset = parseOffset(query.get('offset'));
  const page = rows.slice(offset, offset + limit);
  const ids = page.map((row) => row.id);
  const keys = keyNutrientsFor(ids);
  const prices = priceRangeFor(ids);
  const quality = qualityFor(ids);

  return {
    data: page.map((row) => ({
      ...mapProduct(row),
      price_range: prices[row.id] || null,
      protein_quality_score: quality[row.id] ?? null,
      allergens: allergens[row.id],
      key_nutrients: keys[row.id] || {}
    })),
    meta: { count: total, limit, offset }
  };
}

function getProduct(id) {
  const row = get(
    `SELECT p.*, b.name AS brand_name, m.name AS manufacturer_name
       FROM product p
       JOIN brand b ON b.id = p.brand_id
       LEFT JOIN manufacturer m ON m.id = b.manufacturer_id
      WHERE p.id = ?`,
    id
  );
  if (!row) return null;

  const nutrients = all(
    `SELECT n.code, n.name_ru, n.unit, n.category, n.sort_order,
            pn.amount, pn.basis, pn.value_type, pn.confidence, pn.source_id
       FROM product_nutrient pn
       JOIN nutrient n ON n.id = pn.nutrient_id
      WHERE pn.product_id = ?
      ORDER BY n.sort_order, n.code`,
    id
  );

  const ingredients = all(
    `SELECT i.name_ru, i.name_en, i.animal_origin, i.allergen_group,
            pi.position, pi.percent, pi.percent_type
       FROM product_ingredient pi
       JOIN ingredient i ON i.id = pi.ingredient_id
      WHERE pi.product_id = ?
      ORDER BY pi.position`,
    id
  ).map((item) => ({ ...item, animal_origin: item.animal_origin == null ? null : Boolean(item.animal_origin) }));

  const qualityRow = get('SELECT * FROM product_quality WHERE product_id = ?', id);
  let quality = null;
  if (qualityRow) {
    let flags = [];
    try {
      flags = qualityRow.flags_json ? JSON.parse(qualityRow.flags_json) : [];
    } catch {
      flags = [];
    }
    quality = { ...qualityRow, flags };
    delete quality.flags_json;
  }

  return {
    ...mapProduct(row),
    key_nutrients: keyNutrientsFor([row.id])[row.id] || {},
    nutrients,
    ingredients,
    packages: all('SELECT * FROM package WHERE product_id = ? ORDER BY weight_g', id),
    price_snapshots: all(
      'SELECT price, currency, region, retailer, url, observed_at FROM price_snapshot WHERE product_id = ? ORDER BY price',
      id
    ),
    metrics: productMetrics(id),
    quality,
    allergens: allergensFor([row.id])[row.id],
    claims: all('SELECT claim_type, text FROM claim WHERE product_id = ?', id),
    feeding_guide: all('SELECT * FROM feeding_guide WHERE product_id = ? ORDER BY weight_min_kg', id)
  };
}

function productMoistureAndEnergy(productId) {
  const rows = all(
    `SELECT n.code, pn.amount, pn.unit
       FROM product_nutrient pn
       JOIN nutrient n ON n.id = pn.nutrient_id
      WHERE pn.product_id = ? AND pn.basis = 'as_fed' AND n.code IN ('moisture', 'me')`,
    productId
  );
  const map = Object.fromEntries(rows.map((row) => [row.code, row.amount]));
  return { moisture: map.moisture ?? null, me: map.me ?? null };
}

function convertNutrient(row, target, context) {
  if (target === 'as_fed' || row.basis === target) {
    return { amount: row.amount, unit: row.unit, basis: target, note: null };
  }

  if (target === 'dm') {
    if (row.unit === 'ratio') {
      return { amount: row.amount, unit: row.unit, basis: 'dm', note: 'ratio_unchanged' };
    }
    if (context.moisture == null) {
      return { amount: null, unit: row.unit, basis: 'dm', note: 'moisture_missing' };
    }
    const dm = (100 - context.moisture) / 100;
    if (!(dm > 0)) {
      return { amount: null, unit: row.unit, basis: 'dm', note: 'invalid_moisture' };
    }
    if (row.code === 'moisture') {
      return { amount: 0, unit: row.unit, basis: 'dm', note: null };
    }
    return { amount: round(row.amount / dm), unit: row.unit, basis: 'dm', note: null };
  }

  if (target === 'per_1000_kcal') {
    if (row.code === 'me') {
      return { amount: null, unit: row.unit, basis: target, note: 'energy_not_applicable' };
    }
    if (!context.me) {
      return { amount: null, unit: row.unit, basis: target, note: 'energy_missing' };
    }
    if (row.unit === '%') {
      return { amount: round((row.amount * 10) / context.me * 1000), unit: 'г/1000 ккал', basis: target, note: null };
    }
    if (row.unit === 'мг/кг') {
      return { amount: round((row.amount / context.me) * 1000), unit: 'мг/1000 ккал', basis: target, note: null };
    }
    if (row.unit === 'МЕ/кг') {
      return { amount: round((row.amount / context.me) * 1000), unit: 'МЕ/1000 ккал', basis: target, note: null };
    }
    return { amount: null, unit: row.unit, basis: target, note: 'unsupported_unit' };
  }

  return { amount: null, unit: row.unit, basis: target, note: 'unknown_basis' };
}

function productNutrients(id, target) {
  const product = get('SELECT id FROM product WHERE id = ?', id);
  if (!product) return null;

  const context = productMoistureAndEnergy(id);
  const rows = all(
    `SELECT n.code, n.name_ru, n.unit, n.category, n.sort_order,
            pn.amount, pn.basis, pn.value_type, pn.confidence
       FROM product_nutrient pn
       JOIN nutrient n ON n.id = pn.nutrient_id
      WHERE pn.product_id = ?
      ORDER BY n.sort_order, n.code`,
    id
  );

  return {
    product_id: Number(id),
    basis: target,
    context,
    nutrients: rows.map((row) => ({
      code: row.code,
      name: row.name_ru,
      category: row.category,
      value_type: row.value_type,
      confidence: row.confidence,
      ...convertNutrient(row, target, context)
    }))
  };
}

/* -------------------------------------------------------------------------- */
/* Породы                                                                     */
/* -------------------------------------------------------------------------- */

function mapBreed(row) {
  return {
    id: row.id,
    species: row.species,
    name: row.name_ru,
    name_en: row.name_en,
    fci_group: row.fci_group,
    origin_country: row.origin_country,
    size_class: row.size_class,
    height_cm: { min: row.height_min_cm, max: row.height_max_cm },
    weight_kg: { min: row.weight_min_kg, max: row.weight_max_kg },
    lifespan_years: { min: row.lifespan_min_years, max: row.lifespan_max_years },
    coat: {
      type: row.coat_type,
      length: row.coat_length,
      grooming_level: row.grooming_level
    },
    brachycephalic: Boolean(row.brachycephalic),
    exercise_level: row.exercise_level,
    temperament: row.temperament
  };
}

function listBreeds(query) {
  let rows = all('SELECT * FROM breed ORDER BY species, name_ru');
  const q = (query.get('q') || '').trim().toLowerCase();
  const species = query.get('species');
  const size = query.get('size');

  rows = rows.filter((row) => {
    if (species && row.species !== species) return false;
    if (size && row.size_class !== size) return false;
    if (q) {
      const haystack = `${row.name_ru} ${row.name_en || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const total = rows.length;
  const limit = parseLimit(query.get('limit'));
  const offset = parseOffset(query.get('offset'));

  return {
    data: rows.slice(offset, offset + limit).map(mapBreed),
    meta: { count: total, limit, offset }
  };
}

function getBreed(id) {
  const row = get('SELECT * FROM breed WHERE id = ?', id);
  if (!row) return null;

  const weights = all('SELECT sex, age_stage, min_kg, max_kg FROM breed_weight WHERE breed_id = ?', id);
  const predispositions = all(
    `SELECT c.code, c.name_ru, c.name_en, c.category,
            bp.prevalence_text, bp.evidence_level, bp.age_of_onset, bp.notes, bp.source_id
       FROM breed_predisposition bp
       JOIN condition c ON c.id = bp.condition_id
      WHERE bp.breed_id = ?
      ORDER BY CASE bp.evidence_level WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END`,
    id
  );
  const geneticTests = all(
    'SELECT gene, mutation, inheritance, test_available, source_id FROM genetic_test WHERE breed_id = ?',
    id
  ).map((item) => ({ ...item, test_available: Boolean(item.test_available) }));

  return {
    ...mapBreed(row),
    weights,
    predispositions,
    genetic_tests: geneticTests
  };
}

/* -------------------------------------------------------------------------- */
/* Мета и поиск                                                               */
/* -------------------------------------------------------------------------- */

function coverage() {
  const count = (sql) => get(sql).n;
  return {
    products: count('SELECT COUNT(*) AS n FROM product'),
    brands: count('SELECT COUNT(DISTINCT brand_id) AS n FROM product'),
    products_with_protein: count(
      `SELECT COUNT(DISTINCT pn.product_id) AS n FROM product_nutrient pn
        JOIN nutrient n ON n.id = pn.nutrient_id WHERE n.code = 'protein'`
    ),
    products_with_me: count(
      `SELECT COUNT(DISTINCT pn.product_id) AS n FROM product_nutrient pn
        JOIN nutrient n ON n.id = pn.nutrient_id WHERE n.code = 'me'`
    ),
    products_with_moisture: count(
      `SELECT COUNT(DISTINCT pn.product_id) AS n FROM product_nutrient pn
        JOIN nutrient n ON n.id = pn.nutrient_id WHERE n.code = 'moisture'`
    ),
    breeds: count('SELECT COUNT(*) AS n FROM breed'),
    dog_breeds: count("SELECT COUNT(*) AS n FROM breed WHERE species = 'dog'"),
    cat_breeds: count("SELECT COUNT(*) AS n FROM breed WHERE species = 'cat'"),
    predispositions: count('SELECT COUNT(*) AS n FROM breed_predisposition'),
    nutrients: count('SELECT COUNT(*) AS n FROM nutrient'),
    products_with_price: count('SELECT COUNT(DISTINCT product_id) AS n FROM price_snapshot'),
    products_with_quality: count('SELECT COUNT(*) AS n FROM product_quality'),
    last_updated: get('SELECT MAX(updated_at) AS d FROM product').d
  };
}

function search(query) {
  const q = (query.get('q') || '').trim().toLowerCase();
  const limit = parseLimit(query.get('limit'), 10, 50);
  if (!q) return { data: { products: [], breeds: [] }, meta: { count: 0, limit, offset: 0 } };

  let products = [];
  const ftsQuery = q
    .split(/\s+/)
    .map((word) => word.replace(/["'*]/g, ''))
    .filter(Boolean)
    .map((word) => `"${word}"*`)
    .join(' AND ');

  if (ftsQuery) {
    try {
      products = all(
        `SELECT p.id, p.name, p.species, b.name AS brand
           FROM product_fts f
           JOIN product p ON p.id = f.product_id
           JOIN brand b ON b.id = p.brand_id
          WHERE product_fts MATCH ?
          LIMIT ?`,
        ftsQuery,
        limit
      );
    } catch {
      products = [];
    }
  }

  if (!products.length) {
    products = all(
      `SELECT p.id, p.name, p.species, b.name AS brand
         FROM product p JOIN brand b ON b.id = p.brand_id
        ORDER BY b.name, p.name`
    ).filter((row) => `${row.brand} ${row.name}`.toLowerCase().includes(q)).slice(0, limit);
  }

  const breeds = all('SELECT id, name_ru, name_en, species FROM breed ORDER BY name_ru')
    .filter((row) => `${row.name_ru} ${row.name_en || ''}`.toLowerCase().includes(q))
    .slice(0, limit);

  return {
    data: { products, breeds },
    meta: { count: products.length + breeds.length, limit, offset: 0 }
  };
}

/* -------------------------------------------------------------------------- */
/* HTTP                                                                       */
/* -------------------------------------------------------------------------- */

function authorized(req) {
  if (!REQUIRED_KEY) return true;
  return req.headers['x-api-key'] === REQUIRED_KEY;
}

function handle(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'X-API-Key, Content-Type'
    });
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    fail(res, 405, 'method_not_allowed', 'Поддерживается только GET');
    return;
  }

  if (!authorized(req)) {
    fail(res, 401, 'unauthorized', 'Укажите корректный X-API-Key');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const query = url.searchParams;

  try {
    if (pathname === '/v1/health') {
      ok(res, { status: 'ok' });
      return;
    }

    if (pathname === '/v1/meta/coverage') {
      ok(res, coverage());
      return;
    }

    if (pathname === '/v1/nutrients') {
      const rows = all('SELECT code, name_ru, name_en, unit, category, sort_order FROM nutrient ORDER BY sort_order, code');
      ok(res, rows, { count: rows.length });
      return;
    }

    if (pathname === '/v1/brands') {
      const rows = all(
        `SELECT b.id, b.name, m.name AS manufacturer
           FROM brand b LEFT JOIN manufacturer m ON m.id = b.manufacturer_id
          ORDER BY b.name`
      );
      ok(res, rows, { count: rows.length });
      return;
    }

    if (pathname === '/v1/allergens') {
      const groups = all(
        'SELECT code, name_ru, description, cross_reactivity_note FROM allergen_group ORDER BY name_ru'
      );
      const sources = all(
        `SELECT ps.code, ps.name_ru, ps.group_code, ag.name_ru AS group_name,
                ps.animal_origin, ps.is_novel
           FROM protein_source ps
           JOIN allergen_group ag ON ag.code = ps.group_code
          ORDER BY ag.name_ru, ps.name_ru`
      ).map((row) => ({
        ...row,
        animal_origin: Boolean(row.animal_origin),
        is_novel: Boolean(row.is_novel)
      }));
      ok(res, { groups, sources }, { count: groups.length + sources.length });
      return;
    }

    if (pathname === '/v1/products') {
      const result = listProducts(query);
      ok(res, result.data, result.meta);
      return;
    }

    const productMatch = pathname.match(/^\/v1\/products\/(\d+)$/);
    if (productMatch) {
      const product = getProduct(productMatch[1]);
      if (!product) return fail(res, 404, 'not_found', 'Продукт не найден');
      ok(res, product);
      return;
    }

    const productNutrientsMatch = pathname.match(/^\/v1\/products\/(\d+)\/nutrients$/);
    if (productNutrientsMatch) {
      const basis = query.get('basis') || 'as_fed';
      if (!['as_fed', 'dm', 'per_1000_kcal'].includes(basis)) {
        return fail(res, 400, 'bad_basis', 'basis: as_fed | dm | per_1000_kcal');
      }
      const data = productNutrients(productNutrientsMatch[1], basis);
      if (!data) return fail(res, 404, 'not_found', 'Продукт не найден');
      ok(res, data);
      return;
    }

    if (pathname === '/v1/breeds') {
      const result = listBreeds(query);
      ok(res, result.data, result.meta);
      return;
    }

    const breedMatch = pathname.match(/^\/v1\/breeds\/(\d+)$/);
    if (breedMatch) {
      const breed = getBreed(breedMatch[1]);
      if (!breed) return fail(res, 404, 'not_found', 'Порода не найдена');
      ok(res, breed);
      return;
    }

    const breedPredispositionsMatch = pathname.match(/^\/v1\/breeds\/(\d+)\/predispositions$/);
    if (breedPredispositionsMatch) {
      const breed = getBreed(breedPredispositionsMatch[1]);
      if (!breed) return fail(res, 404, 'not_found', 'Порода не найдена');
      ok(res, breed.predispositions, { count: breed.predispositions.length });
      return;
    }

    if (pathname === '/v1/search') {
      const result = search(query);
      ok(res, result.data, result.meta);
      return;
    }

    fail(res, 404, 'not_found', 'Неизвестный маршрут');
  } catch (error) {
    console.error(error);
    fail(res, 500, 'internal_error', 'Внутренняя ошибка');
  }
}

function createServer() {
  return http.createServer(handle);
}

module.exports = { createServer, db };

if (require.main === module) {
  const port = Number.parseInt(process.env.PETDATA_PORT || '8787', 10);
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`PetData API: http://127.0.0.1:${port}/v1/health`);
    console.log(`DB: ${DB_PATH}`);
  });
}
