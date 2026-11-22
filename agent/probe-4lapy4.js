'use strict';

(async () => {
  const url = 'https://4lapy.ru/product/royal-canin-sterilised-37-regular-suhoj-korm-dlya-sterilizovannyh-koshek-s-1-do-7-let-2-kg-1012-1000715/';
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const data = JSON.parse(html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const product = data.props.pageProps.initialState.product.product;
  console.log('keys', Object.keys(product));
  console.log('attributes type', Array.isArray(product.attributes), Object.keys(product.attributes || {}).slice(0, 20));
  console.log('offer keys', Object.keys(product.offers?.[0] || {}));
  const text = JSON.stringify(product);
  for (const term of ['composition', 'белок', 'Белок', 'Гарантированные', 'ккал']) {
    const i = text.indexOf(term);
    console.log('\n', term, i, i >= 0 ? text.slice(i - 100, i + 500) : '');
  }
})();
