'use strict';

const sites = [
  ['Kitekat', 'https://www.kitekat.ru/'],
  ['Pedigree', 'https://www.pedigree.ru/'],
  ['Sheba', 'https://sheba.ru/'],
  ['Perfect Fit', 'https://www.perfectfit.ru/'],
  ['Dreamies', 'https://www.dreamies.ru/']
];

(async () => {
  for (const [name, url] of sites) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => {
      try { return new URL(m[1], url).href; } catch { return null; }
    }).filter(Boolean))];
    const products = links.filter((link) => /product|korm|catalog|food|shop/i.test(link) && !/\.(css|js|png|jpg|webp|svg)/i.test(link));
    console.log(`\n${name} status=${res.status} links=${links.length} productish=${products.length}`);
    products.slice(0, 20).forEach((link) => console.log('  ' + link));
  }
})();
