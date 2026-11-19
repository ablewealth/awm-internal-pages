# awm-internal-pages

Planning tools for Able Wealth Management, served as static pages. Each tool runs entirely in the browser.

## Structure

- `index.html`: landing page with links to the tools
- `pages/<page-name>/index.html`: each tool lives in its own folder
- `assets/vendor/`: third-party libraries served from this site (see the README in that folder)
- `tests/`: checks that run before every deploy
- `.github/workflows/static.yml`: runs the tests, then publishes `index.html`, `pages/` and `assets/`

| Page | What it does |
|---|---|
| `pages/rentvbuy/` | Los Angeles rent v buy projection with a securities-backed loan |
| `pages/roth401k/` | Roth v pre-tax 401(k) comparison |
| `pages/tax-aware-engine/` | Growth of a fund that produces yearly deductions |
| `pages/client-doc/` | Plan walkthrough data entry and print layout |

## Add a new page

1. Create a folder: `pages/<your-page-name>/` (no spaces in the name).
2. Add an `index.html` inside it. Include `<meta name="robots" content="noindex, nofollow">`.
3. Load libraries from `assets/vendor/`, not a CDN.
4. Add a link in the root `index.html`.

Anything outside `index.html`, `pages/` and `assets/` is not published.

## Tests

```
node tests/rentvbuy.test.js   # the rent v buy model, read straight from the page
node tests/site.test.js       # links, noindex tags, no CDN scripts, vendored files, built files
```

No install is needed. Both run in the deploy workflow, and a failure stops the deploy.

When a change to the rent v buy model moves the expected figures on purpose, update the numbers in the first test of `tests/rentvbuy.test.js`.

## Rent v buy

### Saving scenarios

- **Save in this browser** keeps a named scenario in the browser's local storage on that device.
- **Save to file** downloads the inputs as a JSON file. **Load from file** reads one back.
- Loading a scenario sets every input. Inputs the scenario does not mention go back to the page default.

Scenario files hold client figures. Keep them out of this repository.

### Yearly tax update

All figures are married filing jointly. The dollar amounts sit in two places:

1. The `TAX` table near the top of the script in `pages/rentvbuy/index.html`.
2. The defaults and notes in the Tax Assumptions and Transaction Costs cards on the page.

| Figure | 2026 value | Where it comes from |
|---|---|---|
| SALT cap and phase-down threshold | $40,400 and $505,000, each +1% a year through 2029, then a $10,000 cap | IRC 164(b)(6) and (7) |
| Federal standard deduction | $32,200 | IRS inflation revenue procedure (Rev. Proc. 2025-32 for 2026) |
| Start of the 37% bracket | $768,700 | Same revenue procedure |
| Itemized deduction limit in the 37% bracket | 2/37 of the deductions | IRC 68 |
| Mortgage debt limit, federal | $750,000 | IRC 163(h)(3)(F) |
| Mortgage debt limit, California | $1,000,000 | Cal. Rev. and Tax. Code 17225 |
| California standard deduction | $11,800 | FTB yearly indexing, published each fall |
| California itemized deduction limitation threshold | $521,561 (the 2025 figure of $504,411 indexed 3.4%) | Cal. Rev. and Tax. Code 17077; confirm against the Schedule CA (540) instructions when published |
| California brackets | 9.3% to $768,218, 10.3% to $921,854, 11.3% to $1,536,426, then 12.3%; plus 1% over $1,000,000 | FTB yearly indexing; Cal. Rev. and Tax. Code 17043 |
| Measure ULA | 4% above $5.4M, 5.5% above $10.9M | City of Los Angeles, adjusted each July 1 |
| Home sale exclusion | $500,000 | IRC 121 |

After updating, change `TAX.baseYear` and the First Tax Year default together, then run the tests. The last test checks that the page defaults and the table agree.

### What the model leaves out

- Returns on investments are entered after tax; yearly tax on dividends and interest is not modeled.
- Charitable gifts and other itemized deductions.
- AMT, and the extra $100,000 of home equity debt California allows.
- Purchase closing costs are not added to basis at sale.
- An unused box spread loss at the end of the projection is given no value.

## Tax-aware engine: rebuilding

The page loads `app.js` and `tailwind.css`, which are built from `app.jsx`. After editing `app.jsx`, run from the repository root:

```
npx esbuild@0.25.10 pages/tax-aware-engine/app.jsx --outfile=pages/tax-aware-engine/app.js \
  --jsx=transform --target=es2019 --minify --charset=utf8 --legal-comments=none \
  --banner:js="/* Built from app.jsx. Do not edit; rebuild with the commands in the README. */"

printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > /tmp/tw.css
npx tailwindcss@3.4.17 -i /tmp/tw.css -o pages/tax-aware-engine/tailwind.css \
  --content pages/tax-aware-engine/app.jsx --minify
```

`node tests/site.test.js` fails if the built files are behind the source.
