'use strict';

(async () => {
  for (const url of ['https://4lapy.ru/catalog/sobaki/', 'https://4lapy.ru/catalog/koshki/']) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]))]
      .filter((link) => link.startsWith('/catalog/') && /korm|suh|vlazh|konserv/i.test(link));
    console.log(`\n${url} status=${res.status} links=${links.length}`);
    links.slice(0, 40).forEach((link) => console.log('  ' + link));
  }
})();
