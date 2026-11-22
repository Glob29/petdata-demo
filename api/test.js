#!/usr/bin/env node
'use strict';

/*
 * Тесты API без внешних зависимостей.
 * Запуск: node api/test.js
 */

const assert = require('node:assert');
const { createServer, db } = require('./server');

const server = createServer();

function listen() {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function close() {
  return new Promise((resolve) => server.close(resolve));
}

async function main() {
  await listen();
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(path) {
    const res = await fetch(base + path);
    const body = await res.json();
    return { status: res.status, body };
  }

  const health = await request('/v1/health');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.body.data.status, 'ok');

  const coverage = await request('/v1/meta/coverage');
  assert.ok(coverage.body.data.products >= 7);
  assert.strictEqual(coverage.body.data.breeds, 30);
  assert.strictEqual(coverage.body.data.dog_breeds, 19);
  assert.strictEqual(coverage.body.data.cat_breeds, 11);
  assert.strictEqual(coverage.body.data.nutrients, 58);
  assert.ok(coverage.body.data.products_with_me >= 3);
  assert.ok(coverage.body.data.products_with_price >= 3);

  const cats = await request('/v1/products?species=cat');
  assert.ok(cats.body.meta.count >= 6);

  const product = await request('/v1/products/1');
  assert.strictEqual(product.body.data.brand, 'Grandorf');
  assert.strictEqual(product.body.data.completeness, 'complementary');
  assert.strictEqual(product.body.data.key_nutrients.protein.amount, 12.78);
  assert.strictEqual(product.body.data.ingredients[0].percent, 60);

  const dm = await request('/v1/products/1/nutrients?basis=dm');
  const proteinDm = dm.body.data.nutrients.find((item) => item.code === 'protein');
  assert.ok(Math.abs(proteinDm.amount - 88.2) < 0.1, `protein DM = ${proteinDm.amount}`);

  const missingDm = await request('/v1/products/3/nutrients?basis=dm');
  const missingProtein = missingDm.body.data.nutrients.find((item) => item.code === 'protein');
  assert.strictEqual(missingProtein.note, 'moisture_missing');

  const rc = await request('/v1/products/6');
  assert.strictEqual(rc.body.data.metrics.weight_g, 2000);
  // Метрики цены теперь считаются по средней цене упаковки (2911 и 3744 ₽ → 3327.5 ₽), а не по минимальной.
  assert.ok(Math.abs(rc.body.data.metrics.price_per_100g_protein.min - 616.22) < 1, `protein price = ${rc.body.data.metrics.price_per_100g_protein.min}`);
  assert.strictEqual(rc.body.data.quality.protein_quality_score, 2.5);
  assert.ok(Math.abs(rc.body.data.metrics.price_per_g.min - 1.6638) < 0.001);
  // Минимум по конкретным наблюдениям цен сохранился отдельным блоком (старая семантика).
  assert.ok(Math.abs(rc.body.data.metrics.observed_offers.price_per_100g_protein.min - 539.07) < 1);
  assert.strictEqual(rc.body.data.metrics.observed_offers.count, 2);

  // Один SKU может продаваться в нескольких фасовках: у каждой своя цена за грамм.
  const multiPack = await request('/v1/products/73');
  const packWeights = multiPack.body.data.packages.map((item) => item.weight_g);
  assert.deepStrictEqual(packWeights, [300, 1500, 3000, 10000, 15000]);
  assert.deepStrictEqual(multiPack.body.data.metrics.weight_g, 300);

  // Цена за грамм должна падать с ростом упаковки и быть посчитанной по каждой фасовке.
  const fourSizes = await request('/v1/products/151');
  const sizes = fourSizes.body.data.packages.map((item) => ({
    grams: item.total_weight_g,
    perGram: item.price_per_g
  }));
  assert.deepStrictEqual(sizes.map((item) => item.grams), [400, 1500, 4000, 15000]);
  for (let i = 1; i < sizes.length; i += 1) {
    assert.ok(sizes[i].perGram < sizes[i - 1].perGram, `₽/г должен падать: ${JSON.stringify(sizes)}`);
  }
  assert.strictEqual(sizes[3].perGram, 0.587);

  // Мультипак: 10×85 г считается как 850 г, иначе цена за грамм завышена в 10 раз.
  const multipack = await request('/v1/products/320');
  assert.strictEqual(multipack.body.data.packages[0].total_weight_g, 850);
  assert.strictEqual(multipack.body.data.packages[0].price_per_g, 1.1753);

  // Карточка, где блок цен пуст («недоступен в регионе»): вес и цена берутся из JSON-LD.
  const jsonLdOnly = await request('/v1/products/154');
  assert.strictEqual(jsonLdOnly.body.data.packages.length, 1);
  assert.strictEqual(jsonLdOnly.body.data.packages[0].weight_g, 400);
  assert.strictEqual(jsonLdOnly.body.data.packages[0].price_avg, 1099);
  assert.strictEqual(jsonLdOnly.body.data.packages[0].price_per_g, 2.7475);

  const chickenFree = await request('/v1/products?exclude_allergen=chicken');
  assert.ok(chickenFree.body.meta.count >= 1);
  assert.ok(chickenFree.body.data.every((item) => !item.allergens.groups.includes('poultry')));

  const turkey = await request('/v1/products?protein_source=turkey');
  assert.ok(turkey.body.meta.count >= 3);

  const chickenAllergen = await request('/v1/products/1');
  assert.ok(chickenAllergen.body.data.allergens.contains.includes('chicken'));

  const hydrolyzed = await request('/v1/products?hydrolyzed=true');
  assert.ok(hydrolyzed.body.meta.count >= 1);

  const allergens = await request('/v1/allergens');
  assert.strictEqual(allergens.body.data.groups.length, 11);
  assert.strictEqual(allergens.body.data.sources.length, 20);

  const dogs = await request('/v1/breeds?species=dog');
  assert.strictEqual(dogs.body.meta.count, 19);

  const labrador = await request('/v1/breeds/1');
  assert.strictEqual(labrador.body.data.name, 'Лабрадор-ретривер');
  assert.ok(labrador.body.data.predispositions.length >= 4);

  // Такса: ключевой пример провенанса — уровень A по IVDD и гентест CDPA.
  const dachshund = await request('/v1/breeds/9');
  assert.strictEqual(dachshund.body.data.name, 'Такса');
  assert.ok(dachshund.body.data.predispositions.some((item) => item.code === 'ivdd' && item.evidence_level === 'A'));
  assert.ok(dachshund.body.data.genetic_tests.some((item) => item.gene.includes('FGF4')));

  // У каждой породы заполнены вес, размер и хотя бы один вес по полу.
  for (const breed of [...dogs.body.data, ...(await request('/v1/breeds?species=cat')).body.data]) {
    const card = await request(`/v1/breeds/${breed.id}`);
    assert.ok(card.body.data.size_class, `size_class у ${breed.name}`);
    assert.ok(card.body.data.weights.length >= 1, `вес у ${breed.name}`);
    assert.ok(card.body.data.lifespan_years.min > 0, `продолжительность жизни у ${breed.name}`);
  }

  // Все уровни доказательности — из A–D.
  const allBreeds = await request('/v1/breeds?limit=100');
  for (const breed of allBreeds.body.data) {
    const card = await request(`/v1/breeds/${breed.id}/predispositions`);
    for (const item of card.body.data) {
      assert.ok(['A', 'B', 'C', 'D'].includes(item.evidence_level), `evidence_level ${item.evidence_level}`);
    }
  }

  const miniBreeds = await request('/v1/breeds?size=mini');
  assert.ok(miniBreeds.body.meta.count >= 4);

  const nutrients = await request('/v1/nutrients');
  assert.strictEqual(nutrients.body.meta.count, 58);

  const search = await request('/v1/search?q=куриная');
  assert.ok(search.body.data.products.length >= 1);

  const notFound = await request('/v1/products/999');
  assert.strictEqual(notFound.status, 404);

  console.log('OK: проверки API пройдены (продукты, нутриенты, аллергены, 30 пород, риски, гентесты)');
}

main()
  .catch((error) => {
    console.error('FAIL:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await close();
    db.close();
  });
