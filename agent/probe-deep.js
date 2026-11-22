'use strict';

const pages = [
  ['RC dry cats', 'https://royalcanin.ru/shop/cats/suhie'],
  ['Whiskas adult', 'https://whiskas.ru/products/adult'],
  ['Grandorf cats', 'https://grandorf.ru/fresh/catalog/cat_foods/'],
  ['Hill\'s cat food', 'https://www.hillspet.ru/science-plan/cat-food']
];

(async () => {
  for (const [name, url] of pages) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; PetDataBot/0.1)' } });
      const html = await res.text();
      const hrefs = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]))];
      const prod = hrefs.filter((h) => /\/shop\/|\/products\/|\/fresh\/catalog\/.+\/.+|product|korm/i.test(h));
      console.log(`\n${name}: status=${res.status} html=${html.length} links=${hrefs.length} prod=${prod.length}`);
      prod.slice(0, 30).forEach((h) => console.log('  ' + h));
    } catch (error) {
      console.log(`${name}: ERR ${error.message}`);
    }
  }
})();
