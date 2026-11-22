'use strict';

const pages = [
  ['Purina Pro Plan cats', 'https://purina.ru/brands/proplan_cats'],
  ['Purina Felix', 'https://purina.ru/brands/felix_cats'],
  ['Monge cats', 'https://www.monge.ru/catalog/korma-dlya-koshek'],
  ['Mnyams cats', 'https://mnyams.ru/catalog/korma-dlya-koshek'],
  ['Nasha Marka dogs', 'https://mrkorm.ru/category/korm-dlya-sobak/']
];

(async () => {
  for (const [name, url] of pages) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => {
      try { return new URL(m[1], url).href; } catch { return null; }
    }).filter(Boolean))];
    const productish = links.filter((link) => /product|korm|tovar|catalog\/.+\/.+|\/shop\//i.test(link) && !/\.(css|js|png|jpg|webp|svg)/i.test(link));
    console.log(`\n${name} status=${res.status} links=${links.length} productish=${productish.length}`);
    productish.slice(0, 25).forEach((link) => console.log('  ' + link));
  }
})();
