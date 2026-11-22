'use strict';

(async () => {
  for (const url of ['https://4lapy.ru/catalog/koshki/korm-koshki/', 'https://4lapy.ru/catalog/sobaki/korm-sobak/']) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]))]
      .filter((link) => link.startsWith('/catalog/') && /korm|suh|vlazh/i.test(link));
    console.log(`\n${url} status=${res.status} len=${html.length} links=${links.length}`);
    links.slice(0, 30).forEach((link) => console.log('  ' + link));
  }
})();
