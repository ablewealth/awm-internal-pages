# Vendored libraries

Third-party scripts served from this site so the pages do not depend on a CDN.
Each file is the exact build the pages were written against. Do not edit them.

| File | Library | Version | License | Copied from |
|---|---|---|---|---|
| `chart-4.4.1.umd.min.js` | Chart.js | 4.4.1 | MIT | cdnjs `Chart.js/4.4.1/chart.umd.min.js` |
| `react-18.2.0.production.min.js` | React | 18.2.0 | MIT | cdnjs `react/18.2.0/umd/react.production.min.js` |
| `react-dom-18.2.0.production.min.js` | React DOM | 18.2.0 | MIT | cdnjs `react-dom/18.2.0/umd/react-dom.production.min.js` |
| `prop-types-15.8.1.min.js` | prop-types | 15.8.1 | MIT | cdnjs `prop-types/15.8.1/prop-types.min.js` |
| `recharts-2.12.7.min.js` | Recharts | 2.12.7 | MIT | cdnjs `recharts/2.12.7/Recharts.min.js` |

SHA-384 of each file, to confirm nothing has changed:

```
chart-4.4.1.umd.min.js              bs/nf9FbdNouRbMiFcrcZfLXYPKiPaGVGplVbv7dLGECccEXDW+S3zjqSKR5ZEaD
prop-types-15.8.1.min.js            /AfDwVDXNopzPvhxMPQ11y1OCpR6mVkWx47qzSwIiquvxkcMkZddEzDNtIOtfCpk
react-18.2.0.production.min.js      tMH8h3BGESGckSAVGZ82T9n90ztNXxvdwvdM6UoR56cYcf+0iGXBliJ29D+wZ/x8
react-dom-18.2.0.production.min.js  bm7MnzvK++ykSwVJ2tynSE5TRdN+xL418osEVF2DE/L/gfWHj91J2Sphe582B1Bh
recharts-2.12.7.min.js              brJ6l1O00vI/z1hn+hhCacN01P6iPOt1mCnUn0PXagRn/09IdsN2mPRZKPu5Fw6O
```

Check with: `openssl dgst -sha384 -binary <file> | openssl base64 -A`

The Rent vs Buy page carries its own copy of Chart.js 4.4.1 inside the HTML so it works as a single saved file.
