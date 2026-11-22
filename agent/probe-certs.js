'use strict';

const pages = [
  ['Whiskas', 'https://whiskas.ru/'],
  ['Grandorf', 'https://grandorf.ru/'],
  ['Hill\'s', 'https://www.hillspet.ru/']
];

(async () => {
  for (const [name, url] of pages) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,150}?)<\/a>/gi)]
      .map((m) => ({ url: m[1], text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }))
      .filter((l) => /сертификат|декларац|соответств|документ|качеств/i.test(`${l.url} ${l.text}`));
    console.log(`\n${name} status=${res.status} matches=${links.length}`);
    for (const link of links.slice(0, 15)) console.log(`  ${link.url} | ${link.text}`);
  }
})();
