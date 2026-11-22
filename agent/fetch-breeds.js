#!/usr/bin/env node
'use strict';

/*
 * Стягивает породные карточки из ru.wikipedia (инфобокс с параметрами FCI)
 * и складывает сырой wikitext в agent/cache/wiki/.
 *
 * Запуск: node agent/fetch-breeds.js
 * Результат: agent/cache/wiki/<slug>.txt + agent/cache/wiki/index.json
 *
 * Данные используются как исходник для db/breeds-data.json:
 * физические параметры сверяются с номером стандарта FCI из инфобокса.
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const OUT_DIR = path.join(__dirname, 'cache', 'wiki');

const TITLES = [
  // собаки
  'Йоркширский терьер',
  'Чихуахуа',
  'Такса',
  'Ши-тцу',
  'Мопс',
  'Померанский шпиц',
  'Мальтийская болонка',
  'Золотистый ретривер',
  'Английский кокер-спаниель',
  'Бигль',
  'Сибирский хаски',
  'Ротвейлер',
  'Боксёр (порода собак)',
  'Бордер-колли',
  'Доберман',
  'Джек-рассел-терьер',
  // кошки
  'Бенгальская кошка',
  'Канадский сфинкс',
  'Шотландская вислоухая кошка',
  'Абиссинская кошка',
  'Сибирская кошка',
  'Русская голубая кошка',
  'Сиамская кошка',
  'Ориентальная кошка'
];

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
}

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'petdata-demo/1.0 (research prototype)', 'Accept-Language': 'ru' } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          return resolve(get(next, redirects + 1));
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchBatch(titles) {
  const url =
    'https://ru.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main' +
    '&format=json&formatversion=2&redirects=1&titles=' +
    encodeURIComponent(titles.join('|'));
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = await get(url);
    if (res.status === 429) {
      const wait = 5000 * attempt;
      console.log(`  429, ждём ${wait / 1000} c (попытка ${attempt})`);
      await sleep(wait);
      continue;
    }
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(res.body);
  }
  throw new Error('rate limited');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const indexPath = path.join(OUT_DIR, 'index.json');
  const loaded = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
  // Нормализация: по одному заголовку, побеждает последняя успешная запись.
  const byTitle = new Map();
  for (const item of loaded) {
    const previous = byTitle.get(item.requested);
    if (!previous || (previous.error && !item.error)) byTitle.set(item.requested, item);
  }
  const index = [...byTitle.values()];
  const done = new Set(index.filter((item) => !item.error).map((item) => item.requested));
  const pending = TITLES.filter((title) => !done.has(title));

  for (let i = 0; i < pending.length; i += 20) {
    const batch = pending.slice(i, i + 20);
    const json = await fetchBatch(batch);
    if (json.error) throw new Error(json.error.info);

    const pages = json.query.pages || [];
    const norm = new Map();
    for (const item of json.query.normalized || []) norm.set(item.from, item.to);
    const redirects = new Map();
    for (const item of json.query.redirects || []) redirects.set(item.from, item.to);

    for (const requested of batch) {
      const chain = norm.get(requested) || requested;
      const title = redirects.get(chain) || chain;
      const page = pages.find((item) => item.title === title);
      const slug = slugify(requested);
      // Один заголовок — одна запись в индексе: убираем прежнюю неудачную попытку.
      const existing = index.findIndex((item) => item.requested === requested);
      if (existing !== -1) index.splice(existing, 1);
      if (!page || page.missing || !page.revisions) {
        index.push({ requested, error: 'page not found', slug });
        console.log(`fail ${requested}: not found`);
        continue;
      }
      const wikitext = page.revisions[0].slots.main.content;
      fs.writeFileSync(path.join(OUT_DIR, slug + '.txt'), wikitext, 'utf8');
      index.push({
        requested,
        resolved: page.title,
        pageid: page.pageid,
        url: `https://ru.wikipedia.org/?curid=${page.pageid}`,
        slug,
        fetched_at: new Date().toISOString(),
        bytes: wikitext.length
      });
      console.log(`ok   ${requested} → ${page.title} (${wikitext.length} b)`);
    }

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
    if (i + 20 < pending.length) await sleep(2500);
  }

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  const okCount = index.filter((item) => !item.error).length;
  console.log(`\n${okCount}/${TITLES.length} страниц сохранено в ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
