'use strict';

const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');
try {
  db.exec('create virtual table t using fts5(x)');
  db.prepare('insert into t values (?)').run('курица индейка');
  console.log('FTS5 ok:', db.prepare("select * from t where t match 'курица'").all());
} catch (error) {
  console.log('FTS5 ERR:', error.message);
}
