'use strict';

(async () => {
  const url = 'https://www.petshop.ru/catalog/cats/food/dlya-koshek-syxoi-korm/';
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]))];
  const products = links.filter((link) => /\/product\/|\/goods\//i.test(link));
  console.log('status', res.status, 'html', html.length, 'links', links.length, 'products', products.length);
  products.slice(0, 20).forEach((link) => console.log('  ' + link));
})();
