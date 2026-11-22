'use strict';

(async () => {
  for (const url of ['https://4lapy.ru/brand/hills/', 'https://4lapy.ru/brand/royalcanin/', 'https://4lapy.ru/catalog/koshki/korm-koshki/sukhoy/']) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      const html = await res.text();
      const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]))];
      const products = links.filter((link) => link.includes('/product/'));
      console.log(`\n${url} status=${res.status} links=${links.length} products=${products.length}`);
      products.slice(0, 10).forEach((link) => console.log('  ' + link));
    } catch (error) {
      console.log(`\n${url} ERR ${error.message}`);
    }
  }
})();
