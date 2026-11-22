'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { discover } = require('./lib/discover');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'brands.json'), 'utf8'));
(async () => {
  for (const brand of config.brands.filter((item) => item.brand.includes('Purina'))) {
    const urls = await discover(brand);
    console.log(brand.brand, urls.length);
    urls.slice(0, 10).forEach((url) => console.log('  ' + url));
  }
})();
