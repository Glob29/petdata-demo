'use strict';

(async () => {
  for (const url of ['https://royalcanin.ru/sitemap.xml', 'https://www.hillspet.ru/sitemap.xml']) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    console.log(`\n${url} total=${locs.length}`);
    const shop = locs.filter((u) => /\/shop\/|\/cat-food\/|\/dog-food\//.test(u));
    console.log('shop/food=' + shop.length);
    shop.slice(0, 40).forEach((u) => console.log('  ' + u));
  }
})();
