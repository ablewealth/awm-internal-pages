// Checks the site as a whole: links resolve, pages stay out of search, nothing loads code from a CDN,
// the vendored libraries are intact, and the built tax-aware engine matches its source.
// Run with: node tests/site.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + '\n        ' + String(e.message).split('\n')[0]); }
}
function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.name.startsWith('.') || e.name === 'node_modules') return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? htmlFiles(p) : e.name.endsWith('.html') ? [p] : [];
  });
}
const pages = htmlFiles(ROOT);
const rel = p => path.relative(ROOT, p);

console.log('site');

test('there are pages to check', () => assert.ok(pages.length >= 5, 'found ' + pages.length));

test('every page asks search engines not to index it', () => {
  pages.forEach(p => assert.ok(/<meta\s+name="robots"\s+content="noindex, nofollow"/.test(fs.readFileSync(p, 'utf8')), rel(p)));
});

test('no page loads a script from another site', () => {
  pages.forEach(p => {
    const m = /<script[^>]+src="(https?:)?\/\/[^"]+"/.exec(fs.readFileSync(p, 'utf8'));
    assert.ok(!m, rel(p) + ' loads ' + (m && m[0]));
  });
});

test('local links, scripts and stylesheets point at files that exist', () => {
  pages.forEach(p => {
    const html = fs.readFileSync(p, 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, m => m.slice(0, m.indexOf('>') + 1));
    for (const m of html.matchAll(/<(?:a|link|script)\b[^>]*?\b(?:href|src)="([^"#?]+)[^"]*"/g)) {
      const url = m[1];
      if (/^(https?:|mailto:|data:|javascript:)/.test(url)) continue;
      let target = path.resolve(path.dirname(p), decodeURIComponent(url));
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      assert.ok(fs.existsSync(target), rel(p) + ' links to missing ' + url);
    }
  });
});

test('vendored libraries match the hashes in assets/vendor/README.md', () => {
  const dir = path.join(ROOT, 'assets', 'vendor');
  const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  assert.ok(files.length >= 5);
  files.forEach(f => {
    const hash = crypto.createHash('sha384').update(fs.readFileSync(path.join(dir, f))).digest('base64');
    assert.ok(readme.includes(f) && readme.includes(hash), f + ' does not match its recorded hash');
  });
});

test('tax-aware engine: app.js was rebuilt after the last change to app.jsx', () => {
  const dir = path.join(ROOT, 'pages', 'tax-aware-engine');
  const src = fs.readFileSync(path.join(dir, 'app.jsx'), 'utf8');
  const built = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(dir, 'tailwind.css'), 'utf8');
  // every piece of on-screen text in the source should be in the build
  const strings = [...src.matchAll(/>\s*([A-Z][A-Za-z][A-Za-z ,.'-]{12,60})\s*</g)].map(m => m[1].trim());
  assert.ok(strings.length > 5, 'found too few strings to compare');
  strings.forEach(s => assert.ok(built.includes(s), 'app.js is missing "' + s + '"; rebuild it'));
  // every Tailwind class in the source should be in the stylesheet
  const classes = new Set([...src.matchAll(/className="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)).filter(Boolean));
  const esc = c => c.replace(/[^a-zA-Z0-9_-]/g, ch => '\\' + ch);
  [...classes].forEach(c =>
    assert.ok(css.includes('.' + esc(c)), 'tailwind.css is missing .' + c + '; rebuild it'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
