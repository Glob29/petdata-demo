#!/usr/bin/env node
'use strict';

/*
 * Приводит фасовки и цены к данным карточки ритейлера.
 *
 * Проблема, которую решает:
 *   - вес брался из общего текста страницы и иногда попадал из фразы
 *     «для собак весом менее 10 кг» (вес животного, а не упаковки);
 *   - цена могла относиться к другой фасовке, чем та, что записана в package;
 *   - на карточке 4lapy есть блок «Вес упаковки» — список всех фасовок с ценой за килограмм.
 *     Это единственный непротиворечивый источник: цена и вес там связаны самим ритейлером.
 *
 * Логика:
 *   1. Если блок есть — пересобираем package и цены этого товара строго по нему
 *      (₽/г = ₽/кг / 1000, вес упаковки = ₽/кг × кг).
 *   2. Если блока нет — вес правим только при явной непротиворечивости:
 *      новый вес даёт правдоподобную цену за грамм, а старый — нет.
 *      Иначе оставляем как есть и выводим в список на ручную проверку.
 *
 * Запуск: node db/enrich-packages.js [--dry-run]
 * Идемпотентен: дата наблюдения берётся из даты выборки страницы.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { extractOfferVariants, parseGrams } = require('../agent/lib/offers');
const { computePrices } = require('./compute-prices');

const root = path.join(__dirname, '..');
const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
const cacheDir = path.join(root, 'agent', 'cache');
const dryRun = process.argv.includes('--dry-run');

// Правдоподобные границы цены за грамм, ₽/г. Нужны, чтобы отличить «вес не тот» от «цена не та».
const BAND = {
  dry: [0.15, 6],
  wet: [0.25, 10],
  unknown: [0.1, 12]
};

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

const cachePath = (url) => path.join(cacheDir, crypto.createHash('sha1').update(url).digest('hex') + '.html');
const isMultipackName = (name) => /(\d+)\s*[xх×]\s*(\d+(?:[.,]\d+)?)\s*гр/i.test(name || '');

function jsonLdName(html) {
  let name = null;
  for (const match of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      for (const item of Array.isArray(data) ? data : [data]) {
        if (item && item['@type'] === 'Product' && item.name) name = item.name;
      }
    } catch {
      // битый JSON-LD пропускаем
    }
  }
  return name;
}

/*
 * JSON-LD описывает именно тот вариант, что открыт по URL: и название с фасовкой,
 * и цену. Это спасает карточки, где блок «Вес упаковки» показывает «Нет»
 * (товар недоступен в регионе), а цена на странице относится к соседней фасовке.
 */
function jsonLdProduct(html) {
  let result = null;
  for (const match of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      for (const item of Array.isArray(data) ? data : [data]) {
        if (!item || item['@type'] !== 'Product') continue;
        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        const price = offer ? Number(offer.price) : null;
        result = { name: item.name || null, price: Number.isFinite(price) ? price : null };
      }
    } catch {
      // битый JSON-LD пропускаем
    }
  }
  return result;
}

// Последний размер в URL: «…-1-9-kg-…», «…-400-gr-…». Дефис = десятичный разделитель.
function urlGrams(url) {
  const matches = [...String(url).matchAll(/-(\d+(?:[.,-]\d+)?)-(kg|g|gr|г|кг)-/gi)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1];
  const value = Number(String(last[1]).replace(',', '.').replace(/-/g, '.'));
  if (!value) return null;
  return Math.round(/kg|кг/i.test(last[2]) ? value * 1000 : value);
}

const inBand = (form, perGram) => {
  if (!Number.isFinite(perGram)) return false;
  const [min, max] = BAND[form] || BAND.unknown;
  return perGram >= min && perGram <= max;
};

const stats = {
  products: 0,
  pages: 0,
  rebuilt_from_offers: 0,
  weight_fixed: 0,
  from_jsonld: 0,
  weight_skipped: 0,
  packages_removed: 0,
  prices_replaced: 0
};
const weightChanges = [];
const review = [];

db.exec('BEGIN');
try {
  const products = db
    .prepare(
      `SELECT p.id, p.name, p.form, p.source_id,
              psp.url, psp.fetched_at,
              (SELECT COUNT(*) FROM package pk WHERE pk.product_id = p.id) AS package_count,
              (SELECT MIN(weight_g) FROM package pk WHERE pk.product_id = p.id) AS weight_g
         FROM product p
         JOIN product_source_page psp ON psp.product_id = p.id
        ORDER BY p.id`
    )
    .all();
  stats.products = products.length;

  for (const product of products) {
    const file = cachePath(product.url);
    if (!fs.existsSync(file)) continue;
    stats.pages += 1;

    const html = fs.readFileSync(file, 'utf8');
    const host = (() => {
      try {
        return new URL(product.url).hostname.replace(/^www\./, '');
      } catch {
        return null;
      }
    })();
    const retailer = host ? host.split('.')[0] : null;

    const allOffers = extractOfferVariants(html, product.url);
    const offers = allOffers.filter((offer) => offer.price_per_kg);
    const ldName = jsonLdName(html);

    // Мультипаки («10х85 г») уже нормализованы как 85 г × 10 — не пересобираем их по блоку,
    // иначе появится второй вариант представления той же упаковки.
    if (offers.length && !isMultipackName(product.name)) {
      stats.rebuilt_from_offers += 1;
      const wanted = new Set(offers.map((offer) => offer.grams));
      const packages = db.prepare('SELECT id, weight_g, pack_count FROM package WHERE product_id = ?').all(product.id);

      // Блок ритейлера — самодостаточный источник по всем фасовкам этого товара:
      // прежние цены (в том числе из других магазинов) убираем, иначе средняя смешивает разные упаковки.
      if (!dryRun) {
        for (const pkg of packages) {
          db.prepare('DELETE FROM price_snapshot WHERE package_id = ?').run(pkg.id);
        }
      }

      for (const pkg of packages) {
        if (wanted.has(pkg.weight_g) && (pkg.pack_count || 1) === 1) continue;
        // Фасовки, которых нет в актуальном списке ритейлера, убираем вместе с их ценами.
        if (!dryRun) {
          db.prepare('DELETE FROM price_snapshot WHERE package_id = ?').run(pkg.id);
          db.prepare('DELETE FROM package WHERE id = ?').run(pkg.id);
        }
        stats.packages_removed += 1;
      }

      for (const offer of offers) {
        let pkg = db
          .prepare('SELECT id FROM package WHERE product_id = ? AND weight_g = ? AND COALESCE(pack_count, 1) = 1')
          .get(product.id, offer.grams);

        if (!pkg) {
          if (dryRun) continue;
          const result = db
            .prepare(
              `INSERT INTO package (product_id, weight_g, pack_count, gtin, currency, region, source_id)
               VALUES (?, ?, 1, NULL, 'RUB', 'RU', ?)`
            )
            .run(product.id, offer.grams, product.source_id);
          pkg = { id: Number(result.lastInsertRowid) };
        }

        // Цена за упаковку из цены за килограмм: 750 ₽/кг × 4 кг = 3000 ₽.
        const price = Math.round(((offer.price_per_kg * offer.grams) / 1000) * 100) / 100;
        const url = offer.url || product.url;

        if (dryRun) continue;
        db.prepare(
          `INSERT INTO price_snapshot (product_id, package_id, price, currency, region, retailer, url, observed_at)
           VALUES (?, ?, ?, 'RUB', 'RU', ?, ?, ?)`
        ).run(product.id, pkg.id, price, retailer, url, product.fetched_at);
        stats.prices_replaced += 1;
      }
      continue;
    }

    // --- Сценарий В: JSON-LD знает и фасовку, и цену того варианта, что открыт по URL ---
    const ld = jsonLdProduct(html);
    // Только когда блок фасовок есть, но цен в нём нет («Нет» — товар недоступен в регионе).
    const blockWithoutPrices = allOffers.length > 0 && offers.length === 0;
    if (blockWithoutPrices && ld && ld.name && ld.price && product.package_count <= 1 && !isMultipackName(ld.name)) {
      const size = parseGrams(ld.name);
      if (size) {
        const pkg = db.prepare('SELECT id, weight_g FROM package WHERE product_id = ?').get(product.id);
        if (!dryRun) {
          if (pkg && pkg.weight_g !== size) {
            db.prepare('UPDATE package SET weight_g = ? WHERE id = ?').run(size, pkg.id);
          }
          const targetId = pkg
            ? pkg.id
            : Number(
                db
                  .prepare(
                    `INSERT INTO package (product_id, weight_g, pack_count, gtin, currency, region, source_id)
                     VALUES (?, ?, 1, NULL, 'RUB', 'RU', ?)`
                  )
                  .run(product.id, size, product.source_id).lastInsertRowid
              );
          // Прежняя цена могла относиться к другой фасовке — заменяем ценой этого варианта.
          db.prepare('DELETE FROM price_snapshot WHERE product_id = ?').run(product.id);
          db.prepare(
            `INSERT INTO price_snapshot (product_id, package_id, price, currency, region, retailer, url, observed_at)
             VALUES (?, ?, ?, 'RUB', 'RU', ?, ?, ?)`
          ).run(product.id, targetId, ld.price, retailer, product.url, product.fetched_at);
        }
        stats.from_jsonld += 1;
        if (product.weight_g !== size) {
          weightChanges.push({ id: product.id, from: product.weight_g, to: size, name: product.name.slice(0, 55) });
        }
        continue;
      }
    }

    // --- Сценарий Б: блока нет — правим вес только при явной непротиворечивости --
    if (isMultipackName(product.name)) continue;
    if (product.package_count !== 1 || !product.weight_g) continue;

    const candidate =
      (ldName && !isMultipackName(ldName) ? parseGrams(ldName) : null) || urlGrams(product.url);
    if (!candidate || candidate === product.weight_g) continue;

    const priceAvg = db
      .prepare('SELECT AVG(price) AS price FROM price_snapshot WHERE product_id = ?')
      .get(product.id).price;

    if (!priceAvg) {
      stats.weight_skipped += 1;
      review.push({ id: product.id, name: product.name.slice(0, 55), from: product.weight_g, to: candidate, reason: 'нет цены для проверки' });
      continue;
    }

    const perGramOld = priceAvg / product.weight_g;
    const perGramNew = priceAvg / candidate;

    if (inBand(product.form, perGramNew) && !inBand(product.form, perGramOld)) {
      if (!dryRun) {
        db.prepare('UPDATE package SET weight_g = ? WHERE product_id = ?').run(candidate, product.id);
      }
      stats.weight_fixed += 1;
      weightChanges.push({ id: product.id, from: product.weight_g, to: candidate, name: product.name.slice(0, 55) });
    } else {
      stats.weight_skipped += 1;
      review.push({
        id: product.id,
        name: product.name.slice(0, 55),
        from: product.weight_g,
        to: candidate,
        reason: `${perGramOld.toFixed(2)} → ${perGramNew.toFixed(2)} ₽/г`
      });
    }
  }

  if (dryRun) {
    db.exec('ROLLBACK');
  } else {
    stats.price_stats = computePrices(db);
    db.exec('COMMIT');
  }
} catch (error) {
  db.exec('ROLLBACK');
  db.close();
  console.error('Откатано:', error.message);
  process.exit(1);
}

const after = {
  packages: db.prepare('SELECT COUNT(*) AS n FROM package').get().n,
  prices: db.prepare('SELECT COUNT(*) AS n FROM price_snapshot').get().n,
  with_price_per_g: db.prepare('SELECT COUNT(*) AS n FROM package WHERE price_per_g IS NOT NULL').get().n
};
db.close();

console.log(`DB: ${dbPath}${dryRun ? ' (dry-run, без записи)' : ''}`);
console.log(JSON.stringify({ ...stats, after }, null, 2));

if (weightChanges.length) {
  console.log('\nВес исправлен:');
  for (const change of weightChanges) {
    console.log(`  #${String(change.id).padEnd(4)} ${change.from} г → ${change.to} г  ${change.name}`);
  }
}
if (review.length) {
  console.log(`\nНа ручную проверку (${review.length}):`);
  for (const item of review.slice(0, 15)) {
    console.log(`  #${String(item.id).padEnd(4)} ${item.from} г / вариант ${item.to} г — ${item.reason}  ${item.name}`);
  }
  if (review.length > 15) console.log(`  … и ещё ${review.length - 15}`);
}
