'use strict';

const pages = [
  ['Whiskas', 'https://whiskas.ru/products/adult/vlazhnyi-korm-whiskas-dlya-koshek-ragu-s-kuricei-75g'],
  ['Grandorf', 'https://grandorf.ru/fresh/catalog/cat_foods/sterilised_cats/gdf_cat_sterilised_turkey_sweet_potato_400_g/']
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

function contexts(text, term, radius = 180) {
  const lower = text.toLowerCase();
  const t = term.toLowerCase();
  const out = [];
  let idx = lower.indexOf(t);
  while (idx >= 0 && out.length < 4) {
    out.push(text.slice(Math.max(0, idx - radius), idx + radius));
    idx = lower.indexOf(t, idx + t.length);
  }
  return out;
}

(async () => {
  for (const [name, url] of pages) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; PetDataBot/0.1)' } });
    const text = textOf(await res.text());
    console.log(`\n=== ${name}`);
    for (const term of ['бел', 'жир', 'ккал', 'энерг']) {
      console.log(`-- ${term} --`);
      contexts(text, term).forEach((c) => console.log('  ...' + c + '...'));
    }
  }
})();
