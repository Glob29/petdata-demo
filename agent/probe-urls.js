'use strict';

const sites = [
  ['Royal Canin', 'https://royalcanin.ru/sitemap.xml'],
  ['Purina', 'https://purina.ru/sitemap.xml'],
  ['Whiskas', 'https://whiskas.ru/sitemap.xml'],
  ['Hill\'s', 'https://www.hillspet.ru/sitemap.xml'],
  ['Grandorf', 'https://grandorf.ru/sitemap.xml']
];

function locs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
}

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; PetDataBot/0.1)' } });
  return { status: res.status, text: await res.text() };
}

(async () => {
  for (const [name, sitemap] of sites) {
    try {
      const first = await get(sitemap);
      let urls = locs(first.text);
      const children = urls.filter((u) => u.endsWith('.xml'));
      if (children.length && urls.length < 10) {
        urls = [];
        for (const child of children.slice(0, 20)) {
          const sub = await get(child);
          urls.push(...locs(sub.text));
        }
      }
      const products = urls.filter((u) => /product|korm|food|catalog|suh|vlag|kosh|sob|cat|dog/i.test(u));
      console.log(`\n${name}: total=${urls.length} products~${products.length}`);
      products.slice(0, 12).forEach((u) => console.log('  ' + u));
    } catch (error) {
      console.log(`${name}: ERR ${error.message}`);
    }
  }
})();
