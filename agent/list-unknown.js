'use strict';
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('petdata/db/petdata.db');
console.log(db.prepare("SELECT b.name, COUNT(*) AS n FROM product p JOIN brand b ON b.id = p.brand_id WHERE p.class = 'unknown' GROUP BY b.name").all());
