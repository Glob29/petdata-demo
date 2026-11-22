#!/usr/bin/env node
'use strict';

/*
 * PetData UI — серверный HTML-браузер базы.
 * Без клиентского JS: поиск, фильтры и сортировка работают через GET-параметры.
 *
 * Запуск: node ui/server.js
 * Порт: PETDATA_UI_PORT (по умолчанию 8790)
 */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

const root = path.join(__dirname, '..');
const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
if (!fs.existsSync(dbPath)) throw new Error(`Нет базы: ${dbPath}`);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const PAGE_SIZE = 25;

/* -------------------------------------------------------------------------- */
/* Утилиты                                                                    */
/* -------------------------------------------------------------------------- */

const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const num = (value, digits = 1) => value == null
  ? '—'
  : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: digits });

const pct = (value) => value == null ? '—' : num(value) + '%';
const kcal = (value) => value == null ? '—' : num(value, 0) + ' ккал/кг';

// Вес показываем в естественных единицах: 1500 → «1,5 кг», 300 → «300 г».
const grams = (value) => {
  if (value == null) return '—';
  if (value >= 1000) return num(value / 1000, value % 1000 === 0 ? 0 : 1) + ' кг';
  return num(value, 0) + ' г';
};

// У товара с несколькими фасовками хвост «, 400 гр» в названии относится к варианту по умолчанию
// и путает: в карточке 400 г, 1,5 кг, 4 кг. Показываем название без хвоста.
const SIZE_SUFFIX = /(?:,\s*|\s+)\d+(?:[.,]\d+)?\s*(?:г|гр|кг)\.?$/i;
const displayName = (name, packageCount) => {
  if (!name || !packageCount || packageCount <= 1) return name;
  const stripped = name.replace(SIZE_SUFFIX, '').replace(/[,\s]+$/, '');
  return stripped || name;
};

// Цена за грамм: диапазон по фасовкам. Это главная величина для планирования бюджета.
const pricePerGramLabel = (min, max) => {
  if (min == null) return '<span class="muted" title="Цена за грамм не посчитана: у товара нет ни одного наблюдения цены">нет цены</span>';
  if (max != null && max !== min) return num(min, 4) + ' – ' + num(max, 4) + ' ₽/г';
  return num(min, 4) + ' ₽/г';
};

// У SKU бывает несколько фасовок — тогда показываем диапазон, а не только младшую.
const weightLabel = (min, max, count) => {
  if (min == null) return '—';
  if (count > 1 && max != null && max !== min) return `${grams(min)} – ${grams(max)}`;
  return grams(min);
};

function all(sql, ...params) {
  return db.prepare(sql).all(...params).map((row) => ({ ...row }));
}
function get(sql, ...params) {
  const row = db.prepare(sql).get(...params);
  return row ? { ...row } : null;
}
function count(sql, ...params) {
  return get(sql, ...params).n;
}

function speciesLabel(value) {
  return value === 'cat' ? 'кошка' : value === 'dog' ? 'собака' : '—';
}

function completenessBadge(value) {
  if (value === 'complete') return '<span class="badge green">полный</span>';
  if (value === 'complementary') return '<span class="badge amber">дополнительный</span>';
  return '<span class="badge">не указан</span>';
}

const CLASS_LABELS = {
  economy: 'эконом',
  premium: 'премиум',
  super_premium: 'супер-премиум',
  holistic: 'холистик',
  unknown: 'не указан'
};

function classBadge(value) {
  const label = CLASS_LABELS[value] || CLASS_LABELS.unknown;
  if (value === 'holistic') return `<span class="badge green">${label}</span>`;
  if (value === 'super_premium') return `<span class="badge blue">${label}</span>`;
  if (value === 'premium') return `<span class="badge amber">${label}</span>`;
  if (value === 'economy') return `<span class="badge">${label}</span>`;
  return `<span class="badge">${label}</span>`;
}

function certBadge(product) {
  if (product.cert_found > 0) return '<span class="badge green">найден</span>';
  return '<span class="badge red">не найден</span>';
}

function queryString(params, overrides = {}) {
  const search = new URLSearchParams(params);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined || value === '') search.delete(key);
    else search.set(key, String(value));
  }
  const value = search.toString();
  return value ? '?' + value : '';
}

function pageUrl(base, params, overrides) {
  return base + queryString(params, overrides);
}

/* -------------------------------------------------------------------------- */
/* Запросы                                                                    */
/* -------------------------------------------------------------------------- */

function productWhere(params) {
  const clauses = [];
  const args = [];

  const q = (params.get('q') || '').trim();
  if (q) {
    const words = q.toLowerCase().split(/\s+/)
      .map((word) => word.replace(/[^\p{L}\p{N}]+/gu, ''))
      .filter(Boolean);
    if (words.length) {
      const fts = words
        .map((word) => `"${word.length >= 4 ? word.slice(0, 4) : word}"*`)
        .join(' AND ');
      clauses.push('p.id IN (SELECT product_id FROM product_fts WHERE product_fts MATCH ?)');
      args.push(fts);
    }
  }

  const species = params.get('species');
  if (species === 'cat' || species === 'dog') {
    clauses.push('p.species = ?');
    args.push(species);
  }

  const brand = params.get('brand');
  if (brand) {
    clauses.push('b.name = ?');
    args.push(brand);
  }

  const form = params.get('form');
  if (form) {
    clauses.push('p.form = ?');
    args.push(form);
  }

  const productClass = params.get('class');
  if (['economy', 'premium', 'super_premium', 'holistic', 'unknown'].includes(productClass)) {
    clauses.push('p.class = ?');
    args.push(productClass);
  }

  const completeness = params.get('completeness');
  if (completeness) {
    clauses.push('p.completeness = ?');
    args.push(completeness);
  }

  if (params.get('me') === '1') {
    clauses.push(`EXISTS (
      SELECT 1 FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id
      WHERE pn.product_id = p.id AND n.code = 'me' AND pn.basis = 'as_fed'
    )`);
  }

  if (params.get('price') === '1') {
    clauses.push('EXISTS (SELECT 1 FROM package pk WHERE pk.product_id = p.id AND pk.price_per_g IS NOT NULL)');
  }

  if (params.get('cert') === '1') {
    clauses.push(`EXISTS (
      SELECT 1 FROM certificate c
      WHERE c.status = 'found' AND (c.product_id = p.id OR (c.product_id IS NULL AND c.brand_id = p.brand_id))
    )`);
  }

  return {
    sql: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '',
    args
  };
}

const SORT_COLUMNS = {
  brand: 'b.name',
  name: 'p.name',
  species: 'p.species',
  class: 'p.class',
  protein: 'protein',
  fat: 'fat',
  me: 'me',
  food: 'food_per_kg_day',
  weight: 'weight_g',
  price_g: 'price_per_g_min',
  cert: 'cert_found'
};

function productList(params) {
  const where = productWhere(params);
  const sort = SORT_COLUMNS[params.get('sort')] ? params.get('sort') : 'brand';
  const dir = params.get('dir') === 'desc' ? 'DESC' : 'ASC';
  const column = SORT_COLUMNS[sort];
  const numeric = ['protein', 'fat', 'me', 'food', 'weight', 'price_g', 'cert'].includes(sort);
  const order = numeric
    ? `(${column} IS NULL), ${column} ${dir}, p.name ASC`
    : `${column} ${dir}, p.name ASC`;

  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const total = count(`SELECT COUNT(*) AS n FROM product p JOIN brand b ON b.id = p.brand_id ${where.sql}`, ...where.args);

  const rows = all(`
    SELECT p.id, p.name, p.species, p.form, p.completeness, p.class, p.source_url,
           p.food_per_kg_day, p.reference_weight_kg,
           b.name AS brand,
           (SELECT pn.amount FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id
             WHERE pn.product_id = p.id AND n.code = 'protein' AND pn.basis = 'as_fed'
             ORDER BY CASE pn.value_type WHEN 'declared' THEN 1 WHEN 'typical' THEN 2 ELSE 3 END LIMIT 1) AS protein,
           (SELECT pn.amount FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id
             WHERE pn.product_id = p.id AND n.code = 'fat' AND pn.basis = 'as_fed'
             ORDER BY CASE pn.value_type WHEN 'declared' THEN 1 WHEN 'typical' THEN 2 ELSE 3 END LIMIT 1) AS fat,
           (SELECT pn.amount FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id
             WHERE pn.product_id = p.id AND n.code = 'me' AND pn.basis = 'as_fed'
             ORDER BY CASE pn.value_type WHEN 'declared' THEN 1 WHEN 'typical' THEN 2 ELSE 3 END LIMIT 1) AS me,
           (SELECT pkg.weight_g FROM package pkg WHERE pkg.product_id = p.id ORDER BY pkg.weight_g LIMIT 1) AS weight_g,
           (SELECT MAX(pkg.weight_g) FROM package pkg WHERE pkg.product_id = p.id) AS weight_max_g,
           (SELECT COUNT(*) FROM package pkg WHERE pkg.product_id = p.id) AS package_count,
           (SELECT MIN(pkg.price_per_g) FROM package pkg WHERE pkg.product_id = p.id AND pkg.price_per_g IS NOT NULL) AS price_per_g_min,
           (SELECT MAX(pkg.price_per_g) FROM package pkg WHERE pkg.product_id = p.id AND pkg.price_per_g IS NOT NULL) AS price_per_g_max,
           (SELECT GROUP_CONCAT(ps.name_ru, ', ')
              FROM product_protein_source pps
              JOIN protein_source ps ON ps.id = pps.protein_source_id
             WHERE pps.product_id = p.id) AS allergens,
           (SELECT COUNT(*) FROM certificate c
             WHERE c.status = 'found' AND (c.product_id = p.id OR (c.product_id IS NULL AND c.brand_id = p.brand_id))) AS cert_found
      FROM product p
      JOIN brand b ON b.id = p.brand_id
      ${where.sql}
      ORDER BY ${order}
      LIMIT ? OFFSET ?
  `, ...where.args, PAGE_SIZE, offset);

  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

function brandOptions(selected) {
  const brands = all('SELECT DISTINCT b.name FROM brand b JOIN product p ON p.brand_id = b.id ORDER BY b.name');
  return brands.map((row) => `<option value="${esc(row.name)}"${row.name === selected ? ' selected' : ''}>${esc(row.name)}</option>`).join('');
}

/* -------------------------------------------------------------------------- */
/* Шаблон                                                                     */
/* -------------------------------------------------------------------------- */

function layout({ title, active, body }) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — PetData</title>
<style>
  :root {
    --bg: #f3f6f9; --panel: #fff; --ink: #14202b; --muted: #657386;
    --line: #dce4ec; --accent: #155eef; --accent-soft: #e9f0ff;
    --green: #087443; --green-soft: #e7f6ee; --amber: #925500; --amber-soft: #fff4dc;
    --red: #b42318; --red-soft: #fdecea; --shadow: 0 1px 2px rgba(16,24,40,.05);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  header { background: #0f1b2a; color: #fff; }
  .header-inner { max-width: 1480px; margin: 0 auto; padding: 18px 24px 0; display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
  .logo { font-weight: 800; letter-spacing: -0.02em; font-size: 19px; color: #fff; }
  .logo span { color: #7fb0ff; }
  nav { display: flex; gap: 6px; flex-wrap: wrap; }
  nav a { color: #cbd5e1; padding: 9px 12px; border-radius: 8px 8px 0 0; font-weight: 600; }
  nav a:hover { color: #fff; background: rgba(255,255,255,.08); text-decoration: none; }
  nav a.active { color: #fff; background: var(--bg); border-radius: 8px 8px 0 0; }
  .wrap { max-width: 1480px; margin: 0 auto; padding: 22px 24px 46px; }
  h1 { margin: 0 0 4px; font-size: 25px; letter-spacing: -0.025em; }
  h2 { margin: 0 0 10px; font-size: 18px; letter-spacing: -0.015em; }
  h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
  .sub { color: var(--muted); margin: 0 0 16px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 0 0 16px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; box-shadow: var(--shadow); }
  .card .num { font-size: 23px; font-weight: 750; letter-spacing: -0.03em; }
  .card .lbl { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
  form.filters { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 0 0 14px; box-shadow: var(--shadow); }
  input[type="search"], select { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; background: #fff; color: var(--ink); font: inherit; }
  input[type="search"] { min-width: 300px; flex: 1 1 300px; }
  label.check { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); white-space: nowrap; }
  button, .button { border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 8px; padding: 8px 12px; font: inherit; cursor: pointer; }
  button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .tablewrap { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: auto; box-shadow: var(--shadow); }
  table { width: 100%; border-collapse: collapse; min-width: 1100px; }
  th, td { padding: 9px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  th { position: sticky; top: 0; background: #f8fafc; z-index: 2; font-size: 11px; text-transform: uppercase; letter-spacing: .045em; color: var(--muted); white-space: nowrap; }
  th a { color: var(--muted); }
  th a:hover { color: var(--accent); text-decoration: none; }
  tr:hover td { background: #f8fbff; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .muted { color: var(--muted); }
  .small { font-size: 12px; }
  .badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 700; background: #edf1f5; color: #5b6776; white-space: nowrap; }
  .badge.green { background: var(--green-soft); color: var(--green); }
  .badge.amber { background: var(--amber-soft); color: var(--amber); }
  .badge.red { background: var(--red-soft); color: var(--red); }
  .badge.blue { background: var(--accent-soft); color: var(--accent); }
  .pager { display: flex; gap: 6px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
  .pager a, .pager span { border: 1px solid var(--line); background: #fff; border-radius: 7px; padding: 6px 10px; font-size: 13px; }
  .pager span.current { background: var(--accent); color: #fff; border-color: var(--accent); }
  .empty { padding: 22px; text-align: center; color: var(--muted); }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
  .box { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; box-shadow: var(--shadow); }
  .kv { display: grid; grid-template-columns: 1fr auto; gap: 5px 12px; }
  .kv .k { color: var(--muted); }
  .kv .v { text-align: right; font-variant-numeric: tabular-nums; }
  ul.clean { margin: 0; padding-left: 18px; }
  ul.clean li { margin: 3px 0; }
  .crumb { color: var(--muted); font-size: 13px; margin-bottom: 10px; }
  .detail-title { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
  .detail-title h1 { margin: 0; }
  .tabs-static { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 14px; }
  .tabs-static a { border: 1px solid var(--line); border-radius: 8px; padding: 7px 11px; background: #fff; font-weight: 600; }
  .tabs-static a.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .note { background: #fff; border: 1px solid var(--line); border-left: 4px solid var(--amber); border-radius: 8px; padding: 10px 12px; margin: 0 0 14px; color: var(--muted); }
  footer { color: var(--muted); font-size: 12px; margin-top: 24px; }
  @media (max-width: 760px) {
    .header-inner { padding: 14px 14px 0; }
    .wrap { padding: 16px 14px 36px; }
    input[type="search"] { min-width: 100%; }
    th, td { padding: 8px; }
  }
</style>
</head>
<body>
<header>
  <div class="header-inner">
    <a class="logo" href="/">Pet<span>Data</span></a>
    <nav>
      <a href="/" class="${active === 'products' ? 'active' : ''}">Корма</a>
      <a href="/breeds" class="${active === 'breeds' ? 'active' : ''}">Породы</a>
      <a href="/certificates" class="${active === 'certificates' ? 'active' : ''}">Сертификаты</a>
      <a href="/coverage" class="${active === 'coverage' ? 'active' : ''}">Покрытие</a>
    </nav>
  </div>
</header>
<div class="wrap">
${body}
<footer>PetData · база кормов и пород · данные с открытых страниц производителей</footer>
</div>
</body>
</html>`;
}

/* -------------------------------------------------------------------------- */
/* Страницы                                                                   */
/* -------------------------------------------------------------------------- */

function productsPage(params) {
  const result = productList(params);
  const selected = {
    q: params.get('q') || '',
    species: params.get('species') || '',
    brand: params.get('brand') || '',
    form: params.get('form') || '',
    completeness: params.get('completeness') || '',
    class: params.get('class') || '',
    me: params.get('me') === '1',
    price: params.get('price') === '1',
    cert: params.get('cert') === '1'
  };
  const sort = params.get('sort') || 'brand';
  const dir = params.get('dir') === 'desc' ? 'desc' : 'asc';

  const sortLink = (label, key) => {
    const next = sort === key && dir === 'asc' ? 'desc' : 'asc';
    return `<a href="${pageUrl('/', params, { sort: key, dir: next, page: 1 })}">${label}${sort === key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</a>`;
  };

  const rows = result.rows.map((product) => `
    <tr>
      <td><b>${esc(product.brand)}</b></td>
      <td><a href="/product/${product.id}">${esc(displayName(product.name, product.package_count))}</a></td>
      <td>${speciesLabel(product.species)}</td>
      <td>${esc(product.form || '—')}</td>
      <td>${completenessBadge(product.completeness)}</td>
      <td>${classBadge(product.class)}</td>
      <td class="num">${pct(product.protein)}</td>
      <td class="num">${pct(product.fat)}</td>
      <td class="num">${kcal(product.me)}</td>
      <td class="num">${product.food_per_kg_day != null ? num(product.food_per_kg_day, 2) + ' г/кг' : '—'}</td>
      <td class="num">${weightLabel(product.weight_g, product.weight_max_g, product.package_count)}</td>
      <td class="num">${pricePerGramLabel(product.price_per_g_min, product.price_per_g_max)}</td>
      <td class="small">${esc(product.allergens || '—')}</td>
      <td>${certBadge(product)}</td>
      <td>${product.source_url ? `<a href="${esc(product.source_url)}" target="_blank" rel="noopener">источник</a>` : '—'}</td>
    </tr>`).join('') || `<tr><td colspan="15" class="empty">Ничего не найдено</td></tr>`;

  const start = result.total ? (result.page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(result.page * PAGE_SIZE, result.total);
  const pager = Array.from({ length: result.pages }, (_, index) => index + 1)
    .filter((page) => page === 1 || page === result.pages || Math.abs(page - result.page) <= 2)
    .map((page, index, list) => {
      const previous = list[index - 1];
      const gap = previous && page - previous > 1 ? '<span>…</span>' : '';
      const link = page === result.page
        ? `<span class="current">${page}</span>`
        : `<a href="${pageUrl('/', params, { page })}">${page}</a>`;
      return gap + link;
    }).join('');

  return layout({
    title: 'Корма',
    active: 'products',
    body: `
      <h1>Корма</h1>
      <p class="sub">${result.total} SKU · показаны ${start}–${end} · сортировка по клику на заголовок</p>
      <div class="cards">
        <div class="card"><div class="num">${result.total}</div><div class="lbl">Найдено SKU</div></div>
        <div class="card"><div class="num">${count('SELECT COUNT(*) AS n FROM product')}</div><div class="lbl">Всего в базе</div></div>
        <div class="card"><div class="num">${count('SELECT COUNT(DISTINCT brand_id) AS n FROM product')}</div><div class="lbl">Брендов</div></div>
        <div class="card"><div class="num">${count("SELECT COUNT(DISTINCT pn.product_id) AS n FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id WHERE n.code = 'me'")}</div><div class="lbl">С ME</div></div>
      </div>
      <form class="filters" method="get" action="/">
        <input type="search" name="q" value="${esc(selected.q)}" placeholder="Поиск: бренд, продукт, ингредиент…">
        <select name="species">
          <option value="">Все виды</option>
          <option value="cat"${selected.species === 'cat' ? ' selected' : ''}>Кошки</option>
          <option value="dog"${selected.species === 'dog' ? ' selected' : ''}>Собаки</option>
        </select>
        <select name="brand"><option value="">Все бренды</option>${brandOptions(selected.brand)}</select>
        <select name="form">
          <option value="">Все типы</option>
          <option value="dry"${selected.form === 'dry' ? ' selected' : ''}>Сухой</option>
          <option value="wet"${selected.form === 'wet' ? ' selected' : ''}>Влажный</option>
        </select>
        <select name="completeness">
          <option value="">Полнорационность</option>
          <option value="complete"${selected.completeness === 'complete' ? ' selected' : ''}>Полный</option>
          <option value="complementary"${selected.completeness === 'complementary' ? ' selected' : ''}>Дополнительный</option>
          <option value="unknown"${selected.completeness === 'unknown' ? ' selected' : ''}>Не указан</option>
        </select>
        <select name="class">
          <option value="">Класс</option>
          <option value="economy"${selected.class === 'economy' ? ' selected' : ''}>Эконом</option>
          <option value="premium"${selected.class === 'premium' ? ' selected' : ''}>Премиум</option>
          <option value="super_premium"${selected.class === 'super_premium' ? ' selected' : ''}>Супер-премиум</option>
          <option value="holistic"${selected.class === 'holistic' ? ' selected' : ''}>Холистик</option>
          <option value="unknown"${selected.class === 'unknown' ? ' selected' : ''}>Не указан</option>
        </select>
        <label class="check"><input type="checkbox" name="me" value="1"${selected.me ? ' checked' : ''}> только с ME</label>
        <label class="check"><input type="checkbox" name="price" value="1"${selected.price ? ' checked' : ''}> только с ценой</label>
        <label class="check"><input type="checkbox" name="cert" value="1"${selected.cert ? ' checked' : ''}> с сертификатом</label>
        <input type="hidden" name="sort" value="${esc(sort)}">
        <input type="hidden" name="dir" value="${esc(dir)}">
        <button class="primary" type="submit">Найти</button>
        <a class="button" href="/">Сбросить</a>
        <a class="button" href="${pageUrl('/export.csv', params, { page: null })}">CSV</a>
      </form>
      <div class="tablewrap">
        <table>
          <thead><tr>
            <th>${sortLink('Бренд', 'brand')}</th>
            <th>${sortLink('Продукт', 'name')}</th>
            <th>${sortLink('Вид', 'species')}</th>
            <th>Тип</th>
            <th>Полнорационность</th>
            <th>${sortLink('Класс', 'class')}</th>
            <th>${sortLink('Белок', 'protein')}</th>
            <th>${sortLink('Жир', 'fat')}</th>
            <th>${sortLink('ME', 'me')}</th>
            <th>${sortLink('г/кг/сут', 'food')}</th>
            <th>${sortLink('Вес', 'weight')}</th>
            <th>${sortLink('₽/г', 'price_g')}</th>
            <th>Аллергены</th>
            <th>${sortLink('Сертификат', 'cert')}</th>
            <th>Источник</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="pager">${pager}</div>
    `
  });
}

function productPage(id) {
  const product = get(`
    SELECT p.*, b.name AS brand, m.name AS manufacturer
      FROM product p
      JOIN brand b ON b.id = p.brand_id
      LEFT JOIN manufacturer m ON m.id = b.manufacturer_id
     WHERE p.id = ?`, id);
  if (!product) return null;

  const nutrients = all(`
    SELECT n.code, n.name_ru, n.unit AS nutrient_unit, n.category, n.sort_order,
           pn.amount, pn.unit, pn.basis, pn.value_type, pn.confidence
      FROM product_nutrient pn
      JOIN nutrient n ON n.id = pn.nutrient_id
     WHERE pn.product_id = ?
     ORDER BY n.sort_order, n.code`, id);

  const groups = {};
  for (const item of nutrients) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  const categoryNames = {
    macro: 'Макронутриенты', amino: 'Аминокислоты', fatty: 'Жирные кислоты',
    vitamin: 'Витамины', mineral: 'Минералы', energy: 'Энергия', other: 'Прочее'
  };

  const ingredients = all(`
    SELECT i.name_ru, i.animal_origin, i.allergen_group, pi.position, pi.percent
      FROM product_ingredient pi
      JOIN ingredient i ON i.id = pi.ingredient_id
     WHERE pi.product_id = ?
     ORDER BY pi.position`, id);

  const proteins = all(`
    SELECT ps.code, ps.name_ru, ps.group_code, ag.name_ru AS group_name,
           pps.role, pps.declared_percent, pps.is_hydrolyzed
      FROM product_protein_source pps
      JOIN protein_source ps ON ps.id = pps.protein_source_id
      JOIN allergen_group ag ON ag.code = ps.group_code
     WHERE pps.product_id = ?
     ORDER BY CASE pps.role WHEN 'primary' THEN 1 WHEN 'secondary' THEN 2 ELSE 3 END`, id);

  const packages = all(`
    SELECT pkg.id, pkg.weight_g, pkg.pack_count, pkg.gtin,
           COALESCE(pkg.total_weight_g, pkg.weight_g) AS total_weight_g,
           pkg.price_avg, pkg.price_per_g, pkg.price_samples,
           (SELECT MIN(price) FROM price_snapshot ps WHERE ps.package_id = pkg.id) AS price_min,
           (SELECT MAX(price) FROM price_snapshot ps WHERE ps.package_id = pkg.id) AS price_max,
           (SELECT currency FROM price_snapshot ps WHERE ps.package_id = pkg.id LIMIT 1) AS currency
      FROM package pkg WHERE pkg.product_id = ? ORDER BY COALESCE(pkg.total_weight_g, pkg.weight_g)`, id);

  const certificates = all(`
    SELECT type, scope, status, number, url, notes, observed_at
      FROM certificate
     WHERE product_id = ? OR (product_id IS NULL AND brand_id = ?)
     ORDER BY CASE status WHEN 'found' THEN 1 ELSE 2 END`, id, product.brand_id);

  const sources = all(`
    SELECT url, fetched_at, status FROM product_source_page
     WHERE product_id = ? ORDER BY fetched_at DESC`, id);

  const nutrientRows = Object.entries(groups).map(([category, items]) => `
    <div class="box">
      <h3>${esc(categoryNames[category] || category)}</h3>
      <table style="min-width:0">
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${esc(item.name_ru)}</td>
              <td class="num">${num(item.amount, 3)} ${esc(item.unit)}</td>
              <td class="small muted">${esc(item.value_type)}${item.basis !== 'as_fed' ? ' · ' + esc(item.basis) : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('') || '<div class="empty">Нутриенты не собраны</div>';

  const ingredientRows = ingredients.map((item) => `
    <li>${esc(item.name_ru)}${item.percent != null ? ` — ${num(item.percent)}%` : ''}
      ${item.allergen_group ? `<span class="badge">${esc(item.allergen_group)}</span>` : ''}</li>`).join('');

  const proteinRows = proteins.map((item) => `
    <li>${esc(item.name_ru)} <span class="muted">(${esc(item.group_name)}${item.percent != null ? ', ' + num(item.percent) + '%' : ''}${item.is_hydrolyzed ? ', гидролиз' : ''})</span></li>`).join('');

  const packageRows = packages.map((item) => `
    <tr>
      <td class="num">${num(item.weight_g, 0)} г${item.pack_count > 1 ? ' × ' + item.pack_count + ' = ' + grams(item.total_weight_g) : ''}</td>
      <td class="num">${item.price_avg == null ? '—' : num(item.price_avg) + ' ₽'}</td>
      <td class="num">${item.price_per_g == null ? '—' : num(item.price_per_g, 4) + ' ₽/г'}</td>
      <td>${item.gtin ? esc(item.gtin) : '—'}</td>
      <td class="num">${item.price_min != null ? num(item.price_min) + (item.price_max !== item.price_min ? '–' + num(item.price_max) : '') + ' ' + esc(item.currency || '') : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="3" class="empty">Упаковки не собраны</td></tr>';

  const certRows = certificates.map((item) => `
    <li>${esc(item.status)} · ${esc(item.type)} · ${esc(item.scope)}${item.url ? ` · <a href="${esc(item.url)}" target="_blank" rel="noopener">документ</a>` : ''}</li>`).join('') || '<li class="muted">Нет записей</li>';

  return layout({
    title: displayName(product.name, packages.length),
    active: 'products',
    body: `
      <div class="crumb"><a href="/">Корма</a> / ${esc(product.brand)} / ${esc(displayName(product.name, packages.length))}</div>
      <div class="detail-title">
        <h1>${esc(displayName(product.name, packages.length))}</h1>
        <span class="badge blue">${esc(product.brand)}</span>
        <span class="badge">${speciesLabel(product.species)}</span>
        <span class="badge">${esc(product.form || '—')}</span>
        ${completenessBadge(product.completeness)}
        ${classBadge(product.class)}
      </div>
      <p class="sub">${esc(product.manufacturer || '')} · рынок ${esc(product.market)} · обновлено ${esc(product.updated_at || '—')}</p>
      <div class="grid2">
        <div class="box">
          <h3>Идентификация</h3>
          <div class="kv">
            <span class="k">ID</span><span class="v">${product.id}</span>
            <span class="k">Бренд</span><span class="v">${esc(product.brand)}</span>
            <span class="k">Класс</span><span class="v">${esc(CLASS_LABELS[product.class] || product.class || '—')}</span>
            <span class="k">Источник класса</span><span class="v">${esc(product.class_source || '—')}</span>
            <span class="k">Расход на кг</span><span class="v">${product.food_per_kg_day == null ? '—' : num(product.food_per_kg_day, 2) + ' г/кг/сут'}</span>
            <span class="k">Референс</span><span class="v">${product.reference_weight_kg == null ? '—' : num(product.reference_weight_kg, 0) + ' кг'}</span>
            <span class="k">Уверенность</span><span class="v">${product.confidence == null ? '—' : num(product.confidence * 100, 0) + '%'}</span>
            <span class="k">Источник</span><span class="v">${product.source_url ? `<a href="${esc(product.source_url)}" target="_blank" rel="noopener">открыть</a>` : '—'}</span>
          </div>
        </div>
        <div class="box">
          <h3>Аллергены</h3>
          <ul class="clean">${proteinRows || '<li class="muted">Не указаны</li>'}</ul>
        </div>
        <div class="box">
          <h3>Состав</h3>
          <ul class="clean">${ingredientRows || '<li class="muted">Не собран</li>'}</ul>
        </div>
        <div class="box">
          <h3>Сертификаты</h3>
          <ul class="clean">${certRows}</ul>
        </div>
      </div>
      <h2 style="margin-top:20px">Нутриенты</h2>
      <div class="grid2">${nutrientRows}</div>
      <h2 style="margin-top:20px">Упаковки и цены</h2>
      <div class="tablewrap"><table style="min-width:520px">
        <thead><tr><th>Вес</th><th>Средняя цена</th><th>₽/г</th><th>GTIN</th><th>Цена (набл.)</th></tr></thead>
        <tbody>${packageRows}</tbody>
      </table></div>
      <h2 style="margin-top:20px">Страницы-источники</h2>
      <ul class="clean">${sources.map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.url)}</a> <span class="muted small">${esc(item.fetched_at)}</span></li>`).join('') || '<li class="muted">Нет</li>'}</ul>
    `
  });
}

function breedsPage(params) {
  const q = (params.get('q') || '').trim();
  const species = params.get('species');
  const size = params.get('size');
  const where = [];
  const args = [];
  if (q) { where.push('(b.name_ru LIKE ? OR b.name_en LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  if (species === 'cat' || species === 'dog') { where.push('b.species = ?'); args.push(species); }
  if (size) { where.push('b.size_class = ?'); args.push(size); }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const rows = all(`
    SELECT b.*,
           (SELECT COUNT(*) FROM breed_predisposition bp WHERE bp.breed_id = b.id) AS risks
      FROM breed b ${clause}
     ORDER BY b.species, b.name_ru`, ...args);

  return layout({
    title: 'Породы',
    active: 'breeds',
    body: `
      <h1>Породы</h1>
      <p class="sub">${rows.length} пород · клик по названию открывает карточку</p>
      <form class="filters" method="get" action="/breeds">
        <input type="search" name="q" value="${esc(q)}" placeholder="Поиск породы…">
        <select name="species">
          <option value="">Все виды</option>
          <option value="cat"${species === 'cat' ? ' selected' : ''}>Кошки</option>
          <option value="dog"${species === 'dog' ? ' selected' : ''}>Собаки</option>
        </select>
        <select name="size">
          <option value="">Все размеры</option>
          ${['mini','small','medium','large','giant'].map((value) => `<option value="${value}"${size === value ? ' selected' : ''}>${value}</option>`).join('')}
        </select>
        <button class="primary" type="submit">Найти</button>
        <a class="button" href="/breeds">Сбросить</a>
      </form>
      <div class="tablewrap"><table>
        <thead><tr><th>Порода</th><th>Вид</th><th>Размер</th><th>Высота</th><th>Вес</th><th>Жизнь</th><th>Шерсть</th><th>Брахи</th><th>Риски</th></tr></thead>
        <tbody>${rows.map((breed) => `
          <tr>
            <td><a href="/breed/${breed.id}"><b>${esc(breed.name_ru)}</b></a><div class="muted small">${esc(breed.name_en || '')}</div></td>
            <td>${speciesLabel(breed.species)}</td>
            <td>${esc(breed.size_class || '—')}</td>
            <td>${breed.height_min_cm || breed.height_max_cm ? num(breed.height_min_cm) + '–' + num(breed.height_max_cm) + ' см' : '—'}</td>
            <td>${breed.weight_min_kg || breed.weight_max_kg ? num(breed.weight_min_kg) + '–' + num(breed.weight_max_kg) + ' кг' : '—'}</td>
            <td>${breed.lifespan_min_years || breed.lifespan_max_years ? num(breed.lifespan_min_years) + '–' + num(breed.lifespan_max_years) + ' лет' : '—'}</td>
            <td>${esc(breed.coat_type || '—')}</td>
            <td>${breed.brachycephalic ? '<span class="badge amber">да</span>' : 'нет'}</td>
            <td>${breed.risks}</td>
          </tr>`).join('') || '<tr><td colspan="9" class="empty">Ничего не найдено</td></tr>'}</tbody>
      </table></div>
    `
  });
}

function breedPage(id) {
  const breed = get('SELECT * FROM breed WHERE id = ?', id);
  if (!breed) return null;
  const weights = all('SELECT sex, age_stage, min_kg, max_kg FROM breed_weight WHERE breed_id = ?', id);
  const risks = all(`
    SELECT c.name_ru, c.category, bp.prevalence_text, bp.evidence_level, bp.age_of_onset, bp.notes, s.name AS source_name
      FROM breed_predisposition bp
      JOIN condition c ON c.id = bp.condition_id
      LEFT JOIN source s ON s.id = bp.source_id
     WHERE bp.breed_id = ?
     ORDER BY CASE bp.evidence_level WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END`, id);
  const tests = all('SELECT gene, mutation, inheritance, test_available FROM genetic_test WHERE breed_id = ?', id);

  return layout({
    title: breed.name_ru,
    active: 'breeds',
    body: `
      <div class="crumb"><a href="/breeds">Породы</a> / ${esc(breed.name_ru)}</div>
      <div class="detail-title"><h1>${esc(breed.name_ru)}</h1><span class="badge">${speciesLabel(breed.species)}</span>${breed.brachycephalic ? '<span class="badge amber">брахицефалия</span>' : ''}</div>
      <p class="sub">${esc(breed.name_en || '')} · FCI ${esc(breed.fci_group || '—')} · ${esc(breed.origin_country || '')}</p>
      <div class="grid2">
        <div class="box"><h3>Физиология</h3><div class="kv">
          <span class="k">Высота</span><span class="v">${num(breed.height_min_cm)}–${num(breed.height_max_cm)} см</span>
          <span class="k">Вес</span><span class="v">${num(breed.weight_min_kg)}–${num(breed.weight_max_kg)} кг</span>
          <span class="k">Жизнь</span><span class="v">${num(breed.lifespan_min_years)}–${num(breed.lifespan_max_years)} лет</span>
          <span class="k">Шерсть</span><span class="v">${esc(breed.coat_type || '—')}</span>
          <span class="k">Груминг</span><span class="v">${esc(breed.grooming_level || '—')}</span>
        </div></div>
        <div class="box"><h3>Вес по полу</h3><ul class="clean">${weights.map((item) => `<li>${esc(item.sex || 'any')} / ${esc(item.age_stage || '')}: ${num(item.min_kg)}–${num(item.max_kg)} кг</li>`).join('') || '<li class="muted">Нет</li>'}</ul></div>
      </div>
      <h2 style="margin-top:20px">Наследственные риски</h2>
      <div class="tablewrap"><table style="min-width:700px">
        <thead><tr><th>Болезнь</th><th>Категория</th><th>Риск</th><th>Доказательность</th><th>Источник</th></tr></thead>
        <tbody>${risks.map((item) => `<tr><td><b>${esc(item.name_ru)}</b></td><td>${esc(item.category || '—')}</td><td>${esc(item.prevalence_text || '—')}</td><td>${esc(item.evidence_level)}</td><td>${esc(item.source_name || '—')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Нет</td></tr>'}</tbody>
      </table></div>
      <h2 style="margin-top:20px">Генетические тесты</h2>
      <ul class="clean">${tests.map((item) => `<li>${esc(item.gene)} ${esc(item.mutation || '')} <span class="muted">(${esc(item.inheritance || '')})</span></li>`).join('') || '<li class="muted">Нет</li>'}</ul>
    `
  });
}

function certificatesPage(params) {
  const status = params.get('status') || '';
  const rows = all(`
    SELECT c.*, b.name AS brand, p.name AS product
      FROM certificate c
      LEFT JOIN brand b ON b.id = c.brand_id
      LEFT JOIN product p ON p.id = c.product_id
     ${status ? 'WHERE c.status = ?' : ''}
     ORDER BY c.status, b.name`, ...(status ? [status] : []));

  return layout({
    title: 'Сертификаты',
    active: 'certificates',
    body: `
      <h1>Сертификаты</h1>
      <p class="sub">${rows.length} записей · декларации и сертификаты, найденные агентом</p>
      <form class="filters" method="get" action="/certificates">
        <select name="status">
          <option value="">Все статусы</option>
          <option value="found"${status === 'found' ? ' selected' : ''}>found</option>
          <option value="not_found"${status === 'not_found' ? ' selected' : ''}>not_found</option>
        </select>
        <button class="primary" type="submit">Фильтр</button>
        <a class="button" href="/certificates">Сбросить</a>
      </form>
      <div class="tablewrap"><table>
        <thead><tr><th>Бренд</th><th>Продукт</th><th>Тип</th><th>Область</th><th>Статус</th><th>Номер</th><th>Документ</th><th>Комментарий</th></tr></thead>
        <tbody>${rows.map((item) => `<tr>
          <td>${esc(item.brand || '—')}</td><td>${esc(item.product || '—')}</td><td>${esc(item.type || '—')}</td><td>${esc(item.scope || '—')}</td>
          <td>${item.status === 'found' ? '<span class="badge green">found</span>' : '<span class="badge red">not_found</span>'}</td>
          <td>${esc(item.number || '—')}</td>
          <td>${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">открыть</a>` : '—'}</td>
          <td class="small">${esc(item.notes || '')}</td>
        </tr>`).join('') || '<tr><td colspan="8" class="empty">Нет</td></tr>'}</tbody>
      </table></div>
    `
  });
}

function coveragePage() {
  const products = count('SELECT COUNT(*) AS n FROM product');
  const brands = count('SELECT COUNT(DISTINCT brand_id) AS n FROM product');
  const nutrients = count('SELECT COUNT(*) AS n FROM product_nutrient');
  const withMe = count("SELECT COUNT(DISTINCT pn.product_id) AS n FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id WHERE n.code = 'me'");
  const withMoisture = count("SELECT COUNT(DISTINCT pn.product_id) AS n FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id WHERE n.code = 'moisture'");
  const certificates = count('SELECT COUNT(*) AS n FROM certificate');
  const found = count("SELECT COUNT(*) AS n FROM certificate WHERE status = 'found'");
  const failed = count("SELECT COUNT(*) AS n FROM extraction_run WHERE status = 'failed'");
  const sourcePages = count('SELECT COUNT(*) AS n FROM product_source_page');

  const brandRows = all(`
    SELECT b.name, COUNT(p.id) AS n
      FROM brand b JOIN product p ON p.brand_id = b.id
     GROUP BY b.name ORDER BY n DESC, b.name`);

  return layout({
    title: 'Покрытие',
    active: 'coverage',
    body: `
      <h1>Покрытие</h1>
      <p class="sub">Что собрано и где ещё дыры</p>
      <div class="cards">
        <div class="card"><div class="num">${products}</div><div class="lbl">SKU</div></div>
        <div class="card"><div class="num">${brands}</div><div class="lbl">Брендов</div></div>
        <div class="card"><div class="num">${nutrients}</div><div class="lbl">Строк нутриентов</div></div>
        <div class="card"><div class="num">${withMe}</div><div class="lbl">С ME</div></div>
        <div class="card"><div class="num">${withMoisture}</div><div class="lbl">С влагой</div></div>
        <div class="card"><div class="num">${sourcePages}</div><div class="lbl">Страниц-источников</div></div>
        <div class="card"><div class="num">${certificates}</div><div class="lbl">Сертификатов</div></div>
        <div class="card"><div class="num">${failed}</div><div class="lbl">Ошибок сбора</div></div>
      </div>
      <div class="grid2">
        <div class="box"><h3>Бренды</h3><div class="kv">${brandRows.map((row) => `<span class="k">${esc(row.name)}</span><span class="v">${row.n}</span>`).join('')}</div></div>
        <div class="box"><h3>Что проверить</h3><ul class="clean">
          <li>ME отсутствует у ${products - withMe} SKU</li>
          <li>Влага отсутствует у ${products - withMoisture} SKU</li>
          <li>Найдено сертификатов: ${found}</li>
          <li>Ошибок извлечения: ${failed}</li>
        </ul></div>
      </div>
    `
  });
}

function exportCsv(params) {
  const where = productWhere(params);
  const rows = all(`
    SELECT p.id, b.name AS brand, p.name, p.species, p.form, p.completeness, p.class, p.food_per_kg_day,
           (SELECT pn.amount FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id
             WHERE pn.product_id = p.id AND n.code = 'protein' AND pn.basis = 'as_fed' LIMIT 1) AS protein,
           (SELECT pn.amount FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id
             WHERE pn.product_id = p.id AND n.code = 'fat' AND pn.basis = 'as_fed' LIMIT 1) AS fat,
           (SELECT pn.amount FROM product_nutrient pn JOIN nutrient n ON n.id = pn.nutrient_id
             WHERE pn.product_id = p.id AND n.code = 'me' AND pn.basis = 'as_fed' LIMIT 1) AS me,
           p.source_url
      FROM product p JOIN brand b ON b.id = p.brand_id
      ${where.sql}
      ORDER BY b.name, p.name`, ...where.args);

  const header = ['id','brand','name','species','form','completeness','class','food_per_kg_day','protein','fat','me','source_url'];
  const escapeCsv = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
  const body = [header.join(';'), ...rows.map((row) => header.map((key) => escapeCsv(row[key])).join(';'))].join('\n');
  return '\ufeff' + body;
}

/* -------------------------------------------------------------------------- */
/* HTTP                                                                       */
/* -------------------------------------------------------------------------- */

function sendHtml(res, html, status = 200) {
  const body = Buffer.from(html, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendCsv(res, csv) {
  const body = Buffer.from(csv, 'utf8');
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="petdata.csv"',
    'Content-Length': body.length
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const params = url.searchParams;

    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (pathname === '/export.csv') {
      sendCsv(res, exportCsv(params));
      return;
    }

    if (pathname === '/') {
      sendHtml(res, productsPage(params));
      return;
    }

    const productMatch = pathname.match(/^\/product\/(\d+)$/);
    if (productMatch) {
      const page = productPage(productMatch[1]);
      if (page) sendHtml(res, page);
      else sendHtml(res, layout({ title: 'Не найдено', active: 'products', body: '<h1>404</h1><p>Продукт не найден.</p>' }), 404);
      return;
    }

    if (pathname === '/breeds') {
      sendHtml(res, breedsPage(params));
      return;
    }

    const breedMatch = pathname.match(/^\/breed\/(\d+)$/);
    if (breedMatch) {
      const page = breedPage(breedMatch[1]);
      if (page) sendHtml(res, page);
      else sendHtml(res, layout({ title: 'Не найдено', active: 'breeds', body: '<h1>404</h1><p>Порода не найдена.</p>' }), 404);
      return;
    }

    if (pathname === '/certificates') {
      sendHtml(res, certificatesPage(params));
      return;
    }

    if (pathname === '/coverage') {
      sendHtml(res, coveragePage());
      return;
    }

    sendHtml(res, layout({ title: 'Не найдено', active: 'products', body: '<h1>404</h1><p>Страница не найдена.</p>' }), 404);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Внутренняя ошибка');
  }
});

const { startMdns, lanAddress } = require('./mdns');
const { startLlmnr } = require('./llmnr');

const port = Number.parseInt(process.env.PETDATA_UI_PORT || '8790', 10);
// 0.0.0.0 — слушать все интерфейсы, чтобы открывалось с телефона в домашней сети.
// Только локально: PETDATA_UI_HOST=127.0.0.1.
const host = process.env.PETDATA_UI_HOST || '0.0.0.0';
server.listen(port, host, () => {
  console.log(`PetData UI: http://127.0.0.1:${port}/ (bind ${host})`);
  // Локальное имя вида korma.local (mDNS). Отключается: PETDATA_MDNS=off
  const mdnsName = (process.env.PETDATA_MDNS_NAME || 'korma').trim();
  if (process.env.PETDATA_MDNS !== 'off' && host === '0.0.0.0') {
    lanAddress().then((ip) => {
      startMdns({ hostname: mdnsName, ip });
      startLlmnr({ hostname: mdnsName, ip });
      console.log(`В сети: http://${mdnsName}.local:${port}/, http://${mdnsName}:${port}/ или http://${ip}:${port}/`);
    });
  }
  console.log(`DB: ${dbPath}`);
});
