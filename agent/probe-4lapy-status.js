'use strict';

const urls = [
  'https://4lapy.ru/catalog/koshki/korm-koshki/sukhoy/',
  'https://4lapy.ru/catalog/koshki/korm-koshki/vlazhnyy/',
  'https://4lapy.ru/catalog/sobaki/korm-sobak/sukhoy/',
  'https://4lapy.ru/catalog/sobaki/korm-sobak/vlazhnyy/'
];
(async () => {
  for (const url of urls) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, redirect: 'follow' });
    console.log(res.status, res.url);
  }
})();
