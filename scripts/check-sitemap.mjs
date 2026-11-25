import { readFileSync } from 'node:fs';

const sitemapPath = new URL('../public/sitemap.xml', import.meta.url);
const xml = readFileSync(sitemapPath, 'utf8');
const origin = 'https://stationerydotcom.me';

if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
  throw new Error('Sitemap is missing its UTF-8 XML declaration.');
}
if (!xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">') || !xml.trimEnd().endsWith('</urlset>')) {
  throw new Error('Sitemap does not contain a valid sitemap.org urlset root.');
}

const entries = [...xml.matchAll(/<url>([\\s\\S]*?)<\\/url>/g)].map(match => match[1]);
if (!entries.length) throw new Error('Sitemap contains no URL entries.');

const urls = [];
for (const [index, entry] of entries.entries()) {
  const locations = [...entry.matchAll(/<loc>([\\s\\S]*?)<\\/loc>/g)];
  if (locations.length !== 1) throw new Error(`Sitemap entry ${index + 1} must contain exactly one loc element.`);
  const raw = locations[0][1].trim();
  if (!raw || /[<>"']/.test(raw)) throw new Error(`Sitemap entry ${index + 1} has an invalid loc value.`);

  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error(`Sitemap entry ${index + 1} is not a valid URL: ${raw}`); }
  if (parsed.origin !== origin || parsed.protocol !== 'https:') {
    throw new Error(`Sitemap URL must use the canonical HTTPS origin ${origin}: ${raw}`);
  }
  if (parsed.search || parsed.hash) throw new Error(`Sitemap URL must not contain query strings or fragments: ${raw}`);
  if (/^\\/(?:admin|account|cart|order|invoice|order-success)(?:\\/|$)/i.test(parsed.pathname)) {
    throw new Error(`Private or transactional URL must not appear in the sitemap: ${raw}`);
  }
  for (const lastmod of entry.matchAll(/<lastmod>(.*?)<\\/lastmod>/g)) {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(lastmod[1])) {
      throw new Error(`Invalid lastmod date for ${raw}: ${lastmod[1]}`);
    }
  }
  urls.push(raw);
}

if (new Set(urls).size !== urls.length) throw new Error('Sitemap contains duplicate URLs.');

const requiredPaths = [
  '/', '/about', '/services', '/digital-subscriptions', '/document-services',
  '/meta-services', '/creative-services', '/smm', '/contact', '/track-order',
  '/help', '/blog', '/refund-policy', '/delivery-policy', '/privacy-policy',
  '/terms-of-service'
];
const missing = requiredPaths.filter(path => !urls.includes(origin + path));
if (missing.length) throw new Error('Sitemap is missing required public pages: ' + missing.join(', '));

if (!urls.some(url => url.startsWith(origin + '/services/'))) {
  throw new Error('Sitemap does not include any public service detail pages.');
}
if (!urls.some(url => url.startsWith(origin + '/blog/'))) {
  throw new Error('Sitemap does not include any published blog articles.');
}

console.log(`PASS: sitemap contains ${urls.length} unique canonical public URLs; required pages, service details, blog posts, and URL safety checks passed.`);
