#!/usr/bin/env node
'use strict';

/*
 * Добирает цены с magizoo.ru — второго ритейлера после 4lapy.
 *
 * Почему magizoo: каталог и бренд-страницы отдаются серверным HTML (в отличие от petshop),
 * а на карточке есть JSON-LD Product с ценой и весом в названии. onlinetrade закрыт капчей.
 *
 * Логика та же, что в collect-prices.js:
 *   бренд → карточки → разбор → сопоставление по названию/виду/форме → запись только тех весов,
 *   которые уже есть у SKU.
 *
 * Запуск:
 *   node agent/collect-prices-magizoo.js --brand=whiskas --apply
 *   node agent/collect-prices-magizoo.js --all --apply
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { fetchText, sleep } = require('./lib/http');
const { computePrices } = require('../db/compute-prices');

const root = path.join(__dirname, '..');
const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
const reportPath = path.join(__dirname, 'price-matches-magizoo.json');

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const hit = args.find((item) => item.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
const apply = args.includes('--apply');
const runAll = args.includes('--all');
const minScore = Number(getArg('min-score', '0.5'));
const maxProducts = Number(getArg('max-products', '60'));

const BRAND_SLUGS = {
  Whiskas: 'whiskas',
  Мнямс: 'mnyams',
  Grandorf: 'grandorf',
  Monge: 'monge',
  'Perfect Fit': 'perfect-fit',
  Felix: 'felix',
  'Royal Canin': 'royal-canin',
  'Purina Pro Plan': 'pro-plan'
};

const STOPWORDS = new Set([
  'корм', 'корма', 'сухой', 'сухая', 'сухие', 'влажный', 'влажная', 'влажные', 'консервы', 'пауч',
  'для', 'кошек', 'кошки', 'кошкам', 'собак', 'собаки', 'собакам', 'котов',
  'и', 'с', 'со', 'в', 'на', 'по', 'из', 'от', 'до', 'гр', 'г', 'кг', 'мл',
  'the', 'and', 'with', 'for', 'cats', 'cat', 'dogs', 'dog', 'food'
]);
const ENDINGS = ['ами', 'ями', 'ыми', 'ими', 'ого', 'его', 'ому', 'ему', 'ых', 'их', 'ая', 'ые', 'ий', 'ый', 'ой', 'ей',
  'ом', 'ем', 'ам', 'ям', 'ах', 'ях', 'ов', 'ев', 'ек', 'ок', 'ка', 'ки', 'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'о'];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’']/g, '')
    .replace(/([a-zа-я])\s*\/\s*([a-zа-я])\b/gi, '$1$2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function stem(token) {
  if (token.length <= 4) return token;
  for (const ending of ENDINGS) {
    if (token.length - ending.length >= 4 && token.endsWith(ending)) return token.slice(0, -ending.length);
  }
  return token;
}

function tokens(text) {
  return normalize(text).split(/\s+/).filter((t) => t.length > 1 && !STOPWORDS.has(t)).map(stem);
}

function containment(a, b) {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const token of a) if (b.has(token)) common += 1;
  return common / Math.min(a.size, b.size);
}

function jaccard(a, b) {
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  let common = 0;
  for (const token of a) if (b.has(token)) common += 1;
  return common / union.size;
}

function gramsFromText(text) {
  // \b в JS не работает перед кириллицей («75 гр»), используем явный lookahead.
  const match = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*(кг|kg|гр|г|g)(?![а-яёa-z])/i);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  if (!value) return null;
  return Math.round(/кг|kg/i.test(match[2]) ? value * 1000 : value);
}

function jsonLdProduct(html) {
  let result = null;
  for (const match of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      for (const item of Array.isArray(data) ? data : [data]) {
        if (!item) continue;
        const product = item['@type'] === 'Product'
          ? item
          : Array.isArray(item['@graph']) && item['@graph'].find((node) => node['@type'] === 'Product');
        if (!product) continue;
        const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
        const price = offer ? Number(offer.price) : null;
        result = { name: product.name || null, price: Number.isFinite(price) ? price : null };
      }
    } catch {
      // битый JSON-LD пропускаем
    }
  }
  return result;
}

async function brandProductLinks(slug) {
  const urls = new Set();
  for (let page = 1; page <= 4; page += 1) {
    const url = page === 1 ? `https://magizoo.ru/brands/${slug}/` : `https://magizoo.ru/brands/${slug}/?page=${page}`;
    let response;
    try {
      response = await fetchText(url);
    } catch {
      break;
    }
    const found = [...new Set([...response.html.matchAll(/href="(\/catalog\/[^"]+\/\d+\/?)"/g)].map((m) => m[1]))];
    const before = urls.size;
    for (const item of found) urls.add('https://magizoo.ru' + item);
    if (urls.size === before) break;
    if (urls.size >= maxProducts) break;
    await sleep(400);
  }
  return [...urls].slice(0, maxProducts);
}

function loadProducts(db, brandName) {
  return db
    .prepare(
      `SELECT p.id, p.name, p.species, p.form, b.name AS brand
         FROM product p JOIN brand b ON b.id = p.brand_id
        WHERE b.name = ?
          AND NOT EXISTS (SELECT 1 FROM price_snapshot ps WHERE ps.product_id = p.id)`
    )
    .all(brandName)
    .map((row) => ({
      ...row,
      tokens: new Set(tokens(row.name)),
      weights: new Set(
        db.prepare('SELECT weight_g FROM package WHERE product_id = ?').all(row.id).map((item) => item.weight_g)
      )
    }));
}

async function main() {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  const brands = runAll
    ? Object.keys(BRAND_SLUGS)
    : [getArg('brand')].filter(Boolean).map((value) => {
        const entry = Object.entries(BRAND_SLUGS).find(([name, slug]) => name === value || slug === value);
        return entry ? entry[0] : value;
      });

  if (!brands.length) {
    console.error('Укажите бренд: --brand=whiskas или --all');
    process.exit(1);
  }

  const matches = [];
  const stats = { brands: brands.length, pages: 0, offers_total: 0, matched: 0, applied: 0 };

  for (const brandName of brands) {
    const slug = BRAND_SLUGS[brandName];
    if (!slug) continue;
    const products = loadProducts(db, brandName);
    if (!products.length) {
      console.log(`${brandName}: все SKU уже с ценами`);
      continue;
    }

    const urls = await brandProductLinks(slug);
    console.log(`\n${brandName}: ${products.length} SKU без цены, карточек: ${urls.length}`);

    for (const url of urls) {
      let page;
      try {
        page = await fetchText(url);
      } catch {
        continue;
      }
      stats.pages += 1;

      const ld = jsonLdProduct(page.html);
      if (!ld || !ld.price) continue;
      const grams = gramsFromText(ld.name);
      if (!grams) continue;
      stats.offers_total += 1;

      const offerText = normalize(`${ld.name || ''} ${url.replace(/-/g, ' ')}`);
      const offerSpecies = /кошк|кот|cat|feline/.test(offerText) ? 'cat' : /собак|пес|dog|canine/.test(offerText) ? 'dog' : null;
      const offerForm = /влажн|консерв|пауч|wet|pouch/.test(offerText) ? 'wet' : /сух|dry/.test(offerText) ? 'dry' : null;
      const offerTokens = new Set(tokens(`${ld.name || ''} ${url}`));

      let best = null;
      for (const product of products) {
        if (offerSpecies && product.species && offerSpecies !== product.species) continue;
        if (offerForm && product.form && product.form !== 'unknown' && offerForm !== product.form) continue;
        const score = 0.6 * containment(product.tokens, offerTokens) + 0.4 * jaccard(product.tokens, offerTokens);
        if (!best || score > best.score) best = { product, score };
      }
      if (!best) continue;

      matches.push({
        brand: brandName,
        product_id: best.product.id,
        product_name: best.product.name,
        retailer_url: url,
        retailer_name: ld.name,
        grams,
        price: ld.price,
        price_per_kg: Math.round((ld.price / grams) * 1000),
        score: Number(best.score.toFixed(3)),
        weight_hit: best.product.weights.has(grams),
        accepted: best.score >= minScore && best.product.weights.has(grams)
      });
      await sleep(300);
    }
  }

  matches.sort((a, b) => b.score - a.score);
  fs.writeFileSync(reportPath, JSON.stringify({ generated_at: new Date().toISOString(), stats, matches }, null, 2));

  const accepted = matches.filter((item) => item.accepted);
  const byProduct = new Map();
  const usedPages = new Set();
  for (const item of accepted) {
    if (byProduct.has(item.product_id) || usedPages.has(item.retailer_url)) continue;
    byProduct.set(item.product_id, item);
    usedPages.add(item.retailer_url);
  }
  stats.matched = byProduct.size;

  if (apply && byProduct.size) {
    db.exec('BEGIN');
    try {
      for (const item of byProduct.values()) {
        const pkg = db
          .prepare('SELECT id FROM package WHERE product_id = ? AND weight_g = ? AND COALESCE(pack_count, 1) = 1')
          .get(item.product_id, item.grams);
        if (!pkg) continue;
        const exists = db
          .prepare('SELECT id FROM price_snapshot WHERE package_id = ? AND price = ? AND url = ?')
          .get(pkg.id, item.price, item.retailer_url);
        if (exists) continue;
        db.prepare(
          `INSERT INTO price_snapshot (product_id, package_id, price, currency, region, retailer, url, observed_at)
           VALUES (?, ?, ?, 'RUB', 'RU', 'magizoo', ?, date('now'))`
        ).run(item.product_id, pkg.id, item.price, item.retailer_url);
        stats.applied += 1;
      }
      computePrices(db);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      db.close();
      console.error('Откатано:', error.message);
      process.exit(1);
    }
  }

  db.close();

  console.log(`\nОтчёт: ${reportPath}`);
  console.log(JSON.stringify({ ...stats, accepted: accepted.length, candidates: matches.length }, null, 2));
  if (!apply) console.log('\nПрогон без записи. Для записи добавьте --apply');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
