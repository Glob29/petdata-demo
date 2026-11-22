'use strict';

const path = require('node:path');
const { cleanProductName, nameKey } = require('../../db/name-utils');

const ANIMAL_SOURCE_RULES = [
  ['chicken', /курин|курица|цыпл|chicken/i],
  ['turkey', /индейк|turkey/i],
  ['duck', /утк|утка|duck/i],
  ['beef', /говяд|телят|beef|veal/i],
  ['lamb', /баран|ягнен|lamb/i],
  ['pork', /свин|pork/i],
  ['rabbit', /кролик|rabbit/i],
  ['salmon', /лосос|salmon/i],
  ['whitefish', /рыб|треск|тунец|сельд|форел|fish|cod|tuna|herring/i],
  ['dairy', /молок|сыворот|казеин|dairy|milk|whey|casein/i],
  ['egg', /яйц|egg/i]
];

const ALLERGEN_RULES = [
  ['poultry', /курин|курица|цыпл|индейк|утк|птиц|chicken|turkey|duck|poultry/i],
  ['mammalian', /говяд|телят|баран|ягнен|свин|олен|beef|veal|lamb|pork|venison/i],
  ['dairy', /молок|сыворот|казеин|dairy|milk|whey|casein/i],
  ['fish', /рыб|лосос|треск|тунец|сельд|форел|fish|salmon|cod|tuna|herring/i],
  ['egg', /яйц|egg/i],
  ['wheat', /пшениц|глютен|wheat|gluten/i],
  ['soy', /соя|соев|soy/i],
  ['corn', /кукуруз|corn|maize/i],
  ['rice', /рис|rice/i],
  ['legumes', /горох|чечевиц|нут|peas|lentil|chickpea/i]
];

function plain(row) {
  return row ? { ...row } : null;
}

function get(db, sql, ...params) {
  return plain(db.prepare(sql).get(...params));
}

function all(db, sql, ...params) {
  return db.prepare(sql).all(...params).map(plain);
}

function ensureSource(db, config) {
  let row = get(db, 'SELECT id FROM source WHERE name = ?', config.source_name);
  if (row) return row.id;
  const result = db
    .prepare(
      `INSERT INTO source (kind, name, url, license, reliability, notes)
       VALUES ('manufacturer', ?, ?, 'ToS сайта', 4, 'Автоматический сбор агентом')`
    )
    .run(config.source_name, config.site);
  return Number(result.lastInsertRowid);
}

function ensureManufacturer(db, name) {
  let row = get(db, 'SELECT id FROM manufacturer WHERE name = ?', name);
  if (row) return row.id;
  const result = db.prepare('INSERT INTO manufacturer (name) VALUES (?)').run(name);
  return Number(result.lastInsertRowid);
}

function ensureBrand(db, brandName, manufacturerId) {
  let row = get(db, 'SELECT id FROM brand WHERE name = ?', brandName);
  if (row) return row.id;
  const result = db.prepare('INSERT INTO brand (manufacturer_id, name) VALUES (?, ?)').run(manufacturerId, brandName);
  return Number(result.lastInsertRowid);
}

function insertProduct(db, brandId, draft, sourceId, url) {
  const cleanedName = cleanProductName(draft.name) || draft.name;
  const key = nameKey(cleanedName);
  draft.name = cleanedName;

  const existing = get(
    db,
    `SELECT id FROM product
      WHERE brand_id = ? AND name_key = ? AND species = ? AND form = ? AND market = 'RU'`,
    brandId,
    key,
    draft.species,
    draft.form
  );
  if (existing) return { id: existing.id, created: false };

  const result = db.prepare(
    `INSERT INTO product
      (brand_id, name, name_key, species, life_stage, size_class, form, completeness,
       therapeutic, market, language, source_id, source_url, confidence, updated_at)
     VALUES (?, ?, ?, ?, 'unknown', 'all', ?, ?, 0, 'RU', 'ru', ?, ?, 0.7, ?)`
  ).run(
    brandId,
    cleanedName,
    key,
    draft.species,
    draft.form,
    draft.completeness,
    sourceId,
    url,
    new Date().toISOString().slice(0, 10)
  );

  return { id: Number(result.lastInsertRowid), created: true };
}

function insertSourcePage(db, productId, sourceId, url) {
  db.prepare(
    `INSERT OR IGNORE INTO product_source_page (product_id, source_id, url, fetched_at, status)
     VALUES (?, ?, ?, ?, 'parsed')`
  ).run(productId, sourceId, url, new Date().toISOString().slice(0, 10));
}

function insertPackage(db, productId, draft, sourceId) {
  const weights = (draft.weights_g && draft.weights_g.length ? draft.weights_g : [draft.weight_g])
    .filter((weight) => weight)
    .sort((a, b) => a - b);
  if (!weights.length) return null;

  let primary = null;
  for (const weight of weights) {
    const exists = get(db, 'SELECT id FROM package WHERE product_id = ? AND weight_g = ?', productId, weight);
    const id = exists
      ? exists.id
      : Number(
          db
            .prepare(
              'INSERT INTO package (product_id, weight_g, pack_count, gtin, currency, region, source_id) VALUES (?, ?, 1, ?, ?, ?, ?)'
            )
            .run(productId, weight, weight === draft.weight_g ? draft.gtin || null : null, 'RUB', 'RU', sourceId)
            .lastInsertRowid
        );
    if (primary === null) primary = id;
  }
  return primary;
}

function insertPriceSnapshot(db, productId, packageId, draft, sourceId, url) {
  if (!packageId || !draft.price) return;
  db.prepare(
    `INSERT INTO price_snapshot (product_id, package_id, price, currency, region, retailer, url, observed_at)
     VALUES (?, ?, ?, ?, 'RU', ?, ?, ?)`
  ).run(productId, packageId, draft.price, draft.currency || 'RUB', draft.retailer || null, url, new Date().toISOString().slice(0, 10));
}

function nutrientMap(db) {
  return Object.fromEntries(all(db, 'SELECT id, code FROM nutrient').map((row) => [row.code, row.id]));
}

function insertNutrients(db, productId, draft, sourceId, nutrients) {
  const insert = db.prepare(
    `INSERT INTO product_nutrient
      (product_id, nutrient_id, amount, unit, basis, value_type, method, source_id, confidence, valid_from)
     VALUES (?, ?, ?, ?, 'as_fed', ?, 'agent_regex', ?, 0.7, ?)`
  );
  const today = new Date().toISOString().slice(0, 10);
  for (const row of draft.nutrients) {
    const nutrientId = nutrients[row.code];
    if (!nutrientId || row.amount == null) continue;
    insert.run(productId, nutrientId, row.amount, row.unit, row.value_type, sourceId, today);
  }
}

function parseIngredients(composition) {
  if (!composition) return [];
  const cleaned = composition.replace(/^Состав\s*[:\-]?\s*/i, '').trim();
  return cleaned
    .split(/[,;]/)
    .map((part) => part.trim().replace(/\.$/, ''))
    .filter((part) => part.length >= 2 && part.length <= 120)
    .slice(0, 40)
    .map((part, index) => {
      const percentMatch = part.match(/(\d+[.,]?\d*)\s*%/);
      const percent = percentMatch ? Number(percentMatch[1].replace(',', '.')) : null;
      const name = part.replace(/\s*\(\s*\d+[.,]?\d*\s*%\s*\)/, '').replace(/\s*\(\s*$/, '').trim();
      const allergen = ALLERGEN_RULES.find(([, regex]) => regex.test(name))?.[0] || null;
      return { name, percent, position: index + 1, allergen };
    })
    .filter((item) => item.name.length >= 2);
}

function insertIngredients(db, productId, draft) {
  const ingredients = parseIngredients(draft.composition);
  const insertIngredient = db.prepare(
    'INSERT INTO ingredient (name_ru, animal_origin, allergen_group) VALUES (?, ?, ?)'
  );
  const insertLink = db.prepare(
    'INSERT INTO product_ingredient (product_id, ingredient_id, position, percent, percent_type) VALUES (?, ?, ?, ?, ?)'
  );

  for (const item of ingredients) {
    let row = get(db, 'SELECT id FROM ingredient WHERE name_ru = ?', item.name);
    if (!row) {
      const animal = ANIMAL_SOURCE_RULES.some(([, regex]) => regex.test(item.name)) ? 1 : 0;
      const result = insertIngredient.run(item.name, animal, item.allergen);
      row = { id: Number(result.lastInsertRowid) };
    }
    insertLink.run(productId, row.id, item.position, item.percent, item.percent ? 'as_fed' : 'unknown');
  }
  return ingredients.length;
}

function inferProteinSources(composition) {
  if (!composition) return [];
  const proteinText = composition
    .split(/[,;]/)
    .filter((part) => !/жир|масло|oil|fat/i.test(part))
    .join(', ');
  if (!proteinText) return [];

  const found = [];
  for (const [code, regex] of ANIMAL_SOURCE_RULES) {
    if (!regex.test(proteinText)) continue;
    const part = proteinText
      .split(/[,;]/)
      .find((item) => regex.test(item) && !/жир|масло|oil|fat/i.test(item));
    if (!part) continue;
    const percent = part.match(/(\d+[.,]?\d*)\s*%/)?.[1] ?? null;
    found.push({
      code,
      percent: percent ? Number(percent.replace(',', '.')) : null,
      hydrolyzed: /гидролиз/i.test(part),
      index: proteinText.toLowerCase().indexOf(part.toLowerCase())
    });
  }
  found.sort((a, b) => a.index - b.index);
  if (!found.length && /птиц|poultry/i.test(proteinText)) {
    found.push({ code: 'poultry_unspecified', percent: null, hydrolyzed: false, index: 0 });
  }
  return found.map((item, index) => ({ ...item, role: index === 0 ? 'primary' : 'secondary' }));
}

function insertProteinSources(db, productId, draft, sourceId) {
  const sources = all(db, 'SELECT id, code FROM protein_source');
  const byCode = Object.fromEntries(sources.map((row) => [row.code, row.id]));
  const insert = db.prepare(
    `INSERT INTO product_protein_source
      (product_id, protein_source_id, role, declared_percent, is_hydrolyzed, source_id, confidence)
     VALUES (?, ?, ?, ?, ?, ?, 0.6)`
  );
  const inferred = inferProteinSources(draft.composition);
  for (const item of inferred) {
    if (!byCode[item.code]) continue;
    insert.run(productId, byCode[item.code], item.role, item.percent, item.hydrolyzed ? 1 : 0, sourceId);
  }
  return inferred.length;
}

function classifyCertificate(link) {
  const text = `${link.url} ${link.text}`.toLowerCase();
  if (/декларац|declaration/.test(text)) return 'declaration';
  if (/ветеринар|vet/.test(text)) return 'vet_certificate';
  if (/сертификат|certificate/.test(text)) return 'quality';
  return 'unknown';
}

function insertCertificates(db, productId, brandId, draft, sourceId) {
  const insert = db.prepare(
    `INSERT INTO certificate
      (product_id, brand_id, scope, type, number, url, status, source_id, observed_at)
     VALUES (?, ?, 'product', ?, ?, ?, 'found', ?, ?)`
  );
  for (const link of draft.certificates || []) {
    const number = link.text.match(/(?:№|N)\s*([A-ZА-Я0-9-]{5,})/i)?.[1] || null;
    insert.run(productId, brandId, classifyCertificate(link), number, link.url, sourceId, new Date().toISOString().slice(0, 10));
  }
  return (draft.certificates || []).length;
}

function insertBrandCertificate(db, brandId, sourceId, { type = 'unknown', number = null, url = null, status = 'found', notes = null }) {
  if (status === 'not_found') {
    const exists = get(db, "SELECT id FROM certificate WHERE brand_id = ? AND status = 'not_found'", brandId);
    if (exists) return;
  } else if (url) {
    const exists = get(db, 'SELECT id FROM certificate WHERE brand_id = ? AND url = ?', brandId, url);
    if (exists) return;
  }

  db.prepare(
    `INSERT INTO certificate
      (brand_id, scope, type, number, url, status, notes, source_id, observed_at)
     VALUES (?, 'brand', ?, ?, ?, ?, ?, ?, ?)`
  ).run(brandId, type, number, url, status, notes, sourceId, new Date().toISOString().slice(0, 10));
}

function insertSearchIndex(db, productId, draft, brandName) {
  db.prepare('DELETE FROM product_fts WHERE product_id = ?').run(productId);
  db.prepare('INSERT INTO product_fts (product_id, name, brand, composition) VALUES (?, ?, ?, ?)').run(
    productId,
    draft.name || '',
    brandName,
    draft.composition || ''
  );
}

function logRun(db, sourceId, url, status, confidence, rawPath, error = null) {
  db.prepare(
    `INSERT INTO extraction_run (source_id, url, parser, model, schema_version, status, confidence, raw_path, error)
     VALUES (?, ?, 'html', 'rules-v0.1', 'petdata-1', ?, ?, ?, ?)`
  ).run(sourceId, url, status, confidence, rawPath || null, error);
}

module.exports = {
  ensureSource,
  ensureManufacturer,
  ensureBrand,
  insertProduct,
  insertSourcePage,
  insertPackage,
  insertPriceSnapshot,
  nutrientMap,
  insertNutrients,
  parseIngredients,
  insertIngredients,
  inferProteinSources,
  insertProteinSources,
  insertCertificates,
  insertBrandCertificate,
  insertSearchIndex,
  logRun
};
