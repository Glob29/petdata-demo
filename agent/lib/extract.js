'use strict';

/*
 * Извлечение карточки корма из HTML.
 * Детерминированные правила + JSON-LD; без внешних зависимостей.
 */

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
}

function stripHtml(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  const products = [];
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1]);
      const list = Array.isArray(data) ? data : [data];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        if (item['@type'] === 'Product' || item['@type'] === 'ProductGroup') products.push(item);
        if (Array.isArray(item['@graph'])) {
          for (const graphItem of item['@graph']) {
            if (graphItem && graphItem['@type'] === 'Product') products.push(graphItem);
          }
        }
      }
    } catch {
      // ignore broken JSON-LD
    }
  }
  return products;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function firstNumericMatch(text, patterns) {
  for (const pattern of patterns) {
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const match of text.matchAll(global)) {
      const amount = toNumber(match[1]);
      if (amount != null) return { match, amount };
    }
  }
  return null;
}

function toNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const number = Number.parseFloat(cleaned);
  return Number.isFinite(number) ? number : null;
}

function extractComposition(text) {
  const matches = [...text.matchAll(/Состав\s*[:\-]?/gi)];
  let best = null;
  let bestScore = -1;

  for (const match of matches) {
    let chunk = text.slice(match.index + match[0].length, match.index + match[0].length + 1600);
    chunk = chunk.split(/Анализ|Аналитич|Питательн|Добавк|Норм[аы] кормления|Рекоменд|Инструкц|Содержание питательных/i)[0];
    chunk = chunk.trim();
    if (chunk.length < 20) continue;
    if (/Сырой протеин|Аналитическ|Питательные вещества/i.test(chunk)) continue;

    const ingredientWords = (chunk.match(/мясо|мука|курица|индейка|рыба|рис|пшеница|кукуруза|горох|батат|субпродукт|жир|яйцо|дрожж|минерал|таурин/gi) || []).length;
    if (ingredientWords < 2) continue;

    const percentCount = (chunk.match(/%/g) || []).length;
    const score = ingredientWords * 3 + percentCount * 2 + Math.min(chunk.length, 500) / 100;
    if (score > bestScore) {
      best = chunk;
      bestScore = score;
    }
  }

  return best;
}

function extractNutrients(text) {
  const rows = [];
  const patterns = [
    ['protein', [/(?:Сырой протеин|Протеин|Белки|Белок)\s*[:\-]?\s*([\d.,]+)\s*(%|г|g)/i]],
    ['fat', [/(?:Сырой жир|Жиры|Жир)\s*[:\-]?\s*([\d.,]+)\s*(%|г|g)/i]],
    ['fiber', [/(?:Сырая клетчатка|Клетчатка)\s*[:\-]?\s*([\d.,]+)\s*(%|г|g)/i]],
    ['ash', [/(?:Сырая зола|Зола)\s*[:\-]?\s*([\d.,]+)\s*(%|г|g)/i]],
    ['moisture', [/(?:Влага|Влажность)\s*[:\-]?\s*([\d.,]+)\s*(%|г|g)/i]]
  ];

  for (const [code, regexes] of patterns) {
    const found = firstNumericMatch(text, regexes);
    if (!found) continue;
    rows.push({
      code,
      amount: found.amount,
      unit: '%',
      value_type: /не менее/i.test(found.match[0]) ? 'min' : /не более/i.test(found.match[0]) ? 'max' : 'declared',
      raw: found.match[0]
    });
  }

  const perKg = text.match(/(\d{3,5})\s*(?:ккал|kcal)\s*\/\s*(?:кг|kg)/i);
  if (perKg) {
    rows.push({ code: 'me', amount: toNumber(perKg[1]), unit: 'ккал/кг', value_type: 'declared', raw: perKg[0] });
  } else {
    const per100 = firstMatch(text, [
      /(?:Метаболическая энергия|Энергетическая ценность|Калорийность)[^0-9]{0,40}([\d.,]{2,6})\s*(ккал|kcal)/i
    ]);
    if (per100) {
      const kcal = toNumber(per100[1]);
      if (kcal) rows.push({ code: 'me', amount: kcal * 10, unit: 'ккал/кг', value_type: 'declared', raw: per100[0] });
    }
  }

  return rows;
}

function extractWeight(name, url) {
  const source = `${name} ${url.replace(/_/g, ' ')}`;
  const kg = source.match(/(\d+[.,]?\d*)\s*(кг|kg)(?=\s|$|[),.;])/i);
  if (kg) return Math.round(toNumber(kg[1]) * 1000);
  const g = source.match(/(\d+[.,]?\d*)\s*(г|g)(?=\s|$|[),.;])/i);
  if (g) return Math.round(toNumber(g[1]));
  return null;
}

function extractWeightFromText(text) {
  const match = text.match(/(?:вес|масса|упаковка|фасовка)[^0-9]{0,30}(\d+[.,]?\d*)\s*(кг|kg|г|g)\b/i);
  if (!match) return null;
  const value = toNumber(match[1]);
  if (value == null) return null;
  return /кг|kg/i.test(match[2]) ? Math.round(value * 1000) : Math.round(value);
}

/*
 * Все доступные фасовки со страницы: «ДОСТУПНЫЕ ВЕСОВКИ 400g, 1.5kg, 3kg».
 * Одна карточка может продаваться в нескольких весовках — берём список целиком,
 * иначе в базе остаётся только первая (обычно самая мелкая) и выглядит как ошибка разрядности.
 *
 * Важно: вес бывает с точкой («1.5kg»), поэтому окно после маркера режем не по точке,
 * а по служебным подписям («Найти магазин» и т.п.).
 * Возвращает граммы по возрастанию; пустой массив, если блока нет.
 */
function extractAvailableWeights(html) {
  const text = stripHtml(html);
  const marker = text.match(/(?:ДОСТУПНЫ\w*\s+ВЕСОВК\w*|Доступные\s+весовки)/i);
  if (!marker || marker.index === undefined) return [];

  const tail = text
    .slice(marker.index + marker[0].length, marker.index + marker[0].length + 160)
    .split(/Найти|Рекомендовано|ВОЗРАСТ|РАЗМЕР|ПОРОДА/i)[0];

  const grams = new Set();
  for (const match of tail.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g|кг|гр|г)(?![а-яёa-z])/gi)) {
    const value = toNumber(match[1]);
    if (!value) continue;
    grams.add(/kg|кг/i.test(match[2]) ? Math.round(value * 1000) : Math.round(value));
  }
  return [...grams].sort((a, b) => a - b);
}

function detectSpecies(url, name) {
  const source = `${url} ${name}`.toLowerCase();
  if (/cat|kosh|kot|feline|кош|кот/.test(source)) return 'cat';
  if (/dog|sob|sabak|canine|собак|пёс|pes/.test(source)) return 'dog';
  return null;
}

function detectForm(url, name, text) {
  const source = `${url} ${name} ${text.slice(0, 500)}`.toLowerCase();
  if (/wet|влажн|желе|соус|паштет|ragu|jelly|75g|70g|85g|80g/.test(source)) return 'wet';
  if (/dry|сух|krokant|croquette/.test(source)) return 'dry';
  return 'unknown';
}

function detectCompleteness(text) {
  if (/полнорацион/i.test(text)) return 'complete';
  if (/дополнительн\w*\s+корм|неполнорацион/i.test(text)) return 'complementary';
  return 'unknown';
}

function normalizeName(name) {
  let value = name.trim().replace(/\s+/g, ' ');
  const duplicate = value.match(/^(.{10,}?)\s*\1$/);
  if (duplicate) value = duplicate[1].trim();
  return value;
}

function extractCertificates(html, baseUrl) {
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)]
    .map((match) => ({
      url: new URL(match[1], baseUrl).href,
      text: stripHtml(match[2])
    }))
    .filter((item) => /сертификат|декларац|соответств|свидетельств/i.test(`${item.url} ${item.text}`));

  const unique = new Map();
  for (const link of links) {
    const key = `${link.url}|${link.text}`;
    if (!unique.has(key)) unique.set(key, link);
  }
  return [...unique.values()].slice(0, 20);
}

function extractDocumentLinks(html, baseUrl) {
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,250}?)<\/a>/gi)]
    .map((match) => ({
      url: new URL(match[1], baseUrl).href,
      text: stripHtml(match[2])
    }))
    .filter((item) => /\.pdf($|\?)|сертификат|декларац|соответств|свидетельств|протокол/i.test(`${item.url} ${item.text}`));

  const unique = new Map();
  for (const link of links) {
    const key = `${link.url}|${link.text}`;
    if (!unique.has(key)) unique.set(key, link);
  }
  return [...unique.values()].slice(0, 30);
}

function extractProduct({ html, url, brand }) {
  const text = stripHtml(html);
  const jsonLd = parseJsonLd(html);
  const ld = jsonLd[0] || {};

  let name = ld.name || '';
  if (!name) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) name = stripHtml(h1[1]);
  }
  if (!name) {
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    name = title ? stripHtml(title[1]).split('|')[0].trim() : '';
  }
  name = normalizeName(name.replace(/\s*[—|]\s*(купить|официальный|сайт).*$/i, '').trim());

  const composition = extractComposition(text);
  const nutrients = extractNutrients(text);

  // Явный вес в названии/URL — это конкретная фасовка; блок «доступные весовки» — весь ряд.
  const explicitWeight = extractWeight(name, url);
  const availableWeights = explicitWeight ? [] : extractAvailableWeights(html);
  const textWeight = extractWeightFromText(text);
  const weights = availableWeights.length ? availableWeights : [explicitWeight || textWeight].filter(Boolean);
  const weight = explicitWeight || weights[0] || null;

  const species = detectSpecies(url, name);
  const form = detectForm(url, name, text);
  const completeness = detectCompleteness(text);

  return {
    name,
    gtin: ld.gtin13 || ld.gtin || null,
    species,
    form,
    completeness,
    weight_g: weight,
    weights_g: weights,
    composition,
    nutrients,
    certificates: extractCertificates(html, url),
    json_ld_name: ld.name || null,
    text_length: text.length
  };
}

module.exports = {
  decodeEntities,
  stripHtml,
  parseJsonLd,
  extractProduct,
  extractComposition,
  extractNutrients,
  extractCertificates,
  extractDocumentLinks,
  extractAvailableWeights
};
