'use strict';

(async () => {
  for (const url of ['https://www.petshop.ru/catalog/cats/food/', 'https://www.petshop.ru/catalog/dogs/food/']) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]))];
    const products = links.filter((link) => /\/product\/|\/goods\/|\/catalog\/.+\/.+\//i.test(link) && !/\.(css|js|png|jpg|webp|svg)/i.test(link));
    console.log(`\n${url} status=${res.status} links=${links.length} productish=${products.length}`);
    products.slice(0, 20).forEach((link) => console.log('  ' + link));
  }
})();
