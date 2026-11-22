#!/usr/bin/env node
'use strict';

/*
 * Экспорт собранной базы в автономный HTML-отчёт.
 * Запуск: node agent/export-html.js
 * Результат: report/index.html
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.join(__dirname, '..');
const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
const outDir = path.join(root, 'report');
const outFile = path.join(outDir, 'index.html');

if (!fs.existsSync(dbPath)) throw new Error(`Нет базы: ${dbPath}. Запустите node db/import.js`);

const db = new DatabaseSync(dbPath);
const all = (sql, ...params) => db.prepare(sql).all(...params).map((row) => ({ ...row }));
const get = (sql, ...params) => {
  const row = db.prepare(sql).get(...params);
  return row ? { ...row } : null;
};

const productRows = all(`
  SELECT p.*, b.name AS brand_name, m.name AS manufacturer_name
    FROM product p
    JOIN brand b ON b.id = p.brand_id
    LEFT JOIN manufacturer m ON m.id = b.manufacturer_id
   ORDER BY b.name, p.name
`);

const nutrientRows = all(`
  SELECT pn.product_id, n.code, n.name_ru, n.unit, n.category, n.sort_order,
         pn.amount, pn.basis, pn.value_type, pn.confidence
    FROM product_nutrient pn
    JOIN nutrient n ON n.id = pn.nutrient_id
   WHERE pn.basis = 'as_fed'
   ORDER BY pn.product_id, n.sort_order, n.code
`);

const ingredientRows = all(`
  SELECT pi.product_id, i.name_ru, i.animal_origin, i.allergen_group,
         pi.position, pi.percent, pi.percent_type
    FROM product_ingredient pi
    JOIN ingredient i ON i.id = pi.ingredient_id
   ORDER BY pi.product_id, pi.position
`);

const allergenRows = all(`
  SELECT pps.product_id, ps.code, ps.name_ru, ps.group_code, ag.name_ru AS group_name,
         pps.role, pps.declared_percent, pps.is_hydrolyzed
    FROM product_protein_source pps
    JOIN protein_source ps ON ps.id = pps.protein_source_id
    JOIN allergen_group ag ON ag.code = ps.group_code
   ORDER BY pps.product_id,
            CASE pps.role WHEN 'primary' THEN 1 WHEN 'secondary' THEN 2 ELSE 3 END
`);

const priceRows = all('SELECT product_id, price, currency, retailer, observed_at FROM price_snapshot ORDER BY price');
const packageRows = all(`
  SELECT product_id, weight_g, COALESCE(total_weight_g, weight_g) AS total_weight_g,
         price_avg, price_per_g
    FROM package
   ORDER BY COALESCE(total_weight_g, weight_g)`);

// Вес упаковки в естественных единицах и диапазон, если у SKU несколько фасовок.
const gramsLabel = (value) => {
  if (value == null) return '—';
  const inKg = value >= 1000;
  const text = Number(inKg ? value / 1000 : value).toLocaleString('ru-RU', {
    maximumFractionDigits: value % 1000 === 0 ? 0 : 1
  });
  return inKg ? text + ' кг' : text + ' г';
};
// Для SKU с несколькими фасовками убираем из названия хвост размера («, 400 гр»):
// он относится к варианту по умолчанию и противоречит списку фасовок.
const SIZE_SUFFIX = /(?:,\s*|\s+)\d+(?:[.,]\d+)?\s*(?:г|гр|кг)\.?$/i;
const displayName = (name, packageCount) => {
  if (!name || !packageCount || packageCount <= 1) return name;
  const stripped = name.replace(SIZE_SUFFIX, '').replace(/[,\s]+$/, '');
  return stripped || name;
};

const weightLabel = (min, max, count) => {
  if (min == null) return '—';
  if (count > 1 && max != null && max !== min) return `${gramsLabel(min)} – ${gramsLabel(max)}`;
  return gramsLabel(min);
};

const certRows = all(`
  SELECT c.*, b.name AS brand_name, p.name AS product_name
    FROM certificate c
    LEFT JOIN brand b ON b.id = c.brand_id
    LEFT JOIN product p ON p.id = c.product_id
   ORDER BY c.status, b.name
`);

const breedRows = all('SELECT * FROM breed ORDER BY species, name_ru');
const weightRows = all('SELECT * FROM breed_weight');
const predispositions = all(`
  SELECT bp.breed_id, c.code, c.name_ru, c.category, bp.prevalence_text,
         bp.evidence_level, bp.age_of_onset, bp.notes, s.name AS source_name
    FROM breed_predisposition bp
    JOIN condition c ON c.id = bp.condition_id
    LEFT JOIN source s ON s.id = bp.source_id
   ORDER BY bp.breed_id,
            CASE bp.evidence_level WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END
`);
const geneticTests = all('SELECT breed_id, gene, mutation, inheritance, test_available FROM genetic_test');

const byProduct = (rows, key = 'product_id') => {
  const map = {};
  for (const row of rows) {
    if (!map[row[key]]) map[row[key]] = [];
    map[row[key]].push(row);
  }
  return map;
};

const nutrientsByProduct = byProduct(nutrientRows);
const ingredientsByProduct = byProduct(ingredientRows);
const allergensByProduct = byProduct(allergenRows);
const pricesByProduct = byProduct(priceRows);
const packagesByProduct = byProduct(packageRows);
const certsByProduct = byProduct(certRows.filter((row) => row.product_id), 'product_id');
const weightsByBreed = byProduct(weightRows, 'breed_id');
const predispositionsByBreed = byProduct(predispositions, 'breed_id');
const testsByBreed = byProduct(geneticTests, 'breed_id');

const products = productRows.map((row) => {
  const allergens = allergensByProduct[row.id] || [];
  const groups = [...new Set(allergens.map((item) => item.group_code))];
  const mayContain = [...new Set(allergens.filter((item) => item.code.endsWith('_unspecified')).map((item) => item.group_code))];
  const prices = pricesByProduct[row.id] || [];
  const priceValues = prices.map((item) => item.price).filter((value) => value != null);

  return {
    id: row.id,
    brand: row.brand_name,
    manufacturer: row.manufacturer_name,
    name: row.name,
    species: row.species,
    life_stage: row.life_stage,
    form: row.form,
    completeness: row.completeness,
    therapeutic: Boolean(row.therapeutic),
    market: row.market,
    confidence: row.confidence,
    updated_at: row.updated_at,
    source_url: row.source_url,
    display_name: displayName(row.name, (packagesByProduct[row.id] || []).length),
    weight_g: (packagesByProduct[row.id] || [])[0]?.weight_g ?? null,
    price_per_g_min: (() => {
      const priced = (packagesByProduct[row.id] || []).filter((item) => item.price_per_g != null);
      return priced.length ? Math.min(...priced.map((item) => item.price_per_g)) : null;
    })(),
    price_per_g_max: (() => {
      const priced = (packagesByProduct[row.id] || []).filter((item) => item.price_per_g != null);
      return priced.length ? Math.max(...priced.map((item) => item.price_per_g)) : null;
    })(),
    weight_max_g: (packagesByProduct[row.id] || []).at(-1)?.weight_g ?? null,
    package_count: (packagesByProduct[row.id] || []).length,
    weight_label: weightLabel(
      (packagesByProduct[row.id] || [])[0]?.weight_g ?? null,
      (packagesByProduct[row.id] || []).at(-1)?.weight_g ?? null,
      (packagesByProduct[row.id] || []).length
    ),
    nutrients: (nutrientsByProduct[row.id] || []).map((item) => ({
      code: item.code,
      name: item.name_ru,
      category: item.category,
      amount: item.amount,
      unit: item.unit,
      value_type: item.value_type,
      confidence: item.confidence
    })),
    ingredients: (ingredientsByProduct[row.id] || []).map((item) => ({
      name: item.name_ru,
      position: item.position,
      percent: item.percent,
      animal_origin: item.animal_origin == null ? null : Boolean(item.animal_origin),
      allergen_group: item.allergen_group
    })),
    allergens: {
      sources: allergens.map((item) => ({
        code: item.code,
        name: item.name_ru,
        group: item.group_code,
        group_name: item.group_name,
        role: item.role,
        percent: item.declared_percent,
        hydrolyzed: Boolean(item.is_hydrolyzed)
      })),
      groups,
      may_contain: mayContain
    },
    certificates: (certsByProduct[row.id] || []).map((item) => ({
      type: item.type,
      status: item.status,
      url: item.url,
      number: item.number,
      notes: item.notes
    })),
    prices: priceValues.length
      ? {
          min: Math.min(...priceValues),
          max: Math.max(...priceValues),
          currency: prices[0].currency,
          observations: prices.length
        }
      : null
  };
});

const breeds = breedRows.map((row) => ({
  id: row.id,
  species: row.species,
  name: row.name_ru,
  name_en: row.name_en,
  fci_group: row.fci_group,
  origin_country: row.origin_country,
  size_class: row.size_class,
  height_min_cm: row.height_min_cm,
  height_max_cm: row.height_max_cm,
  weight_min_kg: row.weight_min_kg,
  weight_max_kg: row.weight_max_kg,
  lifespan_min_years: row.lifespan_min_years,
  lifespan_max_years: row.lifespan_max_years,
  coat_type: row.coat_type,
  coat_length: row.coat_length,
  grooming_level: row.grooming_level,
  brachycephalic: Boolean(row.brachycephalic),
  exercise_level: row.exercise_level,
  temperament: row.temperament,
  weights: (weightsByBreed[row.id] || []).map((item) => ({
    sex: item.sex,
    age_stage: item.age_stage,
    min_kg: item.min_kg,
    max_kg: item.max_kg
  })),
  predispositions: (predispositionsByBreed[row.id] || []).map((item) => ({
    code: item.code,
    name: item.name_ru,
    category: item.category,
    prevalence_text: item.prevalence_text,
    evidence_level: item.evidence_level,
    age_of_onset: item.age_of_onset,
    notes: item.notes,
    source: item.source_name
  })),
  genetic_tests: (testsByBreed[row.id] || []).map((item) => ({
    gene: item.gene,
    mutation: item.mutation,
    inheritance: item.inheritance,
    test_available: Boolean(item.test_available)
  }))
}));

const count = (sql) => get(sql).n;
const coverage = {
  products: count('SELECT COUNT(*) AS n FROM product'),
  brands: count('SELECT COUNT(DISTINCT brand_id) AS n FROM product'),
  nutrients: count('SELECT COUNT(*) AS n FROM nutrient'),
  product_nutrients: count('SELECT COUNT(*) AS n FROM product_nutrient'),
  breeds: count('SELECT COUNT(*) AS n FROM breed'),
  predispositions: count('SELECT COUNT(*) AS n FROM breed_predisposition'),
  certificates: count('SELECT COUNT(*) AS n FROM certificate'),
  found_certificates: count("SELECT COUNT(*) AS n FROM certificate WHERE status = 'found'"),
  not_found_certificates: count("SELECT COUNT(*) AS n FROM certificate WHERE status = 'not_found'"),
  products_with_me: count("SELECT COUNT(DISTINCT pn.product_id) AS n FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id WHERE n.code = 'me'"),
  products_with_moisture: count("SELECT COUNT(DISTINCT pn.product_id) AS n FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id WHERE n.code = 'moisture'"),
  products_with_price: count('SELECT COUNT(DISTINCT product_id) AS n FROM price_snapshot'),
  fts_documents: count('SELECT COUNT(*) AS n FROM product_fts')
};

const data = {
  generated_at: new Date().toISOString(),
  coverage,
  products,
  breeds,
  certificates: certRows.map((row) => ({
    id: row.id,
    brand: row.brand_name,
    product_id: row.product_id,
    product_name: row.product_name,
    type: row.type,
    number: row.number,
    status: row.status,
    url: row.url,
    notes: row.notes,
    observed_at: row.observed_at
  }))
};

/* -------------------------------------------------------------------------- */
/* Статический HTML: виден даже если браузер/просмотрщик не выполняет JS       */
/* -------------------------------------------------------------------------- */

const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const num = (value, digits = 1) => value == null ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits });
const pct = (value) => value == null ? '—' : num(value) + '%';
const pricePerGramLabel = (min, max) => {
  if (min == null) return '<span class="muted">нет цены</span>';
  if (max != null && max !== min) return num(min, 4) + '–' + num(max, 4) + ' ₽/г';
  return num(min, 4) + ' ₽/г';
};
const kcal = (value) => value == null ? '—' : num(value, 0) + ' ккал/кг';
const nutrientOf = (product, code) => (product.nutrients.find((item) => item.code === code) || {}).amount;

function brandHasCertificate(brand) {
  return data.certificates.some((cert) => cert.brand === brand && cert.status === 'found');
}

function productHasCertificate(product) {
  return product.certificates.some((cert) => cert.status === 'found') || brandHasCertificate(product.brand);
}

function staticProductRow(product) {
  const allergens = product.allergens.sources.map((item) => item.name).join(', ');
  const may = product.allergens.may_contain.length ? ' / может: ' + product.allergens.may_contain.join(', ') : '';
  const cert = productHasCertificate(product)
    ? '<span class="badge green">найден</span>'
    : '<span class="badge red">не найден</span>';
  const completeness = product.completeness === 'complete'
    ? '<span class="badge green">полный</span>'
    : product.completeness === 'complementary'
      ? '<span class="badge amber">дополнительный</span>'
      : '<span class="badge">не указан</span>';
  return '<tr data-id="' + product.id + '" data-species="' + product.species + '" data-brand="' + esc(product.brand) + '" data-has-me="' + (nutrientOf(product, 'me') != null ? 1 : 0) + '" data-has-cert="' + (productHasCertificate(product) ? 1 : 0) + '">' +
    '<td><b>' + esc(product.brand) + '</b></td>' +
    '<td>' + esc(product.display_name || product.name) + '<div class="muted small">' + esc(product.manufacturer || '') + '</div></td>' +
    '<td>' + (product.species === 'cat' ? 'кошка' : 'собака') + '</td>' +
    '<td>' + esc(product.form || '—') + '</td>' +
    '<td>' + completeness + '</td>' +
    '<td class="num">' + pct(nutrientOf(product, 'protein')) + '</td>' +
    '<td class="num">' + pct(nutrientOf(product, 'fat')) + '</td>' +
    '<td class="num">' + kcal(nutrientOf(product, 'me')) + '</td>' +
    '<td class="num">' + (product.weight_label || '—') + '</td>' + '<td class="num">' + pricePerGramLabel(product.price_per_g_min, product.price_per_g_max) + '</td>' +
    '<td class="small">' + esc(allergens || '—') + '<div class="muted">' + esc(may) + '</div></td>' +
    '<td>' + cert + '</td>' +
    '<td>' + (product.source_url ? '<a href="' + esc(product.source_url) + '" target="_blank" rel="noopener">открыть</a>' : '—') + '</td>' +
    '</tr>';
}

const staticProductRows = products.map(staticProductRow).join('');

function productCardsFor(rows) {
  return [
    ['SKU', rows.length],
    ['Брендов', new Set(rows.map((product) => product.brand)).size],
    ['С ME', rows.filter((product) => nutrientOf(product, 'me') != null).length],
    ['Без сертификата', rows.filter((product) => !productHasCertificate(product)).length]
  ].map(([label, value]) => '<div class="card"><div class="num">' + value + '</div><div class="lbl">' + label + '</div></div>').join('');
}

const staticProductCards = productCardsFor(products);

function staticBreedRow(breed) {
  const height = breed.height_min_cm || breed.height_max_cm ? num(breed.height_min_cm) + '–' + num(breed.height_max_cm) + ' см' : '—';
  const weight = breed.weight_min_kg || breed.weight_max_kg ? num(breed.weight_min_kg) + '–' + num(breed.weight_max_kg) + ' кг' : '—';
  const life = breed.lifespan_min_years || breed.lifespan_max_years ? num(breed.lifespan_min_years) + '–' + num(breed.lifespan_max_years) + ' лет' : '—';
  return '<tr data-breed="' + breed.id + '">' +
    '<td><b>' + esc(breed.name) + '</b><div class="muted small">' + esc(breed.name_en || '') + '</div></td>' +
    '<td>' + (breed.species === 'cat' ? 'кошка' : 'собака') + '</td>' +
    '<td>' + esc(breed.size_class || '—') + '</td>' +
    '<td>' + height + '</td><td>' + weight + '</td><td>' + life + '</td>' +
    '<td>' + esc(breed.coat_type || '—') + '<div class="muted small">' + esc(breed.grooming_level || '') + '</div></td>' +
    '<td>' + (breed.brachycephalic ? '<span class="badge amber">да</span>' : 'нет') + '</td>' +
    '<td>' + breed.predispositions.length + '</td>' +
    '</tr>';
}
const staticBreedRows = breeds.map(staticBreedRow).join('');
const staticBreedCards = [
  ['Пород', coverage.breeds],
  ['Собак', breeds.filter((breed) => breed.species === 'dog').length],
  ['Кошек', breeds.filter((breed) => breed.species === 'cat').length],
  ['Рисков', coverage.predispositions]
].map(([label, value]) => '<div class="card"><div class="num">' + value + '</div><div class="lbl">' + label + '</div></div>').join('');

const staticCertRows = data.certificates.map((cert) =>
  '<tr><td>' + esc(cert.brand || '—') + '</td><td>' + esc(cert.product_name || '—') + '</td>' +
  '<td>' + esc(cert.type || '—') + '</td>' +
  '<td>' + (cert.status === 'found' ? '<span class="badge green">found</span>' : '<span class="badge red">not_found</span>') + '</td>' +
  '<td>' + esc(cert.number || '—') + '</td>' +
  '<td>' + (cert.url ? '<a href="' + esc(cert.url) + '" target="_blank" rel="noopener">открыть</a>' : '—') + '</td>' +
  '<td class="small">' + esc(cert.notes || '') + '</td></tr>').join('');

const staticCoverageCards = [
  ['SKU', coverage.products],
  ['Брендов', coverage.brands],
  ['Нутриентов', coverage.nutrients],
  ['Строк нутриентов', coverage.product_nutrients],
  ['Пород', coverage.breeds],
  ['Рисков', coverage.predispositions],
  ['Сертификатов', coverage.certificates],
  ['Найдено', coverage.found_certificates],
  ['Не найдено', coverage.not_found_certificates]
].map(([label, value]) => '<div class="card"><div class="num">' + value + '</div><div class="lbl">' + label + '</div></div>').join('');

const withMe = products.filter((product) => nutrientOf(product, 'me') != null).length;
const withMoisture = products.filter((product) => nutrientOf(product, 'moisture') != null).length;
const unknownCompleteness = products.filter((product) => product.completeness === 'unknown').length;
const noCertificates = products.filter((product) => !productHasCertificate(product)).length;
const staticCoverageDetails =
  '<div class="box"><h3>Полнота</h3><div class="kv">' +
    '<span class="k">SKU с ME</span><span class="v">' + withMe + ' / ' + coverage.products + '</span>' +
    '<span class="k">SKU с влагой</span><span class="v">' + withMoisture + ' / ' + coverage.products + '</span>' +
    '<span class="k">Полнорационность не указана</span><span class="v">' + unknownCompleteness + '</span>' +
    '<span class="k">Без найденного сертификата</span><span class="v">' + noCertificates + '</span>' +
    '<span class="k">FTS-документов</span><span class="v">' + coverage.fts_documents + '</span>' +
  '</div></div>' +
  '<div class="box"><h3>Бренды</h3><ul class="clean">' +
    [...new Set(products.map((product) => product.brand))].sort().map((brand) => '<li>' + esc(brand) + '</li>').join('') +
  '</ul></div>' +
  '<div class="box"><h3>Что проверить</h3><ul class="clean">' +
    '<li>ME отсутствует у ' + (coverage.products - withMe) + ' SKU</li>' +
    '<li>Влага отсутствует у ' + (coverage.products - withMoisture) + ' SKU</li>' +
    '<li>Сертификаты: ' + coverage.not_found_certificates + ' записей not_found</li>' +
    '<li>Полнорационность unknown: ' + unknownCompleteness + ' SKU</li>' +
  '</ul></div>';

const staticBrandOptions = '<option value="">Все бренды</option>' +
  [...new Set(products.map((product) => product.brand))].sort()
    .map((brand) => '<option value="' + esc(brand) + '">' + esc(brand) + '</option>').join('');

const brandList = [...new Set(products.map((product) => product.brand))].sort();

const productClasses = [...new Set(products.map((product) => product.class).filter(Boolean))].sort();

function optionsFor(pairs, selected) {
  return pairs.map(([value, label]) =>
    '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>'
  ).join('');
}

/*
 * Нормальная форма фильтров: поиск, вид, бренд, тип, полнорационность, класс, сортировка.
 * Раньше здесь был только ряд чипов-ссылок на статические страницы — по ним нельзя было
 * ни искать, ни комбинировать фильтры.
 */
function productFilterForm(activeSpecies, activeBrand) {
  const species = activeSpecies === 'all' ? '' : activeSpecies || '';
  const brand = activeBrand === 'all' ? '' : activeBrand || '';

  return '<form class="toolbar" id="filters" autocomplete="off" onsubmit="return false">' +
    '<input type="search" id="q" placeholder="Поиск: продукт, бренд, состав…" size="28">' +
    '<select id="species">' +
      optionsFor([['', 'Все виды'], ['cat', 'Кошки'], ['dog', 'Собаки']], species) + '</select>' +
    '<select id="brand">' +
      optionsFor([['', 'Все бренды'], ...brandList.map((name) => [name, name])], brand) + '</select>' +
    '<select id="form">' +
      optionsFor([['', 'Все типы'], ['dry', 'Сухой'], ['wet', 'Влажный'], ['unknown', 'Не указан']], '') + '</select>' +
    '<select id="completeness">' +
      optionsFor([['', 'Полнорационность'], ['complete', 'Полный'], ['complementary', 'Дополнительный'], ['unknown', 'Не указана']], '') + '</select>' +
    '<select id="class">' +
      optionsFor([['', 'Все классы'], ...productClasses.map((name) => [name, name])], '') + '</select>' +
    '<select id="sort">' +
      optionsFor([['brand', 'По бренду'], ['price_g', 'По ₽/г (дешевле)'], ['price_g_desc', 'По ₽/г (дороже)'], ['protein', 'По белку']], 'brand') + '</select>' +
    '<label><input type="checkbox" id="meOnly"> только с ME</label>' +
    '<label><input type="checkbox" id="priceOnly"> только с ценой</label>' +
    '<label><input type="checkbox" id="certOnly"> с сертификатом</label>' +
    '<button type="button" id="resetFilters">Сбросить</button>' +
    '<span class="muted small" id="count"></span>' +
    '</form>' +
    '<p class="muted small">Статическая версия без JS: <a href="index.html">все корма</a> · ' +
    '<a href="cats.html">кошки</a> · <a href="dogs.html">собаки</a></p>';
}

const staticSubtitle = coverage.products + ' SKU · ' + coverage.brands + ' брендов · ' +
  coverage.breeds + ' пород · сгенерировано ' + new Date(data.generated_at).toLocaleString('ru-RU');
const staticFooter = 'Данные: ' + coverage.product_nutrients + ' строк нутриентов, ' +
  coverage.predispositions + ' породных рисков. ' +
  'Отсутствующие значения показаны как «—»; сертификаты not_found — это результат поиска, а не ошибка отображения.';

const json = JSON.stringify(data).replace(/</g, '\\u003c');
const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PetData — собранная база</title>
<script>document.documentElement.classList.add('js');</script>
<style>
  :root {
    --bg: #f4f6f8; --panel: #ffffff; --ink: #18202a; --muted: #637083;
    --line: #dfe5ec; --accent: #1f6feb; --accent-soft: #e8f0fe;
    --green: #147a4b; --green-soft: #e6f6ee; --amber: #9a5b00; --amber-soft: #fff4dd;
    --red: #b42318; --red-soft: #fdecea; --gray: #5b6472; --gray-soft: #eef1f5;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
  header { background: #101828; color: #fff; padding: 24px 28px 18px; }
  header h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: -0.02em; }
  header p { margin: 0; color: #b9c2d0; font-size: 13px; }
  .wrap { max-width: 1500px; margin: 0 auto; padding: 20px 24px 48px; }
  .tabs { display: flex; gap: 6px; margin: 18px 0 14px; flex-wrap: wrap; }
  .tab { border: 1px solid var(--line); background: #fff; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: 600; color: var(--muted); }
  .tab.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .panel { display: block; }
  html.js .panel { display: none; }
  html.js .panel.active { display: block; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .card .num { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
  .card .lbl { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 12px 0; }
  .toolbar input, .toolbar select { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; background: #fff; color: var(--ink); font: inherit; }
  .toolbar input[type="search"] { min-width: 280px; }
  .toolbar label { display: inline-flex; gap: 6px; align-items: center; color: var(--muted); }
  .toolbar button { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; font: inherit; }
  .filterbar { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; margin: 12px 0; }
  .filter-group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .filter-group > span { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; margin-right: 2px; }
  .chip-link { display: inline-block; border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 6px 10px; font-size: 13px; color: var(--ink); text-decoration: none; }
  .chip-link:hover { border-color: var(--accent); text-decoration: none; }
  .chip-link.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .tablewrap { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: auto; max-height: 72vh; }
  table { width: 100%; border-collapse: collapse; min-width: 1100px; }
  th, td { padding: 9px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  th { position: sticky; top: 0; background: #f9fafb; z-index: 2; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); white-space: nowrap; }
  tbody tr:hover { background: #f8fbff; cursor: pointer; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .muted { color: var(--muted); }
  .small { font-size: 12px; }
  .badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 600; background: var(--gray-soft); color: var(--gray); white-space: nowrap; }
  .badge.green { background: var(--green-soft); color: var(--green); }
  .badge.amber { background: var(--amber-soft); color: var(--amber); }
  .badge.red { background: var(--red-soft); color: var(--red); }
  .badge.blue { background: var(--accent-soft); color: var(--accent); }
  .empty { padding: 18px; color: var(--muted); text-align: center; }
  .modal { position: fixed; inset: 0; background: rgba(16, 24, 40, 0.55); display: none; align-items: flex-start; justify-content: center; padding: 28px 16px; overflow: auto; z-index: 20; }
  .modal.open { display: flex; }
  .modal-card { background: #fff; border-radius: 14px; width: min(1000px, 100%); padding: 20px 22px 24px; position: relative; }
  .modal-close { position: absolute; right: 14px; top: 10px; border: 0; background: transparent; font-size: 26px; cursor: pointer; color: var(--muted); }
  .modal h2 { margin: 0 40px 4px 0; font-size: 20px; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 14px; }
  .box { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .box h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .kv { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; font-size: 13px; }
  .kv .k { color: var(--muted); }
  .kv .v { text-align: right; font-variant-numeric: tabular-nums; }
  ul.clean { margin: 0; padding-left: 18px; }
  ul.clean li { margin: 3px 0; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .note { background: #fff; border: 1px solid var(--line); border-left: 4px solid var(--amber); border-radius: 8px; padding: 10px 12px; margin: 12px 0; color: var(--muted); }
  .footer { color: var(--muted); font-size: 12px; margin-top: 18px; }
  @media (max-width: 700px) { header { padding: 18px; } .wrap { padding: 14px; } .toolbar input[type="search"] { min-width: 100%; } }
</style>
</head>
<body>
<header>
  <h1>PetData — собранная база</h1>
  <p id="subtitle">__SUBTITLE__</p>
</header>
<div class="wrap">
  <div class="tabs">
    <button class="tab active" data-tab="products">Корма</button>
    <button class="tab" data-tab="breeds">Породы</button>
    <button class="tab" data-tab="certificates">Сертификаты</button>
    <button class="tab" data-tab="coverage">Покрытие</button>
  </div>

  <section class="panel active" id="panel-products">
    <div class="cards" id="productCards">__PRODUCT_CARDS__</div>
    __FILTER_CONTROLS__
    <div class="tablewrap">
      <table>
        <thead><tr>
          <th>Бренд</th><th>Продукт</th><th>Вид</th><th>Тип</th><th>Полнорационность</th>
          <th>Белок</th><th>Жир</th><th>ME</th><th>Вес</th><th>₽/г</th><th>Аллергены</th><th>Сертификат</th><th>Источник</th>
        </tr></thead>
        <tbody id="productBody">__PRODUCT_ROWS__</tbody>
      </table>
    </div>
  </section>

  <section class="panel" id="panel-breeds">
    <div class="cards" id="breedCards">__BREED_CARDS__</div>
    <div class="tablewrap">
      <table>
        <thead><tr>
          <th>Порода</th><th>Вид</th><th>Размер</th><th>Высота</th><th>Вес</th><th>Жизнь</th>
          <th>Шерсть</th><th>Брахицефалия</th><th>Риски</th>
        </tr></thead>
        <tbody id="breedBody">__BREED_ROWS__</tbody>
      </table>
    </div>
  </section>

  <section class="panel" id="panel-certificates">
    <div class="note">Агент ищет декларации и сертификаты на карточках и страницах качества. Если документ не найден, он не выдумывается — создаётся запись <b>not_found</b>.</div>
    <div class="tablewrap">
      <table>
        <thead><tr><th>Бренд</th><th>Продукт</th><th>Тип</th><th>Статус</th><th>Номер</th><th>Ссылка</th><th>Комментарий</th></tr></thead>
        <tbody id="certBody">__CERT_ROWS__</tbody>
      </table>
    </div>
  </section>

  <section class="panel" id="panel-coverage">
    <div class="cards" id="coverageCards">__COVERAGE_CARDS__</div>
    <div class="grid2" id="coverageDetails">__COVERAGE_DETAILS__</div>
  </section>

  <div class="footer" id="footer">__FOOTER__</div>
</div>

<div class="modal" id="modal">
  <div class="modal-card">
    <button class="modal-close" id="modalClose">×</button>
    <div id="modalContent"></div>
  </div>
</div>

<script>
const DATA = __DATA__;
const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const num = (value, digits = 1) => value == null ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits });
const pct = (value) => value == null ? '—' : num(value) + '%';
const kcal = (value) => value == null ? '—' : num(value, 0) + ' ккал/кг';
const pricePerGramLabel = (min, max) => {
  if (min == null) return '—';
  if (max != null && max !== min) return num(min, 4) + '–' + num(max, 4) + ' ₽/г';
  return num(min, 4) + ' ₽/г';
};

function nutrient(product, code) {
  return (product.nutrients.find((item) => item.code === code) || {}).amount;
}

const CATEGORY = {
  macro: 'Макронутриенты', amino: 'Аминокислоты', fatty: 'Жирные кислоты',
  vitamin: 'Витамины', mineral: 'Минералы', energy: 'Энергия', other: 'Прочее'
};

const state = { q: '', species: '', brand: '', form: '', completeness: '', klass: '', sort: 'brand', meOnly: false, priceOnly: false, certOnly: false };

function brandHasCertificate(brand) {
  return DATA.certificates.some((cert) => cert.brand === brand && cert.status === 'found');
}

function productHasCertificate(product) {
  return product.certificates.some((cert) => cert.status === 'found') || brandHasCertificate(product.brand);
}

function productRows() {
  const rows = DATA.products.filter((product) => {
    if (state.species && product.species !== state.species) return false;
    if (state.brand && product.brand !== state.brand) return false;
    if (state.form && (product.form || 'unknown') !== state.form) return false;
    if (state.completeness && (product.completeness || 'unknown') !== state.completeness) return false;
    if (state.klass && (product.class || '') !== state.klass) return false;
    if (state.meOnly && nutrient(product, 'me') == null) return false;
    if (state.priceOnly && product.price_per_g_min == null) return false;
    if (state.certOnly && !productHasCertificate(product)) return false;
    if (state.q) {
      const haystack = [product.brand, product.name, product.display_name, product.manufacturer,
        ...product.ingredients.map((item) => item.name),
        ...product.allergens.sources.map((item) => item.name)].join(' ').toLowerCase();
      if (!haystack.includes(state.q)) return false;
    }
    return true;
  });

  const nameOf = (product) => (product.display_name || product.name || '').toLowerCase();
  const sorted = rows.slice();
  if (state.sort === 'price_g') {
    sorted.sort((a, b) => (a.price_per_g_min ?? Infinity) - (b.price_per_g_min ?? Infinity) || nameOf(a).localeCompare(nameOf(b), 'ru'));
  } else if (state.sort === 'price_g_desc') {
    sorted.sort((a, b) => (b.price_per_g_max ?? -Infinity) - (a.price_per_g_max ?? -Infinity) || nameOf(a).localeCompare(nameOf(b), 'ru'));
  } else if (state.sort === 'protein') {
    sorted.sort((a, b) => (nutrient(b, 'protein') ?? -1) - (nutrient(a, 'protein') ?? -1));
  } else {
    sorted.sort((a, b) => (a.brand || '').localeCompare(b.brand || '', 'ru') || nameOf(a).localeCompare(nameOf(b), 'ru'));
  }
  return sorted;
}

function renderProducts() {
  const rows = productRows();
  document.getElementById('count').textContent = rows.length + ' из ' + DATA.products.length + ' SKU';
  document.getElementById('productBody').innerHTML = rows.map((product) => {
    const allergens = product.allergens.sources.map((item) => item.name).join(', ');
    const may = product.allergens.may_contain.length ? ' / может: ' + product.allergens.may_contain.join(', ') : '';
    const cert = productHasCertificate(product)
      ? '<span class="badge green">найден</span>'
      : '<span class="badge red">не найден</span>';
    const completeness = product.completeness === 'complete'
      ? '<span class="badge green">полный</span>'
      : product.completeness === 'complementary'
        ? '<span class="badge amber">дополнительный</span>'
        : '<span class="badge">не указан</span>';
    return '<tr data-id="' + product.id + '" data-species="' + product.species + '" data-brand="' + esc(product.brand) + '" data-has-me="' + (nutrientOf(product, 'me') != null ? 1 : 0) + '" data-has-cert="' + (productHasCertificate(product) ? 1 : 0) + '">' +
      '<td><b>' + esc(product.brand) + '</b></td>' +
      '<td>' + esc(product.display_name || product.name) + '<div class="muted small">' + esc(product.manufacturer || '') + '</div></td>' +
      '<td>' + (product.species === 'cat' ? 'кошка' : 'собака') + '</td>' +
      '<td>' + esc(product.form || '—') + '</td>' +
      '<td>' + completeness + '</td>' +
      '<td class="num">' + pct(nutrient(product, 'protein')) + '</td>' +
      '<td class="num">' + pct(nutrient(product, 'fat')) + '</td>' +
      '<td class="num">' + kcal(nutrient(product, 'me')) + '</td>' +
      '<td class="num">' + (product.weight_label || '—') + '</td>' + '<td class="num">' + pricePerGramLabel(product.price_per_g_min, product.price_per_g_max) + '</td>' +
      '<td class="small">' + esc(allergens || '—') + '<div class="muted">' + esc(may) + '</div></td>' +
      '<td>' + cert + '</td>' +
      '<td>' + (product.source_url ? '<a href="' + esc(product.source_url) + '" target="_blank" rel="noopener">открыть</a>' : '—') + '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="13" class="empty">Ничего не найдено</td></tr>';
}

function productModal(id) {
  const product = DATA.products.find((item) => item.id === id);
  if (!product) return;
  const groups = {};
  for (const item of product.nutrients) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  const nutrients = Object.entries(groups).map(([category, items]) =>
    '<div class="box"><h3>' + esc(CATEGORY[category] || category) + '</h3><div class="kv">' +
    items.map((item) => '<span class="k">' + esc(item.name) + '</span><span class="v">' +
      num(item.amount, 3) + ' ' + esc(item.unit) + (item.value_type !== 'declared' ? ' <span class="muted small">(' + esc(item.value_type) + ')</span>' : '') +
      '</span>').join('') + '</div></div>'
  ).join('');

  const ingredients = product.ingredients.length
    ? '<ul class="clean">' + product.ingredients.map((item) =>
        '<li>' + esc(item.name) + (item.percent != null ? ' — ' + num(item.percent) + '%' : '') + '</li>').join('') + '</ul>'
    : '<div class="muted">Состав не извлечён</div>';

  const allergens = product.allergens.sources.length
    ? '<ul class="clean">' + product.allergens.sources.map((item) =>
        '<li>' + esc(item.name) + ' <span class="muted">(' + esc(item.group_name) + (item.percent != null ? ', ' + num(item.percent) + '%' : '') + (item.hydrolyzed ? ', гидролиз' : '') + ')</span></li>').join('') + '</ul>'
    : '<div class="muted">Источники белка не указаны</div>';

  const certs = product.certificates.length
    ? '<ul class="clean">' + product.certificates.map((item) =>
        '<li>' + esc(item.status) + (item.url ? ' — <a href="' + esc(item.url) + '" target="_blank" rel="noopener">документ</a>' : '') + '</li>').join('') + '</ul>'
    : '<div class="muted">Нет данных</div>';

  const prices = product.prices
    ? '<div class="kv"><span class="k">Цена</span><span class="v">' + num(product.prices.min) + '–' + num(product.prices.max) + ' ' + esc(product.prices.currency) + '</span></div>'
    : '<div class="muted">Цена не собрана</div>';

  document.getElementById('modalContent').innerHTML =
    '<h2>' + esc(product.brand) + ' — ' + esc(product.display_name || product.name) + '</h2>' +
    '<div class="muted small">' + esc(product.manufacturer || '') + ' · ' + (product.species === 'cat' ? 'кошка' : 'собака') + ' · ' + esc(product.form || '') + ' · market ' + esc(product.market) + '</div>' +
    '<div class="grid2">' +
      '<div class="box"><h3>Идентификация</h3><div class="kv">' +
        '<span class="k">ID</span><span class="v">' + product.id + '</span>' +
        '<span class="k">Полнорационность</span><span class="v">' + esc(product.completeness || '—') + '</span>' +
        '<span class="k">Уверенность</span><span class="v">' + (product.confidence == null ? '—' : num(product.confidence * 100, 0) + '%') + '</span>' +
        '<span class="k">Обновлено</span><span class="v">' + esc(product.updated_at || '—') + '</span>' +
      '</div>' + prices + '<div style="margin-top:8px">' + (product.source_url ? '<a href="' + esc(product.source_url) + '" target="_blank" rel="noopener">Источник</a>' : '') + '</div></div>' +
      '<div class="box"><h3>Аллергены</h3>' + allergens + '<div class="muted small" style="margin-top:6px">may_contain: ' + esc(product.allergens.may_contain.join(', ') || '—') + '</div></div>' +
      '<div class="box"><h3>Состав</h3>' + ingredients + '</div>' +
      '<div class="box"><h3>Сертификаты</h3>' + certs + '</div>' +
    '</div>' +
    '<div style="margin-top:16px"><h3 style="margin:0 0 8px">Нутриенты</h3><div class="grid2">' + (nutrients || '<div class="muted">Нет данных</div>') + '</div></div>';

  document.getElementById('modal').classList.add('open');
}

function renderBreeds() {
  document.getElementById('breedBody').innerHTML = DATA.breeds.map((breed) => {
    const h = breed.height_min_cm || breed.height_max_cm ? num(breed.height_min_cm) + '–' + num(breed.height_max_cm) + ' см' : '—';
    const w = breed.weight_min_kg || breed.weight_max_kg ? num(breed.weight_min_kg) + '–' + num(breed.weight_max_kg) + ' кг' : '—';
    const life = breed.lifespan_min_years || breed.lifespan_max_years ? num(breed.lifespan_min_years) + '–' + num(breed.lifespan_max_years) + ' лет' : '—';
    return '<tr data-breed="' + breed.id + '">' +
      '<td><b>' + esc(breed.name) + '</b><div class="muted small">' + esc(breed.name_en || '') + '</div></td>' +
      '<td>' + (breed.species === 'cat' ? 'кошка' : 'собака') + '</td>' +
      '<td>' + esc(breed.size_class || '—') + '</td>' +
      '<td>' + h + '</td><td>' + w + '</td><td>' + life + '</td>' +
      '<td>' + esc(breed.coat_type || '—') + '<div class="muted small">' + esc(breed.grooming_level || '') + '</div></td>' +
      '<td>' + (breed.brachycephalic ? '<span class="badge amber">да</span>' : 'нет') + '</td>' +
      '<td>' + breed.predispositions.length + '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="9" class="empty">Нет данных</td></tr>';
}

function breedModal(id) {
  const breed = DATA.breeds.find((item) => item.id === id);
  if (!breed) return;
  const predispositions = breed.predispositions.length
    ? '<ul class="clean">' + breed.predispositions.map((item) =>
        '<li><b>' + esc(item.name) + '</b> <span class="badge">' + esc(item.evidence_level) + '</span><div class="muted small">' +
        esc(item.prevalence_text || '') + (item.age_of_onset ? ' · ' + esc(item.age_of_onset) : '') +
        (item.notes ? ' · ' + esc(item.notes) : '') + (item.source ? ' · ' + esc(item.source) : '') + '</div></li>').join('') + '</ul>'
    : '<div class="muted">Нет данных</div>';
  const tests = breed.genetic_tests.length
    ? '<ul class="clean">' + breed.genetic_tests.map((item) =>
        '<li>' + esc(item.gene) + ' ' + esc(item.mutation || '') + ' <span class="muted">(' + esc(item.inheritance || '') + ')</span></li>').join('') + '</ul>'
    : '<div class="muted">Нет данных</div>';
  const weights = breed.weights.length
    ? '<ul class="clean">' + breed.weights.map((item) =>
        '<li>' + esc(item.sex || 'any') + ' / ' + esc(item.age_stage || '') + ': ' + num(item.min_kg) + '–' + num(item.max_kg) + ' кг</li>').join('') + '</ul>'
    : '<div class="muted">Нет данных</div>';

  document.getElementById('modalContent').innerHTML =
    '<h2>' + esc(breed.name) + '</h2>' +
    '<div class="muted small">' + esc(breed.name_en || '') + ' · ' + (breed.species === 'cat' ? 'кошка' : 'собака') + ' · FCI ' + esc(breed.fci_group || '—') + '</div>' +
    '<div class="grid2">' +
      '<div class="box"><h3>Физиология</h3><div class="kv">' +
        '<span class="k">Высота</span><span class="v">' + num(breed.height_min_cm) + '–' + num(breed.height_max_cm) + ' см</span>' +
        '<span class="k">Вес</span><span class="v">' + num(breed.weight_min_kg) + '–' + num(breed.weight_max_kg) + ' кг</span>' +
        '<span class="k">Жизнь</span><span class="v">' + num(breed.lifespan_min_years) + '–' + num(breed.lifespan_max_years) + ' лет</span>' +
        '<span class="k">Шерсть</span><span class="v">' + esc(breed.coat_type || '—') + '</span>' +
        '<span class="k">Груминг</span><span class="v">' + esc(breed.grooming_level || '—') + '</span>' +
        '<span class="k">Брахицефалия</span><span class="v">' + (breed.brachycephalic ? 'да' : 'нет') + '</span>' +
      '</div></div>' +
      '<div class="box"><h3>Вес по полу</h3>' + weights + '</div>' +
      '<div class="box"><h3>Наследственные риски</h3>' + predispositions + '</div>' +
      '<div class="box"><h3>Генетические тесты</h3>' + tests + '</div>' +
    '</div>';
  document.getElementById('modal').classList.add('open');
}

function renderCertificates() {
  document.getElementById('certBody').innerHTML = DATA.certificates.map((cert) =>
    '<tr><td>' + esc(cert.brand || '—') + '</td><td>' + esc(cert.product_name || '—') + '</td>' +
    '<td>' + esc(cert.type || '—') + '</td>' +
    '<td>' + (cert.status === 'found' ? '<span class="badge green">found</span>' : '<span class="badge red">not_found</span>') + '</td>' +
    '<td>' + esc(cert.number || '—') + '</td>' +
    '<td>' + (cert.url ? '<a href="' + esc(cert.url) + '" target="_blank" rel="noopener">открыть</a>' : '—') + '</td>' +
    '<td class="small">' + esc(cert.notes || '') + '</td></tr>').join('') ||
    '<tr><td colspan="7" class="empty">Нет записей</td></tr>';
}

function renderCoverage() {
  const items = [
    ['SKU', DATA.coverage.products],
    ['Брендов', DATA.coverage.brands],
    ['Нутриентов', DATA.coverage.nutrients],
    ['Строк нутриентов', DATA.coverage.product_nutrients],
    ['Пород', DATA.coverage.breeds],
    ['Рисков', DATA.coverage.predispositions],
    ['Сертификатов', DATA.coverage.certificates],
    ['Найдено', DATA.coverage.found_certificates],
    ['Не найдено', DATA.coverage.not_found_certificates]
  ];
  document.getElementById('coverageCards').innerHTML = items.map(([label, value]) =>
    '<div class="card"><div class="num">' + value + '</div><div class="lbl">' + label + '</div></div>').join('');

  const withMe = DATA.products.filter((p) => nutrient(p, 'me') != null).length;
  const withMoisture = DATA.products.filter((p) => nutrient(p, 'moisture') != null).length;
  const unknown = DATA.products.filter((p) => p.completeness === 'unknown').length;
  const noCerts = DATA.products.filter((p) => !p.certificates.some((c) => c.status === 'found')).length;

  document.getElementById('coverageDetails').innerHTML =
    '<div class="box"><h3>Полнота</h3><div class="kv">' +
      '<span class="k">SKU с ME</span><span class="v">' + withMe + ' / ' + DATA.coverage.products + '</span>' +
      '<span class="k">SKU с влагой</span><span class="v">' + withMoisture + ' / ' + DATA.coverage.products + '</span>' +
      '<span class="k">Полнорационность не указана</span><span class="v">' + unknown + '</span>' +
      '<span class="k">Без найденного сертификата</span><span class="v">' + noCerts + '</span>' +
      '<span class="k">FTS-документов</span><span class="v">' + DATA.coverage.fts_documents + '</span>' +
    '</div></div>' +
    '<div class="box"><h3>Бренды</h3><ul class="clean">' +
      [...new Set(DATA.products.map((p) => p.brand))].sort().map((brand) => '<li>' + esc(brand) + '</li>').join('') +
    '</ul></div>' +
    '<div class="box"><h3>Что проверить</h3><ul class="clean">' +
      '<li>ME отсутствует у ' + (DATA.coverage.products - withMe) + ' SKU</li>' +
      '<li>Влага отсутствует у ' + (DATA.coverage.products - withMoisture) + ' SKU</li>' +
      '<li>Сертификаты: ' + DATA.coverage.not_found_certificates + ' записей not_found</li>' +
      '<li>Полнорационность unknown: ' + unknown + ' SKU</li>' +
    '</ul></div>';
}

function applyFilters() {
  const value = (id) => (document.getElementById(id) || {}).value || '';
  state.q = value('q').trim().toLowerCase();
  state.species = value('species');
  state.brand = value('brand');
  state.form = value('form');
  state.completeness = value('completeness');
  state.klass = value('class');
  state.sort = value('sort') || 'brand';
  state.meOnly = Boolean((document.getElementById('meOnly') || {}).checked);
  state.priceOnly = Boolean((document.getElementById('priceOnly') || {}).checked);
  state.certOnly = Boolean((document.getElementById('certOnly') || {}).checked);
  renderProducts();
}

['q', 'species', 'brand', 'form', 'completeness', 'class', 'sort'].forEach((id) => {
  const element = document.getElementById(id);
  if (!element) return;
  element.addEventListener(id === 'q' ? 'input' : 'change', applyFilters);
});
['meOnly', 'priceOnly', 'certOnly'].forEach((id) => {
  const element = document.getElementById(id);
  if (element) element.addEventListener('change', applyFilters);
});
const resetButton = document.getElementById('resetFilters');
if (resetButton) {
  resetButton.addEventListener('click', () => {
    ['q', 'species', 'brand', 'form', 'completeness', 'class'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.value = '';
    });
    const sort = document.getElementById('sort');
    if (sort) sort.value = 'brand';
    ['meOnly', 'priceOnly', 'certOnly'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.checked = false;
    });
    applyFilters();
  });
}
applyFilters();

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((item) => item.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

document.getElementById('productBody').addEventListener('click', (event) => {
  if (event.target.closest('a')) return;
  const row = event.target.closest('tr[data-id]');
  if (row) productModal(Number(row.dataset.id));
});
document.getElementById('breedBody').addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-breed]');
  if (row) breedModal(Number(row.dataset.breed));
});
document.getElementById('modalClose').addEventListener('click', () => document.getElementById('modal').classList.remove('open'));
document.getElementById('modal').addEventListener('click', (event) => {
  if (event.target === document.getElementById('modal')) document.getElementById('modal').classList.remove('open');
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') document.getElementById('modal').classList.remove('open');
});

document.getElementById('subtitle').textContent =
  DATA.coverage.products + ' SKU · ' + DATA.coverage.brands + ' брендов · ' +
  DATA.coverage.breeds + ' пород · сгенерировано ' + new Date(DATA.generated_at).toLocaleString('ru-RU');
document.getElementById('footer').textContent =
  'Данные: ' + DATA.coverage.product_nutrients + ' строк нутриентов, ' +
  DATA.coverage.predispositions + ' породных рисков. ' +
  'Отсутствующие значения показаны как «—»; сертификаты not_found — это результат поиска, а не ошибка отображения.';
</script>
</body>
</html>`;

fs.mkdirSync(outDir, { recursive: true });

function renderPage({ rows, subtitle, file, activeSpecies = 'all', activeBrand = 'all' }) {
  const pageHtml = html
    .replace('__DATA__', json)
    .replace('__PRODUCT_ROWS__', rows.map(staticProductRow).join(''))
    .replace('__PRODUCT_CARDS__', productCardsFor(rows))
    .replace('__FILTER_CONTROLS__', productFilterForm(activeSpecies, activeBrand))
    .replace('__BREED_ROWS__', staticBreedRows)
    .replace('__BREED_CARDS__', staticBreedCards)
    .replace('__CERT_ROWS__', staticCertRows)
    .replace('__COVERAGE_CARDS__', staticCoverageCards)
    .replace('__COVERAGE_DETAILS__', staticCoverageDetails)
    .replace('__SUBTITLE__', subtitle)
    .replace('__FOOTER__', staticFooter);
  fs.writeFileSync(path.join(outDir, file), pageHtml, 'utf8');
}

const cats = products.filter((product) => product.species === 'cat');
const dogs = products.filter((product) => product.species === 'dog');

renderPage({ rows: products, subtitle: staticSubtitle, file: 'index.html', activeSpecies: 'all', activeBrand: 'all' });
renderPage({ rows: cats, subtitle: 'Кошки · ' + cats.length + ' SKU', file: 'cats.html', activeSpecies: 'cat', activeBrand: 'all' });
renderPage({ rows: dogs, subtitle: 'Собаки · ' + dogs.length + ' SKU', file: 'dogs.html', activeSpecies: 'dog', activeBrand: 'all' });
brandList.forEach((brand, index) => {
  const rows = products.filter((product) => product.brand === brand);
  renderPage({
    rows,
    subtitle: brand + ' · ' + rows.length + ' SKU',
    file: 'brand-' + index + '.html',
    activeSpecies: 'all',
    activeBrand: brand
  });
});

db.close();

console.log(`HTML: ${outFile}`);
console.log(`Страниц: ${4 + brandList.length}`);
console.log(`Размер index: ${(fs.statSync(outFile).size / 1024).toFixed(1)} KB`);
