// Loads the rent v buy model out of the page so it can be run in Node without a browser.
// Usage: const { run, TAX, helpers } = require('./harness');  run({ inPrice: '3,000,000' })
'use strict';
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'pages', 'rentvbuy', 'index.html');
const html = fs.readFileSync(PAGE, 'utf8');

// Page defaults, read from the markup
function readDefaults() {
  const d = {};
  const attr = (tag, name) => { const m = new RegExp('\\b' + name + '="([^"]*)"').exec(tag); return m ? m[1] : null; };
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0], id = attr(tag, 'id');
    if (!id) continue;
    d[id] = attr(tag, 'type') === 'checkbox' ? { checked: /\schecked\b/.test(tag) } : { value: attr(tag, 'value') || '' };
  }
  for (const m of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const opts = [...m[2].matchAll(/<option\b([^>]*)>/g)].map(o => ({ value: attr(o[1], 'value'), selected: /\sselected\b/.test(o[1]) }));
    const sel = opts.find(o => o.selected) || opts[0];
    d[m[1]] = { value: sel ? sel.value : '' };
  }
  return d;
}

// The model: everything in the page's main script before render()
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const main = scripts[scripts.length - 1];
const start = main.indexOf('"use strict";');
const end = main.indexOf('function render()');
if (start < 0 || end < 0) throw new Error('Could not find the model in ' + PAGE);
const factory = new Function('document',
  main.slice(start, end) + '\nreturn { runModel: runModel, TAX: TAX, saltCapFor: saltCapFor, mortgageShare: mortgageShare, parsePlannedCosts: parsePlannedCosts, findMaxPrice: findMaxPrice, checkPrice: checkPrice };');

const defaults = readDefaults();

function build(overrides) {
  const state = {};
  for (const id of Object.keys(defaults)) state[id] = Object.assign({}, defaults[id]);
  for (const id of Object.keys(overrides || {})) {
    if (!state[id]) throw new Error('Unknown input: ' + id);
    if (typeof overrides[id] === 'boolean') state[id].checked = overrides[id]; else state[id].value = String(overrides[id]);
  }
  const document = { getElementById: id => { if (!state[id]) throw new Error('Model read an input that is not on the page: ' + id); return state[id]; } };
  return factory(document);
}

const base = build();
module.exports = {
  defaults,
  TAX: base.TAX,
  helpers: { saltCapFor: base.saltCapFor, mortgageShare: base.mortgageShare, parsePlannedCosts: base.parsePlannedCosts },
  run: (overrides, opts) => build(overrides).runModel(opts || {}),
  maxPrice: (overrides, limits) => build(overrides).findMaxPrice(Object.assign({ keepPct: 0, reserve: 0, scaleInsurance: false }, limits)),
  checkPrice: (overrides, price, limits) => build(overrides).checkPrice(price, Object.assign({ keepPct: 0, reserve: 0, scaleInsurance: false }, limits)),
};
