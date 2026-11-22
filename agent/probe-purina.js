'use strict';

(async () => {
  for (const url of ['https://purina.ru/brands', 'https://purina.ru/brands/proplan_cats']) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)]
      .map((m) => m[1])
      .filter((href) => href.includes('/brands/')))];
    console.log(`\n${url} status=${res.status} links=${links.length}`);
    links.slice(0, 30).forEach((href) => console.log('  ' + href));
  }
})();
