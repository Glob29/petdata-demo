'use strict';

(async () => {
  const url = 'https://4lapy.ru/product/sterilised-korm-dlya-sterilizovannyh-koshek-s-indejkoj-1-9-kg-86249-1018213/';
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  console.log('match', Boolean(match));
  if (!match) return;
  const data = JSON.parse(match[1]);
  console.log(Object.keys(data));
  console.log(Object.keys(data.props || {}));
  console.log(Object.keys(data.props?.pageProps || {}));
  const json = JSON.stringify(data);
  for (const term of ['Состав', 'белок', 'Белки', 'протеин', 'ккал']) {
    const index = json.indexOf(term);
    console.log(term, index, index >= 0 ? json.slice(index - 200, index + 500) : '');
  }
})();
