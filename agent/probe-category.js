'use strict';

const pages = [
  ['RC cats', 'https://royalcanin.ru/cat-products'],
  ['RC dogs', 'https://royalcanin.ru/dog-products'],
  ['Whiskas', 'https://whiskas.ru/products'],
  ['Hill\'s cats', 'https://www.hillspet.ru/science-plan/cat-food'],
  ['Grandorf', 'https://grandorf.ru/fresh/catalog/']
];

(async () => {
  for (const [name, url] of pages) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; PetDataBot/0.1)' } });
      const html = await res.text();
      const hrefs = [...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);
      const unique = [...new Set(hrefs)];
      const productish = unique.filter((h) => /product|korm|catalog|food|suh|vlag|item/i.test(h));
      console.log(`\n${name}: status=${res.status} html=${html.length} links=${unique.length} productish=${productish.length}`);
      productish.slice(0, 20).forEach((h) => console.log('  ' + h));
    } catch (error) {
      console.log(`${name}: ERR ${error.message}`);
    }
  }
})();
