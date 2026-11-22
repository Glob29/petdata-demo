'use strict';

const urls = [
  'https://royalcanin.ru/sitemap.xml',
  'https://purina.ru/sitemap.xml',
  'https://whiskas.ru/sitemap.xml',
  'https://grandorf.ru/sitemap.xml',
  'https://www.hillspet.ru/sitemap.xml',
  'https://miratorg.ru/sitemap.xml',
  'https://brit-petfood.com/sitemap.xml',
  'https://www.farmina.com/ru/sitemap.xml'
];

(async () => {
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; PetDataBot/0.1)' },
        signal: controller.signal
      });
      clearTimeout(timer);
      const text = await res.text();
      console.log(`\n${url}\n  status=${res.status} type=${res.headers.get('content-type')} len=${text.length}`);
      console.log('  ' + text.replace(/\s+/g, ' ').slice(0, 300));
    } catch (error) {
      console.log(`\n${url}\n  ERR ${error.message}`);
    }
  }
})();
