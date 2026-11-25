import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const ga = read('../src/lib/googleAnalytics.js');
const app = read('../src/App.jsx');
const pkg = read('../src/components/PackageCard.jsx');
const cart = read('../src/pages/Cart.jsx');
const success = read('../src/pages/OrderSuccess.jsx');
const contact = read('../src/pages/Contact.jsx');
const floating = read('../src/components/WhatsAppButton.jsx');

const checks = [
  ['GA4 is opt-in through a Measurement ID', /VITE_GA4_ID/.test(ga) && /if\(typeof window==='undefined'\|\|!validId\(\)\)return false/.test(ga)],
  ['Sensitive order routes are normalized', /\/invoice\/:code/.test(ga) && /\/order-success\/:code/.test(ga)],
  ['Page views omit query strings and admin routes', ga.includes('split(/[?#]/,1)') && ga.includes("safePath==='/admin'")],
  ['SPA page views use pathname only', /trackGooglePageView\(location\.pathname,document\.title\)/.test(app) && !/trackGooglePageView\([^\n]*location\.search/.test(app)],
  ['Add-to-cart event is wired', /trackGoogleEvent\('add_to_cart'/.test(pkg)],
  ['Checkout event is wired', /trackGoogleEvent\('begin_checkout'/.test(cart)],
  ['Lead event is deduplicated', /sdc_ga_lead_/.test(success) && /trackGoogleEvent\('generate_lead'/.test(success)],
  ['Contact events are wired', /trackGoogleEvent\('contact_click'/.test(contact) && /trackGoogleEvent\('contact_click'/.test(floating)]
];
const failed = checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log((ok?'PASS: ':'FAIL: ')+name);
if(failed.length)process.exit(1);
console.log('PASS: GA4 instrumentation is optional, sanitized, and covers core conversion events.');
