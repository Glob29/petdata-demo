'use strict';

/*
 * Адаптер карточки 4lapy (Next.js __NEXT_DATA__).
 * Достаёт номенклатуру даже если состава/нутриентов нет.
 */

const { stripHtml, extractNutrients } = require('./extract');

function toNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const number = Number.parseFloat(cleaned);
  return Number.isFinite(number) ? number : null;
}

function parseNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function attributeValues(product) {
  const attributes = [...(product.modelAttributes || []), ...(product.fullAttributes || [])];
  const values = [];
  for (const attribute of attributes) {
    for (const value of attribute.values || []) {
      if (value && value.value) values.push({ code: attribute.code, name: attribute.name, html: value.value });
    }
  }
  return values;
}

function parseWeight(name) {
  const match = String(name || '').match(/(\d+(?:[.,]\d+)?)\s*(кг|kg|гр|г|g)(?=\s|$|[),.;])/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  return /кг|kg/i.test(match[2]) ? Math.round(value * 1000) : Math.round(value);
}

function detectSpecies(url, name) {
  const source = `${url} ${name}`.toLowerCase();
  if (/cat|kosh|кош|кот/.test(source)) return 'cat';
  if (/dog|sob|собак|пёс|pes/.test(source)) return 'dog';
  return null;
}

function detectForm(url, name) {
  const source = `${url} ${name}`.toLowerCase();
  if (/влаж|wet|пауч|паштет|желе|соус|ragu|jelly/.test(source)) return 'wet';
  if (/сух|dry|крокет|croquette/.test(source)) return 'dry';
  return 'unknown';
}

function extract4lapy({ html, url }) {
  const data = parseNextData(html);
  if (!data) return null;

  const pp = data.props?.pageProps || {};
  const product = pp.initialState?.product?.product || {};
  const offer = pp.activeOffer || product.offers?.[0] || {};
  const name = offer.name || product.name || '';
  const brandName = product.brand?.name || '';
  const values = attributeValues(product);
  const text = values.map((item) => stripHtml(item.html)).join(' ');

  const compositionValue = values.find((item) => item.code === 'composition')?.html || '';
  const composition = stripHtml(compositionValue) || null;

  const nutrients = [];
  const tablePattern = /(\d+(?:[.,]\d+)?)\s*%\s*<\/td>\s*<td>\s*(Белки|Жиры|Зола|Клетчатка|Влага)/gi;
  const codeByLabel = { 'Белки': 'protein', 'Жиры': 'fat', 'Зола': 'ash', 'Клетчатка': 'fiber', 'Влага': 'moisture' };
  for (const match of compositionValue.matchAll(tablePattern)) {
    nutrients.push({ code: codeByLabel[match[2]], amount: toNumber(match[1]), unit: '%', value_type: 'declared' });
  }

  const energy = text.match(/(?:Обменная энергия|Энергетическая ценность)[^0-9]{0,30}([\d.,]+)\s*ккал\s*\/\s*кг/i);
  if (energy) nutrients.push({ code: 'me', amount: toNumber(energy[1]), unit: 'ккал/кг', value_type: 'declared' });

  if (!nutrients.length) {
    for (const row of extractNutrients(text)) nutrients.push(row);
  }

  const price = offer.price?.priceValue ?? product.price?.priceValue ?? null;

  return {
    name,
    brand_name: brandName,
    gtin: null,
    species: detectSpecies(url, name),
    form: detectForm(url, name),
    completeness: /полнорацион/i.test(text) ? 'complete' : 'unknown',
    weight_g: parseWeight(name),
    composition,
    nutrients,
    price: price == null ? null : toNumber(price),
    currency: offer.price?.currency || 'RUB',
    retailer: '4lapy',
    certificates: [],
    json_ld_name: null,
    text_length: text.length
  };
}

module.exports = { extract4lapy };
