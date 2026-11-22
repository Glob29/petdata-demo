'use strict';

const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('petdata/report/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
if (!scripts.length) throw new Error('script not found');

const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      innerHTML: '',
      textContent: '',
      value: '',
      checked: false,
      dataset: {},
      classList: { add() {}, remove() {}, contains() { return false; } },
      addEventListener() {},
      closest() { return null; }
    });
  }
  return elements.get(id);
}

const document = {
  documentElement: { classList: { add() {} } },
  getElementById: element,
  querySelectorAll: () => [],
  addEventListener() {}
};

try {
  for (const script of scripts) {
    vm.runInNewContext(script, { document, console, Date, Number, String, Math, Set, Object, JSON });
  }
  console.log('OK runtime');
  console.log('productBody length:', element('productBody').innerHTML.length);
  console.log('breedBody length:', element('breedBody').innerHTML.length);
  console.log('certBody length:', element('certBody').innerHTML.length);
  console.log('product table rows:', (element('productBody').innerHTML.match(/<tr/g) || []).length);
} catch (error) {
  console.error('RUNTIME ERROR:', error.stack);
  process.exitCode = 1;
}
