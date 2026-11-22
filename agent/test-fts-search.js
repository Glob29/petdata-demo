'use strict';
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('petdata/db/petdata.db');
for (const query of ['"кури"*', '"инде"*', '"говя"*', '"лосо"*']) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM product_fts WHERE product_fts MATCH ?').get(query);
  console.log(query, row.n);
}
