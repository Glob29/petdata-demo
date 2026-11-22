'use strict';

const { extractProduct } = require('./lib/extract');

const pages = [
  ['Monge', 'https://monge.ru/product/vlazhnyij-korm-monge-cat-grill-dlya-vzroslyih-koshek-iz-novozelandskogo-yagnenka-pauchi-85-g'],
  ['Mnyams', 'https://mnyams.ru/product/vlazhnyij-dopolnitelnyij-korm-mnyams-na-kazhdyij-den-dlya-koshek-i-kotyat-starshe-6-mesyatsev-tunets-s-krevetkami-v-nezhnom-zhele-80-g']
];

(async () => {
  for (const [brand, url] of pages) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const draft = extractProduct({ html, url, brand });
    console.log(`\n${brand} status=${res.status} html=${html.length}`);
    console.log(JSON.stringify(draft, null, 2).slice(0, 1500));
    console.log('has Состав:', html.includes('Состав'), 'has ккал:', html.includes('ккал'));
  }
})();
