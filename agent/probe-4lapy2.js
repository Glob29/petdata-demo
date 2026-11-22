'use strict';

(async () => {
  const url = 'https://4lapy.ru/product/sterilised-korm-dlya-sterilizovannyh-koshek-s-indejkoj-1-9-kg-86249-1018213/';
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const data = JSON.parse(html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const pp = data.props.pageProps;
  console.log('productParams keys:', Object.keys(pp.productParams || {}));
  console.log('activeOffer keys:', Object.keys(pp.activeOffer || {}));
  console.log('initialState keys:', Object.keys(pp.initialState || {}));
  const json = JSON.stringify(pp);
  for (const term of ['"composition"', '"protein"', '"fat"', '"calories"', '"energy"', 'Гарантированные', 'жир']) {
    const index = json.indexOf(term);
    console.log(`\n${term} @ ${index}`);
    if (index >= 0) console.log(json.slice(index - 300, index + 800));
  }
})();
