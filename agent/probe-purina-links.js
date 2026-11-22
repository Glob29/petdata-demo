'use strict';

(async () => {
  const url = 'https://purina.ru/brands/proplan_cats';
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]))];
  console.log('status', res.status, 'links', links.length);
  const products = links.filter((link) => link.includes('/cats/korm-dlya-koshek/'));
  console.log('products', products.length);
  products.slice(0, 20).forEach((link) => console.log('  ' + link));
})();
