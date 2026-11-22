'use strict';

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '..', 'db', 'petdata.db'));

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((row) => row.name);
console.log('TABLES:', tables.join(', '));
console.log('products:', db.prepare('SELECT COUNT(*) AS n FROM product').get().n);
console.log(db.prepare('SELECT id, brand_id, name, species, form, completeness, source_url FROM product ORDER BY brand_id, id LIMIT 40').all());
