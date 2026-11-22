'use strict';

const sites = [
  ['Kitekat', 'https://www.kitekat.ru/'],
  ['Pedigree', 'https://www.pedigree.ru/'],
  ['Chappi', 'https://www.chappi.ru/'],
  ['Sheba', 'https://www.sheba.ru/'],
  ['Gourmet', 'https://www.gourmet.ru/'],
  ['Perfect Fit', 'https://www.perfectfit.ru/'],
  ['Dreamies', 'https://www.dreamies.ru/']
];

(async () => {
  for (const [name, url] of sites) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      const html = await res.text();
      console.log(`${name}: status=${res.status} final=${res.url} html=${html.length}`);
    } catch (error) {
      console.log(`${name}: ERR ${error.message}`);
    }
  }
})();
