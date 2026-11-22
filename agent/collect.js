#!/usr/bin/env node
'use strict';

/*
 * Агент сбора данных о кормах.
 * Запуск: node agent/collect.js
 * Конфиг: agent/brands.json
 * База: db/petdata.db
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { fetchText } = require('./lib/http');
const { discover } = require('./lib/discover');
const { extractProduct, extractDocumentLinks } = require('./lib/extract');
const { extract4lapy } = require('./lib/extract-4lapy');
const load = require('./lib/load');

const root = path.join(__dirname, '..');
const dbPath = process.env.PETDATA_DB || path.join(root, 'db', 'petdata.db');
const configPath = path.join(__dirname, 'brands.json');
const reportPath = path.join(__dirname, 'report.json');

if (!fs.existsSync(dbPath)) {
  throw new Error(`База не найдена: ${dbPath}. Сначала выполните: node db/import.js`);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('DELETE FROM extraction_run;');

const nutrients = load.nutrientMap(db);
const report = {
  started_at: new Date().toISOString(),
  market: config.market,
  brands: [],
  totals: { discovered: 0, fetched: 0, loaded: 0, skipped: 0, failed: 0, nutrients: 0, certificates: 0 }
};

function validDraft(draft) {
  return Boolean(draft && draft.name && draft.species);
}

async function processBrand(brandConfig) {
  const brandReport = {
    brand: brandConfig.brand,
    discovered: 0,
    fetched: 0,
    loaded: 0,
    skipped: 0,
    failed: 0,
    products: []
  };

  const sourceId = load.ensureSource(db, brandConfig);
  const manufacturerId = load.ensureManufacturer(db, brandConfig.manufacturer);
  const brandId = load.ensureBrand(db, brandConfig.brand, manufacturerId);

  const urls = await discover(brandConfig);
  brandReport.discovered = urls.length;
  report.totals.discovered += urls.length;

  for (const url of urls) {
    try {
      const response = await fetchText(url);
      brandReport.fetched += 1;
      report.totals.fetched += 1;

      const draft = brandConfig.parser === '4lapy'
        ? extract4lapy({ html: response.html, url })
        : extractProduct({ html: response.html, url, brand: brandConfig.brand });

      if (!validDraft(draft)) {
        brandReport.failed += 1;
        report.totals.failed += 1;
        load.logRun(db, sourceId, url, 'failed', 0.2, response.cachePath, 'not enough identity data');
        brandReport.products.push({ url, status: 'failed', name: draft?.name });
        continue;
      }

      const actualBrandName = draft.brand_name || brandConfig.brand;
      let actualBrandId = brandId;
      if (actualBrandName !== brandConfig.brand) {
        const retailManufacturer = load.ensureManufacturer(db, 'Не указан');
        actualBrandId = load.ensureBrand(db, actualBrandName, retailManufacturer);
      }

      const product = load.insertProduct(db, actualBrandId, draft, sourceId, url);
      if (!product) throw new Error('product insert failed');

      load.insertSourcePage(db, product.id, sourceId, url);
      const packageId = load.insertPackage(db, product.id, draft, sourceId);
      load.insertPriceSnapshot(db, product.id, packageId, draft, sourceId, url);

      if (!product.created) {
        brandReport.skipped += 1;
        report.totals.skipped += 1;
        load.logRun(db, sourceId, url, 'validated', 0.7, response.cachePath, 'already exists');
        brandReport.products.push({ url, status: 'skipped', name: draft.name, id: product.id });
        continue;
      }

      load.insertNutrients(db, product.id, draft, sourceId, nutrients);
      load.insertIngredients(db, product.id, draft);
      load.insertProteinSources(db, product.id, draft, sourceId);
      load.insertSearchIndex(db, product.id, draft, actualBrandName);
      const certCount = load.insertCertificates(db, product.id, actualBrandId, draft, sourceId);
      load.logRun(db, sourceId, url, 'validated', 0.7, response.cachePath);

      brandReport.loaded += 1;
      report.totals.loaded += 1;
      report.totals.nutrients += draft.nutrients.length;
      report.totals.certificates += certCount;
      brandReport.products.push({
        url,
        status: 'loaded',
        id: product.id,
        name: draft.name,
        species: draft.species,
        weight_g: draft.weight_g,
        nutrients: draft.nutrients.length,
        certificates: certCount
      });
    } catch (error) {
      brandReport.failed += 1;
      report.totals.failed += 1;
      load.logRun(db, sourceId, url, 'failed', 0, null, error.message);
      brandReport.products.push({ url, status: 'error', error: error.message });
    }
  }

  brandReport.certificates = 0;
  for (const page of brandConfig.certificate_pages || []) {
    try {
      const response = await fetchText(page);
      const docs = extractDocumentLinks(response.html, page);
      for (const doc of docs) {
        const type = /декларац|declaration/i.test(`${doc.url} ${doc.text}`)
          ? 'declaration'
          : /ветеринар/i.test(`${doc.url} ${doc.text}`)
            ? 'vet_certificate'
            : 'quality';
        load.insertBrandCertificate(db, brandId, sourceId, {
          type,
          url: doc.url,
          notes: doc.text
        });
        brandReport.certificates += 1;
      }
    } catch (error) {
      brandReport.products.push({ url: page, status: 'certificate_page_error', error: error.message });
    }
  }

  if (brandReport.certificates === 0) {
    load.insertBrandCertificate(db, brandId, sourceId, {
      status: 'not_found',
      notes: 'Открытые сертификаты/декларации на сайте не найдены'
    });
  }

  report.totals.certificates += brandReport.certificates;
  return brandReport;
}

(async () => {
  for (const brandConfig of config.brands) {
    console.log(`\n▶ ${brandConfig.brand}`);
    try {
      const result = await processBrand(brandConfig);
      report.brands.push(result);
      console.log(`  discovered=${result.discovered} fetched=${result.fetched} loaded=${result.loaded} skipped=${result.skipped} failed=${result.failed}`);
    } catch (error) {
      console.error(`  ERR ${error.message}`);
      report.brands.push({ brand: brandConfig.brand, error: error.message });
    }
  }

  report.finished_at = new Date().toISOString();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n=== ИТОГО ===');
  console.log(JSON.stringify(report.totals, null, 2));
  console.log(`Отчёт: ${reportPath}`);

  db.close();
})();
