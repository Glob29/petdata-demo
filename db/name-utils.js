'use strict';

/** Убирает вес/упаковку из названия, чтобы 400 г и 2 кг были одним продуктом. */
function cleanProductName(name) {
  return String(name || '')
    .replace(/[®™]/g, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:кг|kg|г|g)(?=\s|$|[),.;])/gi, ' ')
    .replace(/\b\d+\s*(?:шт|штук)\b/gi, ' ')
    .replace(/\b(?:упаковка|уп\.)\b/gi, ' ')
    .replace(/\s*[—|]\s*(?:купить|официальный сайт).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:]+$/g, '');
}

/** Ключ для дедупликации: бренд + вид + форма + рынок + очищенное имя. */
function nameKey(name) {
  return cleanProductName(name)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { cleanProductName, nameKey };
