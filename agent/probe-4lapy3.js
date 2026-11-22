'use strict';

(async () => {
  const url = 'https://4lapy.ru/product/royal-canin-sterilised-37-regular-suhoj-korm-dlya-sterilizovannyh-koshek-s-1-do-7-let-2-kg-1012-1000715/';
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const data = JSON.parse(html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const pp = data.props.pageProps;
  console.log('activeOffer', pp.activeOffer?.name, pp.activeOffer?.price, pp.activeOffer?.article);
  console.log('product keys', Object.keys(pp.initialState?.product || {}));
  console.log('persisted keys', Object.keys(pp.initialState?.persistedProduct || {}));
  const product = pp.initialState?.product || {};
  console.log(JSON.stringify(product).slice(0, 3000));
})();
