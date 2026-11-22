'use strict';

const pages = [
  ['Kitekat wet', 'https://www.kitekat.ru/korma/vlazhnye'],
  ['Kitekat dry', 'https://www.kitekat.ru/korma/suhie'],
  ['Pedigree dry', 'https://www.pedigree.ru/korm-dlya-sobak/suxoj']
];

(async () => {
  for (const [name, url] of pages) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]))];
    const products = links.filter((link) => /korma\/[^/]+|product|korm-dlya-sobak\/[^/]+/i.test(link) && !/\.(css|js|png|jpg|webp|svg)/i.test(link));
    console.log(`\n${name} status=${res.status} html=${html.length} links=${links.length} products=${products.length}`);
    products.slice(0, 20).forEach((link) => console.log('  ' + link));
  }
})();
