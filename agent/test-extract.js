'use strict';

const { extractProduct } = require('./lib/extract');

const pages = [
  ['Whiskas', 'https://whiskas.ru/products/adult/vlazhnyi-korm-whiskas-dlya-koshek-ragu-s-kuricei-75g'],
  ['Grandorf', 'https://grandorf.ru/fresh/catalog/cat_foods/sterilised_cats/gdf_cat_sterilised_turkey_sweet_potato_400_g/'],
  ['Hill\'s', 'https://www.hillspet.ru/cat-food/sp-feline-science-plan-adult-optimal-care-chicken-dry']
];

(async () => {
  for (const [brand, url] of pages) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; PetDataBot/0.1)' } });
    const html = await res.text();
    const draft = extractProduct({ html, url, brand });
    console.log(`\n=== ${brand} status=${res.status}`);
    console.log(JSON.stringify(draft, null, 2));
  }
})();
