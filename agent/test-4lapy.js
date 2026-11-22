'use strict';

const { extract4lapy } = require('./lib/extract-4lapy');

(async () => {
  const url = 'https://4lapy.ru/product/royal-canin-sterilised-37-regular-suhoj-korm-dlya-sterilizovannyh-koshek-s-1-do-7-let-2-kg-1012-1000715/';
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const draft = extract4lapy({ html, url });
  console.log(JSON.stringify(draft, null, 2));
})();
