'use strict';

const { stripHtml } = require('./lib/extract');

(async () => {
  const url = 'https://www.hillspet.ru/about-us/quality-and-safety';
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const text = stripHtml(html);
  console.log(text.slice(0, 2500));
  console.log('\nLINKS');
  const links = [...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]).filter((x) => /pdf|declar|sertif|cert|doc/i.test(x));
  console.log([...new Set(links)].slice(0, 30));
})();
