'use strict';

const urls = [
  ['RC', 'https://royalcanin.ru/shop/cats/suhie'],
  ['Hill\'s', 'https://www.hillspet.ru/products/cat-food']
];

(async () => {
  for (const [name, url] of urls) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; PetDataBot/0.1)' } });
    const html = await res.text();
    console.log(`\n${name} status=${res.status} len=${html.length}`);
    const quoted = [...new Set([...html.matchAll(/"([^"]{8,200})"/g)].map((m) => m[1]))];
    const paths = quoted.filter((s) => /^\/shop\/|^\/products\/|royalcanin\.ru\/shop|hillspet\.ru\/products/.test(s));
    console.log('paths=' + paths.length);
    paths.slice(0, 40).forEach((p) => console.log('  ' + p));
    const idx = html.indexOf('Indoor');
    if (idx >= 0) console.log('context:', html.slice(Math.max(0, idx - 200), idx + 400).replace(/\s+/g, ' '));
  }
})();
