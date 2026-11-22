'use strict';

const sites = [
  ['Purina', 'https://purina.ru/'],
  ['Monge', 'https://www.monge.ru/'],
  ['Nasha Marka', 'https://mrkorm.ru/'],
  ['Mnyams', 'https://mnyams.ru/'],
  ['Miratorg', 'https://miratorg.ru/'],
  ['Brit', 'https://brit-petfood.com/ru/']
];

(async () => {
  for (const [name, url] of sites) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; PetDataBot/0.1)' } });
      const html = await res.text();
      const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => {
        try { return new URL(m[1], url).href; } catch { return null; }
      }).filter(Boolean))];
      const relevant = links.filter((link) => /brand|product|catalog|korm|food|shop/i.test(link));
      console.log(`\n${name} status=${res.status} html=${html.length} links=${links.length} relevant=${relevant.length}`);
      relevant.slice(0, 25).forEach((link) => console.log('  ' + link));
    } catch (error) {
      console.log(`\n${name} ERR ${error.message}`);
    }
  }
})();
