'use strict';

const pages = [
  ['Whiskas', 'https://whiskas.ru/products/adult/vlazhnyi-korm-whiskas-dlya-koshek-ragu-s-kuricei-75g'],
  ['Grandorf', 'https://grandorf.ru/fresh/catalog/cat_foods/sterilised_cats/gdf_cat_sterilised_turkey_sweet_potato_400_g/'],
  ['Hill\'s', 'https://www.hillspet.ru/cat-food/sp-feline-science-plan-adult-chicken-dry']
];

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function match(text, re) {
  const m = text.match(re);
  return m ? m[1] : null;
}

(async () => {
  for (const [name, url] of pages) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; PetDataBot/0.1)' } });
      const html = await res.text();
      const text = textOf(html);
      console.log(`\n=== ${name} status=${res.status} html=${html.length} text=${text.length}`);
      console.log('jsonld blocks:', (html.match(/application\/ld\+json/g) || []).length);
      console.log('Состав:', match(text, /Состав[:\s]+([^]{0,300})/i));
      console.log('Белки:', match(text, /Белк[а-я]*[^0-9]{0,30}([0-9]+[.,]?[0-9]*)\s*%/i));
      console.log('Жиры:', match(text, /Жир[а-я]*[^0-9]{0,30}([0-9]+[.,]?[0-9]*)\s*%/i));
      console.log('Ккал:', match(text, /(?:ккал|kcal)[^0-9]{0,20}([0-9][0-9\s.,]*)/i));
      console.log('text sample:', text.slice(0, 500));
    } catch (error) {
      console.log(`\n=== ${name} ERR ${error.message}`);
    }
  }
})();
