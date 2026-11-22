'use strict';

const { stripHtml } = require('./lib/extract');

(async () => {
  const url = 'https://www.hillspet.ru/cat-food/sp-feline-science-plan-adult-optimal-care-chicken-dry';
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const text = stripHtml(await res.text());
  for (const term of ['бел', 'протеин', 'ккал', 'энерг', 'дополнит']) {
    console.log(`\n-- ${term} --`);
    const lower = text.toLowerCase();
    let idx = lower.indexOf(term);
    let n = 0;
    while (idx >= 0 && n < 4) {
      console.log('  ...' + text.slice(Math.max(0, idx - 160), idx + 220) + '...');
      idx = lower.indexOf(term, idx + term.length);
      n++;
    }
  }
})();
