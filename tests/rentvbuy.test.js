// Regression tests for the rent v buy model. Run with: node tests/rentvbuy.test.js
// No dependencies. The model is read straight from pages/rentvbuy/index.html.
'use strict';
const assert = require('assert');
const { run, maxPrice, checkPrice, TAX, helpers, defaults } = require('./harness');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + '\n        ' + String(e.message).split('\n')[0]); }
}
const near = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= (tol === undefined ? 1 : tol), (label || 'value') + ': expected ' + expected + ', got ' + actual);
const last = m => m.years[m.years.length - 1];
const sum = (m, key) => m.years.reduce((s, y) => s + y[key], 0);
// Inputs that switch every tax effect off, for checking one rule at a time
const NO_BOX_TAX = { inBoxTax: 'none' };

console.log('rent v buy model');

// ── Whole-model results at the page defaults. If a change moves these on purpose, update the numbers. ──
test('page defaults: headline results', () => {
  const m = run(), y1 = m.years[0], L = last(m);
  assert.strictEqual(m.years.length, 15);
  near(m.totalUpfront, 412000);
  near(y1.monthlyOwn, 15640);
  near(y1.monthlyRent, 8000);
  near(y1.ownerMonthlySave, 2360);
  near(y1.fedTaxBenefit, 14646);
  near(y1.caTaxBenefit, 8239);
  near(sum(m, 'fedTaxBenefit'), 192504, 2);
  near(sum(m, 'caTaxBenefit'), 119378, 2);
  near(L.taxableGain, 630892);
  near(L.advantage, -840785, 2);
});

test('every yearly figure is a finite number across varied scenarios', () => {
  const cases = [
    {}, { inUseBox: false }, { inPrice: '6,500,000' }, { inPrice: '12,000,000', inCollateral: '9,000,000' },
    { inDownPct: 100 }, { inDownPct: 0 }, { inMortTerm: '15' }, { inRefiYear: 3, inRefiRate: 4.5 },
    { inMAGI: '300,000', inCAIncomeTax: '18,000', inFedRate: 24, inCARate: 9.3 }, { inHorizon: 30 }, { inHorizon: 1 },
    { inMonthlySavings: '0' }, { inBoxTax: 'interest' }, { inBoxTax: 'none' }, { inMaxLTV: 40 }, { inTaxYear: 2029 },
    { inPlannedCosts: '2027: 30,000; 2028: 60,000; 2029: 64,060' }, { inCollateral: '0', inSettlement: '0', inHYS: '0' },
  ];
  cases.forEach(c => run(c).years.forEach(y => Object.keys(y).forEach(k =>
    assert.ok(Number.isFinite(y[k]), JSON.stringify(c) + ' year ' + y.year + ' ' + k + ' = ' + y[k]))));
});

// ── Savings: the cost gap is counted once ──
test('renter keeps full savings; owner savings fall by exactly the cost gap', () => {
  const m = run(), y1 = m.years[0];
  near(y1.renterMonthlySave, 10000, 0.01);
  near(y1.ownerMonthlySave, y1.renterMonthlySave - (y1.monthlyOwn - y1.monthlyRent), 0.01);
});
test('owner savings can go negative (no floor at zero)', () => {
  const y1 = run({ inMonthlySavings: '1,000' }).years[0];
  assert.ok(y1.ownerMonthlySave < 0);
});
test('planned costs lower both sides equally and leave the buy v rent gap unchanged', () => {
  const a = run(), b = run({ inPlannedCosts: '2027: 30,000; 2028: 60,000; 4: 64,060' });
  near(b.years[1].plannedCost, 30000, 0);
  near(b.years[2].plannedCost, 60000, 0);
  near(b.years[3].plannedCost, 64060, 0);
  near(b.years[1].renterMonthlySave, a.years[1].renterMonthlySave - 2500, 0.01);
  near(b.years[1].ownerMonthlySave, a.years[1].ownerMonthlySave - 2500, 0.01);
  near(last(b).advantage, last(a).advantage, 0.5);
  assert.ok(last(b).renterNW < last(a).renterNW);
});
test('planned costs parser', () => {
  assert.deepStrictEqual(helpers.parsePlannedCosts('2027: 30,000; 2028: $60,000; 3: 5; junk; 2027: 1', 2026), { 2: 30001, 3: 60005 });
  assert.deepStrictEqual(helpers.parsePlannedCosts('', 2026), {});
  assert.deepStrictEqual(helpers.parsePlannedCosts('2020: 500', 2026), {});
});

// ── Federal rules ──
test('SALT cap schedule (IRC 164(b)(6)-(7))', () => {
  near(helpers.saltCapFor(2025, 40400, 0), 40000, 0.01);
  near(helpers.saltCapFor(2026, 40400, 505000), 40400, 0.01);
  near(helpers.saltCapFor(2026, 40400, 555000), 25400, 0.01);
  near(helpers.saltCapFor(2026, 40400, 1000000), 10000, 0.01);
  near(helpers.saltCapFor(2027, 40400, 0), 40804, 0.01);
  near(helpers.saltCapFor(2029, 40400, 0), 40400 * Math.pow(1.01, 3), 0.01);
  near(helpers.saltCapFor(2030, 40400, 0), 10000, 0.01);
});
test('SALT cap falls to $10,000 in 2030 inside a projection', () => {
  const m = run({ inMAGI: '400,000' });
  const y2029 = m.years.find(y => y.taxYear === 2029), y2030 = m.years.find(y => y.taxYear === 2030);
  assert.ok(y2029.saltCapY > 40000);
  near(y2030.saltCapY, 10000, 0.01);
});
test('federal benefit, year 1, worked by hand: $750K limit, SALT cap, IRC 68', () => {
  const m = run(NO_BOX_TAX), y1 = m.years[0];
  // average balance for the year is the mean of the opening and closing balance
  const avgBal = (m.loanAmt + y1.mortBal) / 2;
  const mortInt = y1.yrInterest * (750000 / avgBal);
  const ownerItemized = mortInt + 10000;                       // SALT cap is $10,000 at $1M MAGI
  const allowed = ownerItemized * (35 / 37);                   // all of it sits in the 37% bracket
  near(y1.fedTaxBenefit, (allowed - 32200) * 0.37, 0.5);
});
test('IRC 68 does not apply below the 37% bracket', () => {
  const m = run(Object.assign({ inMAGI: '600,000', inFedRate: 35 }, NO_BOX_TAX)), y1 = m.years[0];
  const avgBal = (m.loanAmt + y1.mortBal) / 2;
  const cap = helpers.saltCapFor(2026, 40400, 600000);
  near(y1.fedTaxBenefit, (y1.yrInterest * 750000 / avgBal + cap - 32200) * 0.35, 0.5);
});
test('a renter who would itemize anyway is the baseline, not the standard deduction', () => {
  // MAGI under the phase-down, state income tax above the standard deduction
  const m = run(Object.assign({ inMAGI: '450,000', inCAIncomeTax: '38,000', inFedRate: 32, inPrice: '900,000' }, NO_BOX_TAX)), y1 = m.years[0];
  const owner = y1.yrInterest + Math.min(40400, 38000 + y1.annualPropTax); // loan is under $750K
  near(y1.fedTaxBenefit, (owner - 38000) * 0.32, 0.5);
});
test('mortgage interest share rises as the balance amortizes', () => {
  near(helpers.mortgageShare(750000, 1500000), 0.5, 1e-9);
  near(helpers.mortgageShare(750000, 600000), 1, 1e-9);
});

// ── California rules ──
test('California benefit, year 1, worked by hand: $1M limit, 6% limitation, no SALT cap', () => {
  const m = run(NO_BOX_TAX), y1 = m.years[0];
  const avgBal = (m.loanAmt + y1.mortBal) / 2;
  const limited = y1.yrInterest * (1000000 / avgBal) + y1.annualPropTax;
  const cut = Math.min(0.8 * limited, 0.06 * (1000000 - 521561));
  near(y1.caTaxBenefit, (limited - cut - 11800) * 0.113, 0.5);
});
test('California limitation is capped at 80% of the deductions', () => {
  const m = run(Object.assign({ inMAGI: '5,000,000' }, NO_BOX_TAX)), y1 = m.years[0];
  const avgBal = (m.loanAmt + y1.mortBal) / 2;
  const limited = y1.yrInterest * (1000000 / avgBal) + y1.annualPropTax;
  near(y1.caTaxBenefit, Math.max(0, limited * 0.2 - 11800) * 0.113, 0.5);
});
test('no California limitation below the AGI threshold', () => {
  const m = run(Object.assign({ inMAGI: '500,000' }, NO_BOX_TAX)), y1 = m.years[0];
  const avgBal = (m.loanAmt + y1.mortBal) / 2;
  near(y1.caTaxBenefit, (y1.yrInterest * (1000000 / avgBal) + y1.annualPropTax - 11800) * 0.113, 0.5);
});

// ── Securities-backed loan ──
test('box spread cost as a capital loss: gains first, then $3,000 of ordinary income, rest carried forward', () => {
  const none = run({ inBoxTax: 'none', inPortYield: 0 }), cap = run({ inBoxTax: 'capital', inPortYield: 0 });
  const y1n = none.years[0], y1c = cap.years[0];
  near(y1c.fedTaxBenefit - y1n.fedTaxBenefit, 3000 * 0.37, 0.01);
  near(y1c.caTaxBenefit - y1n.caTaxBenefit, 3000 * 0.113, 0.01);
  const full = run({ inBoxTax: 'capital', inPortYield: 10 }).years[0];
  near(full.fedTaxBenefit - y1n.fedTaxBenefit, full.boxInt * 0.238, 0.01);
  near(full.caTaxBenefit - y1n.caTaxBenefit, full.boxInt * 0.113, 0.01);
});
test('no deduction and no box loan give the same tax benefit from the house', () => {
  const m = run({ inBoxTax: 'none' });
  assert.strictEqual(m.boxTaxMode, 'none');
  assert.strictEqual(run({ inUseBox: false }).boxTaxMode, 'none');
});
test('max LTV sets how much cash moves into the pledged portfolio', () => {
  const at50 = run({ inMaxLTV: 50 }), at40 = run({ inMaxLTV: 40 });
  near(at50.addToCollateral, 0, 0.01);                       // $412,000 loan needs $824,000; $1M is pledged
  near(at40.addToCollateral, 412000 / 0.40 - 1000000, 0.01); // needs $1,030,000
  near(at40.maxLTV, 0.40, 1e-9);
  near(run({ inMaxLTV: 0 }).maxLTV, 0.50, 1e-9);             // nonsense falls back to 50%
});

// ── Sale ──
test('transfer tax at purchase is charged only when the buyer pays it', () => {
  near(run().purchaseTransferTax, 0, 0);
  const b = run({ inBuyerPaysTransfer: true });
  near(b.purchaseTransferTax, 2000000 * 0.0056, 0.01);
  near(b.totalUpfront, 412000 + 11200, 0.01);
});
test('gain at sale is net of selling costs and transfer taxes, less the $500,000 exclusion', () => {
  const L = last(run());
  near(L.totalGain, L.homeVal - L.sellCost - L.exitTransfer - L.ulaAtExit - 2000000, 0.01);
  near(L.taxableGain, L.totalGain - 500000, 0.01);
  near(L.totalCapGainsTax, L.taxableGain * (0.238 + 0.113), 0.01);
});
test('Measure ULA: 4% and 5.5% tiers on the whole price, City of Los Angeles only', () => {
  const flat = { inAppreciation: 0, inHorizon: 1 };
  near(last(run(Object.assign({ inPrice: '5,000,000' }, flat))).ulaRate, 0, 0);
  near(last(run(Object.assign({ inPrice: '6,000,000' }, flat))).ulaRate, 0.04, 0);
  near(last(run(Object.assign({ inPrice: '12,000,000' }, flat))).ulaRate, 0.055, 0);
  const L = last(run(Object.assign({ inPrice: '6,000,000' }, flat)));
  near(L.ulaAtExit, 6000000 * 0.04, 0.01);
  near(last(run(Object.assign({ inPrice: '12,000,000', inCityLA: false }, flat))).ulaAtExit, 0, 0);
});

// ── Maximum purchase price ──
test('max price with no savings kept and flat insurance: cash flow binds before funding', () => {
  const r = maxPrice();
  assert.strictEqual(r.cashFlow, 2305000);
  assert.strictEqual(r.funding, 4245000);
  assert.strictEqual(r.max, 2305000);
  assert.strictEqual(r.binding, 'cashFlow');
  assert.deepStrictEqual(r.buy, { kind: 'upTo', price: 1540000 });
});
test('the max price passes both limits and the next $5,000 does not', () => {
  const r = maxPrice();
  const at = checkPrice({}, r.max), over = checkPrice({}, r.max + 5000);
  assert.ok(at.cashFlowOk && at.fundingOk);
  assert.ok(!over.cashFlowOk);
  assert.ok(checkPrice({}, r.funding).fundingOk && !checkPrice({}, r.funding + 5000).fundingOk);
});
test('testing a price gives the same result as typing it into the page', () => {
  const typed = last(run({ inPrice: '2,465,000' })), tested = last(run({}, { price: 2465000 }));
  near(tested.advantage, typed.advantage, 0.001);
  near(checkPrice({}, 2465000).advantage, typed.advantage, 0.001);
});
test('max price at the card defaults: keep 20% of savings, insurance scaled with price', () => {
  assert.strictEqual(Number(defaults.inOptKeepPct.value), 20);
  assert.strictEqual(defaults.inOptScaleIns.checked, true);
  const r = maxPrice({}, { keepPct: 0.2, scaleInsurance: true });
  assert.strictEqual(r.max, 2040000);
  assert.strictEqual(r.binding, 'cashFlow');
  assert.deepStrictEqual(r.buy, { kind: 'upTo', price: 1605000 });
});
test('keeping a share of savings and a cash reserve each lower their limit', () => {
  const base = maxPrice(), tight = maxPrice({}, { keepPct: 0.3, reserve: 300000 });
  assert.ok(tight.cashFlow < base.cashFlow);
  assert.ok(tight.funding < base.funding);
  near(tight.atMax.worstRequired, 3000, 0.01);               // 30% of $10,000 a month in year 1
  assert.ok(tight.atMax.worstSave >= 3000 && tight.atMax.cashLeft >= 300000);
});
test('the share to keep is measured against savings before planned costs', () => {
  const r = maxPrice({ inPlannedCosts: '2: 24,000' }, { keepPct: 0.2 });
  assert.strictEqual(r.atMax.worstYear, 2);
  near(r.atMax.worstRequired, 0.2 * 10000 * 1.03, 0.01);     // year 2 savings capacity is $10,300 a month
});
test('insurance scales in proportion to the tested price, and not at all when switched off', () => {
  near(checkPrice({}, 3000000, { scaleInsurance: true }).insurance, 18000 * 1.5, 0.01);
  near(checkPrice({}, 3000000, { scaleInsurance: false }).insurance, 18000, 0.01);
  near(checkPrice({}, 2000000, { scaleInsurance: true }).insurance, 18000, 0.01);   // the entered price keeps the entered premium
  assert.ok(maxPrice({}, { scaleInsurance: true }).max < maxPrice().max);
});
test('applying the max price with its scaled insurance gives the same max again', () => {
  const lim = { keepPct: 0.2, scaleInsurance: true };
  const r = maxPrice({}, lim);
  const again = maxPrice({ inPrice: r.max.toLocaleString('en-US'), inInsurance: Math.round(r.atMax.insurance).toLocaleString('en-US') }, lim);
  near(again.max, r.max, 5000);
});
test('planned costs lower the cash flow limit, and the tightest year moves to the costly year', () => {
  const r = maxPrice({ inPlannedCosts: '3: 60,000' });
  assert.ok(r.cashFlow < maxPrice().cashFlow);
  assert.strictEqual(r.atMax.worstYear, 3);
});
test('no price works when savings cannot cover planned costs', () => {
  const r = maxPrice({ inPlannedCosts: '1: 500,000' });
  assert.strictEqual(r.max, null);
  assert.strictEqual(r.cashFlow, null);
  assert.strictEqual(r.binding, 'cashFlow');
});
test('funding limit follows the max LTV, and a loan with no collateral cannot be funded', () => {
  assert.ok(maxPrice({ inMaxLTV: 40 }).funding < maxPrice({ inMaxLTV: 50 }).funding);
  const none = { inCollateral: '0', inSettlement: '0', inHYS: '0' };
  assert.ok(run(none).collateralGap > 0);
  assert.strictEqual(maxPrice(none).funding, null);
});
test('without the securities loan the funding limit is cash plus the portfolio', () => {
  const r = maxPrice({ inUseBox: false, inMonthlySavings: '100,000' });
  // $750K cash plus a $1M portfolio that nets 82.45 cents per dollar sold (half is gain, taxed at 23.8% + 11.3%),
  // against 20.6% of the price up front
  assert.strictEqual(r.binding, 'funding');
  near(r.funding, (750000 + 1000000 * (1 - 0.5 * 0.351)) / 0.206, 5000);
});
test('selling the portfolio to fund the purchase also pays the tax on the sale', () => {
  const m = run({ inUseBox: false, inSettlement: '100,000', inHYS: '50,000' });
  near(m.fromLiquidation, 412000 - 150000, 0.01);                // cash the purchase still needs
  near(m.liquidationCapGainsTax, m.portfolioSold * 0.5 * 0.351, 0.01);
  near(m.portfolioSold, m.fromLiquidation + m.liquidationCapGainsTax, 0.01);
  near(m.collateral, 1000000 - m.portfolioSold, 0.01);
  near(m.fundingGap, 0, 0.01);
});

// ── The page and the tax table stay in step ──
test('page defaults match the tax table year', () => {
  assert.strictEqual(Number(defaults.inTaxYear.value), TAX.baseYear);
  assert.strictEqual(defaults.inSALT.value, '40,400');
  assert.strictEqual(defaults.inFedStdDed.value, '32,200');
  assert.strictEqual(defaults.inCAStdDed.value, '11,800');
  assert.strictEqual(defaults.inMortRate.value, '7.25');   // 30-year jumbo rate, November 2026; update with the market
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
