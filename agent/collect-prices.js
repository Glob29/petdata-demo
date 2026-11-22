#!/usr/bin/env node
'use strict';

/*
 * Добирает цены с 4lapy для товаров, у которых их нет.
 *
 * Как работает:
 *   1. Обходит каталог 4lapy с фильтром по бренду (кошки/собаки × сухой/влажный, до N страниц).
 *   2. Загружает карточки (через общий кэш agent/lib/http.js) и разбирает блок «Вес упаковки»:
 *      для каждой фасовки там есть цена за килограмм.
 *   3. Сопоставляет карточки ритейлера с нашими SKU по названию и весу фасовки.
 *   4. Пишет кандидатов в agent/price-matches.json; с --apply добавляет package и price_snapshot,
 *      затем пересчитывает ₽/г.
 *
 * Запуск:
 *   node agent/collect-prices.js --brand=hill-s
 *   node agent/collect-prices.js --brand=hill-s --apply --min-score=0.55
 *   node agent/collect-prices.js --all --apply
 *
 * Точность намеренно приблизительная: задача — покрытие и порядок цен,
 * спорные совпадения попадают в отчёт, а не в базу.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { fetchText, sleep } = require('./lib/http');
const { extractOfferVariants } = require('./lib/offers');
const { computePrices } = require('../db/compute-prices');

const root = path.join(__dirname, '..');
const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
const reportPath = path.join(__dirname, 'price-matches.json');

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const hit = args.find((item) => item.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
const apply = args.includes('--apply');
const runAll = args.includes('--all');
const minScore = Number(getArg('min-score', '0.5'));
const maxPages = Number(getArg('pages', '3'));
const maxProducts = Number(getArg('max-products', '120'));

// Бренд → префиксы слагов в URL 4lapy. Фильтр каталога через ?brand= на сервере не работает,
// поэтому берём товарные URL из sitemap и отбираем по слагу.
const BRAND_PREFIXES = {
  "Hill's": ['hills-'],
  Grandorf: ['grandorf-'],
  Whiskas: ['whiskas-', 'viskas-'],
  Мнямс: ['mnyams-'],
  'Perfect Fit': ['perfect-fit-'],
  Monge: ['monge-'],
  Felix: ['felix-'],
  'Purina Pro Plan': ['pro-plan-', 'purina-pro-plan-'],
  'Royal Canin': ['royal-canin-'],
  'Purina One': ['purina-one-']
};

const SITEMAP_CACHE = path.join(__dirname, 'cache', '4lapy-sitemap-urls.txt');
const SITEMAPS = [
  'https://4lapy.ru/sitemaps/sitemap-product.xml',
  'https://4lapy.ru/sitemaps/sitemap-product.part1.xml'
];

const STOPWORDS = new Set([
  'корм', 'корма', 'сухой', 'сухая', 'сухие', 'влажный', 'влажная', 'влажные', 'консервы', 'пауч',
  'для', 'кошек', 'кошки', 'кошкам', 'собак', 'собаки', 'собакам', 'котов', 'котят', 'щенков',
  'и', 'с', 'со', 'в', 'на', 'по', 'из', 'от', 'до', 'гр', 'г', 'кг', 'мл',
  'the', 'and', 'with', 'for', 'cats', 'cat', 'dogs', 'dog', 'food'
]);

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’']/g, '')
    // Терапевтические коды (k/d, c/d, i/d) — смысловой центр названия, их нельзя терять.
    .replace(/([a-zа-я])\s*\/\s*([a-zа-я])\b/gi, '$1$2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Грубое усечение русских окончаний: «ягненка»/«ягненком» → «ягненк»,
// «кошек»/«кошки» → «кош». Без этого одинаковые по смыслу названия не совпадают.
const ENDINGS = ['ами', 'ями', 'ыми', 'ими', 'ого', 'его', 'ому', 'ему', 'ых', 'их', 'ая', 'ые', 'ий', 'ый', 'ой', 'ей',
  'ом', 'ем', 'ам', 'ям', 'ах', 'ях', 'ов', 'ев', 'ек', 'ок', 'ка', 'ки', 'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'о'];

function stem(token) {
  if (token.length <= 4) return token;
  for (const ending of ENDINGS) {
    if (token.length - ending.length >= 4 && token.endsWith(ending)) {
      return token.slice(0, -ending.length);
    }
  }
  return token;
}

function tokens(text) {
  return normalize(text)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map(stem);
}

function containment(a, b) {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const token of a) if (b.has(token)) common += 1;
  return common / Math.min(a.size, b.size);
}

function productUrlFromHref(href) {
  const match = String(href).match(/^\/product\/([^/?#]+)/);
  return match ? 'https://4lapy.ru/product/' + match[1] + '/' : null;
}

async function sitemapUrls() {
  if (fs.existsSync(SITEMAP_CACHE)) {
    return fs.readFileSync(SITEMAP_CACHE, 'utf8').split('\n').filter(Boolean);
  }
  const urls = [];
  for (const sitemap of SITEMAPS) {
    const response = await fetchText(sitemap);
    for (const match of response.html.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(match[1]);
  }
  fs.mkdirSync(path.dirname(SITEMAP_CACHE), { recursive: true });
  fs.writeFileSync(SITEMAP_CACHE, urls.join('\n'), 'utf8');
  return urls;
}

function brandUrls(allUrls, brandName) {
  const prefixes = BRAND_PREFIXES[brandName] || [];
  return allUrls.filter((url) => {
    const slug = url.split('/product/')[1] || '';
    return prefixes.some((prefix) => slug.startsWith(prefix));
  });
}

/*
 * 4lapy рендерит страницу через Next.js: в <script id="__NEXT_DATA__"> лежит состояние,
 * где для каждой фасовки есть weight_netto.weightInGrams и price.priceValue.
 * Это надёжнее, чем разбирать HTML: цены есть даже у «недоступных в регионе» товаров.
 */
function parseNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }
  const pageProps = data.props && data.props.pageProps;
  const product = pageProps && pageProps.initialState && pageProps.initialState.product;
  const entity = (product && product.product) || null;
  if (!entity || !Array.isArray(entity.offers)) return null;

  const name = entity.name || (pageProps.activeOffer && pageProps.activeOffer.name) || null;
  const offers = [];
  for (const offer of entity.offers) {
    const attrs = [...(offer.offerAttributes || []), ...(offer.snippetAttributes || [])];
    const weightAttr = attrs.find((attr) => attr && attr.code === 'weight_netto');
    const value = weightAttr && weightAttr.values && weightAttr.values[0];
    const grams = value && value.weightInGrams;
    const price = offer.price && offer.price.priceValue;
    if (!grams || !price) continue;
    offers.push({
      grams: Number(grams),
      price: Number(price),
      price_per_kg: Math.round((Number(price) / Number(grams)) * 1000),
      available: Boolean(offer.available),
      url: offer.url ? new URL(offer.url, 'https://4lapy.ru').href : null
    });
  }
  return { name, offers };
}

function jsonLdProduct(html) {
  let result = { name: null, brand: null };
  for (const match of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      for (const item of Array.isArray(data) ? data : [data]) {
        if (!item || item['@type'] !== 'Product') continue;
        result = { name: item.name || null, brand: item.brand && (item.brand.name || item.brand) || null };
      }
    } catch {
      // битый JSON-LD пропускаем
    }
  }
  return result;
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
    ? Object.keys(BRAND_PREFIXES)
    : [getArg('brand')].filter(Boolean).map((value) => {
        const entry = Object.entries(BRAND_PREFIXES).find(
          ([name, prefixes]) => name === value || prefixes.includes(value) || prefixes.includes(value + '-')
        );
        return entry ? entry[0] : value;
      });

  if (!brands.length) {
    console.error('Укажите бренд: --brand=hill-s или --all');
    process.exit(1);
  }

  const matches = [];
  const stats = { brands: brands.length, pages: 0, offers_total: 0, matched: 0, applied: 0 };

  const allUrls = await sitemapUrls();
  console.log(`товарных URL в sitemap: ${allUrls.length}`);

  for (const brandName of brands) {
    if (!BRAND_PREFIXES[brandName]) {
      console.log(`бренд без префикса слага: ${brandName}`);
      continue;
    }
    const products = loadProducts(db, brandName);
    if (!products.length) {
      console.log(`${brandName}: все SKU уже с ценами`);
      continue;
    }

    const urls = brandUrls(allUrls, brandName).slice(0, maxProducts);
    console.log(`\n${brandName}: ${products.length} SKU без цены, кандидатов в sitemap: ${urls.length}`);

    for (const url of urls) {
      let page;
      try {
        page = await fetchText(url);
      } catch (error) {
        continue;
      }
      stats.pages += 1;

      const nextData = parseNextData(page.html);
      let offers = [];
      let pageName = null;
      if (nextData && nextData.offers.length) {
        offers = nextData.offers;
        pageName = nextData.name;
      } else {
        offers = extractOfferVariants(page.html, url).filter((offer) => offer.price_per_kg);
        pageName = (jsonLdProduct(page.html) || {}).name;
      }
      if (!offers.length) continue;
      stats.offers_total += offers.length;

      const ld = { name: pageName };
      const offerTokens = new Set(tokens(`${ld.name || ''} ${url}`));
      const offerWeights = new Set(offers.map((offer) => offer.grams));

      const offerText = normalize(`${ld.name || ''} ${url.replace(/-/g, ' ')}`);
      const offerSpecies = /кошк|кот|cat|feline/.test(offerText) ? 'cat' : /собак|пес|dog|canine/.test(offerText) ? 'dog' : null;
      const offerForm = /влажн|консерв|пауч|wet|pouch/.test(offerText) ? 'wet' : /сух|dry/.test(offerText) ? 'dry' : null;

      let best = null;
      for (const product of products) {
        if (offerSpecies && product.species && offerSpecies !== product.species) continue;
        if (offerForm && product.form && product.form !== 'unknown' && offerForm !== product.form) continue;

        const overlap = containment(product.tokens, offerTokens);
        const jaccard = (() => {
          const union = new Set([...product.tokens, ...offerTokens]);
          let common = 0;
          for (const token of product.tokens) if (offerTokens.has(token)) common += 1;
          return union.size ? common / union.size : 0;
        })();
        const score = 0.6 * overlap + 0.4 * jaccard;
        const weightHit = [...offerWeights].some((grams) => product.weights.has(grams));
        const total = score + (weightHit ? 0.15 : 0);
        if (!best || total > best.total) best = { product, score, weightHit, total };
      }
      if (!best) continue;

      matches.push({
        brand: brandName,
        product_id: best.product.id,
        product_name: best.product.name,
        retailer_url: url,
        retailer_name: ld.name,
        score: Number(best.score.toFixed(3)),
        weight_hit: best.weightHit,
        // Вид и форма уже проверены выше; вес — бонус к уверенности, но не обязательное условие:
        // у части SKU вес в базе неполный, а цена нужна приблизительная.
        accepted: best.score >= minScore,
        offers: offers.map((offer) => ({ grams: offer.grams, price_per_kg: offer.price_per_kg, url: offer.url }))
      });
      await sleep(350);
    }
  }

  matches.sort((a, b) => b.score - a.score);
  fs.writeFileSync(reportPath, JSON.stringify({ generated_at: new Date().toISOString(), stats, matches }, null, 2));

  const accepted = matches.filter((item) => item.accepted);

  // Жадное назначение: одна карточка ритейлера — один SKU, один SKU — одна карточка.
  // Иначе несколько похожих товаров получают цену с одной и той же страницы.
  const byProduct = new Map();
  const usedPages = new Set();
  for (const item of [...accepted].sort((a, b) => b.score - a.score)) {
    if (byProduct.has(item.product_id) || usedPages.has(item.retailer_url)) continue;
    byProduct.set(item.product_id, item);
    usedPages.add(item.retailer_url);
  }
  stats.matched = byProduct.size;

  if (apply && byProduct.size) {
    db.exec('BEGIN');
    try {
      for (const item of byProduct.values()) {
        // Пишем только те фасовки, которые уже есть у SKU: чужие размеры из карточки
        // ритейлера не должны появляться в нашей модели.
        const ownWeights = new Set(
          db.prepare('SELECT weight_g FROM package WHERE product_id = ?').all(item.product_id).map((row) => row.weight_g)
        );
        const usable = ownWeights.size
          ? item.offers.filter((offer) => ownWeights.has(offer.grams))
          : item.offers;
        if (!usable.length) continue;

        for (const offer of usable) {
          let pkg = db
            .prepare('SELECT id FROM package WHERE product_id = ? AND weight_g = ? AND COALESCE(pack_count, 1) = 1')
            .get(item.product_id, offer.grams);
          if (!pkg) {
            const result = db
              .prepare(
                `INSERT INTO package (product_id, weight_g, pack_count, gtin, currency, region, source_id)
                 VALUES (?, ?, 1, NULL, 'RUB', 'RU', NULL)`
              )
              .run(item.product_id, offer.grams);
            pkg = { id: Number(result.lastInsertRowid) };
          }
          const price = Math.round(((offer.price_per_kg * offer.grams) / 1000) * 100) / 100;
          const exists = db
            .prepare('SELECT id FROM price_snapshot WHERE package_id = ? AND price = ? AND url = ?')
            .get(pkg.id, price, offer.url || item.retailer_url);
          if (exists) continue;
          db.prepare(
            `INSERT INTO price_snapshot (product_id, package_id, price, currency, region, retailer, url, observed_at)
             VALUES (?, ?, ?, 'RUB', 'RU', '4lapy', ?, date('now'))`
          ).run(item.product_id, pkg.id, price, offer.url || item.retailer_url);
          stats.applied += 1;
        }
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
  console.log(JSON.stringify({ ...stats, accepted: accepted.length, ambiguous: matches.length - accepted.length }, null, 2));
  if (!apply) console.log('\nЭто был прогон без записи. Для записи добавьте --apply');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
