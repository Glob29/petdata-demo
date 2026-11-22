'use strict';

/*
 * Разбор блока «Вес упаковки» на карточке 4lapy.
 *
 * Каждая фасовка — отдельная ссылка с подписью («400 г», «1,5 кг») и ценой за килограмм
 * («1 373 ₽/кг»). Это самый надёжный сигнал: ритейлер сам показывает ₽/кг по каждой упаковке.
 *
 * Пример:
 *   <a href="/product/...-4-kg-1190-1050751/">
 *     <span data-testid="offer-value">4 кг</span>
 *     <div data-testid="regular-offer-price">750 ₽/кг</div>
 *   </a>
 */

// В JS \b не срабатывает перед кириллицей («400 г»), поэтому режем явным lookahead.
const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*(кг|kg|гр|г|g)(?![а-яёa-z])/i;

function parseGrams(label) {
  const text = String(label || '').replace(/\u00a0/g, ' ');
  // Мультипак вида «10х85 г» — 10 упаковок по 85 г.
  const multipack = text.match(/(\d+)\s*[xх×]\s*(\d+(?:[.,]\d+)?)\s*(кг|kg|гр|г|g)(?![а-яёa-z])/i);
  if (multipack) {
    const count = Number(multipack[1]);
    const value = Number(multipack[2].replace(',', '.'));
    const unit = multipack[3];
    const gramsEach = /кг|kg/i.test(unit) ? value * 1000 : value;
    return Math.round(count * gramsEach);
  }
  const match = text.match(SIZE_RE);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  if (!value) return null;
  return Math.round(/кг|kg/i.test(match[2]) ? value * 1000 : value);
}

function parsePricePerKg(text) {
  const clean = String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  const match = clean.match(/([\d\s]+(?:[.,]\d+)?)\s*₽\s*\/\s*кг/i);
  if (!match) return null;
  const value = Number(match[1].replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function extractOfferVariants(html, baseUrl) {
  const variants = [];
  const anchorRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,800}?)<\/a>/g;

  for (const match of html.matchAll(anchorRe)) {
    const href = match[1];
    const inner = match[2];
    if (!inner.includes('offer-value')) continue;

    const labelMatch = inner.match(/offer-value"[^>]*>([^<]+)</);
    if (!labelMatch) continue;
    const label = labelMatch[1].trim();
    const grams = parseGrams(label);
    if (!grams) continue;

    const priceMatch = inner.match(/regular-offer-price"[^>]*>([^<]+)</);
    const pricePerKg = priceMatch ? parsePricePerKg(priceMatch[1]) : null;

    let url = null;
    try {
      url = new URL(href, baseUrl).href;
    } catch {
      url = null;
    }

    if (variants.some((item) => item.grams === grams && item.price_per_kg === pricePerKg)) continue;
    variants.push({ label, grams, price_per_kg: pricePerKg, url });
  }

  return variants;
}

module.exports = { parseGrams, parsePricePerKg, extractOfferVariants };
