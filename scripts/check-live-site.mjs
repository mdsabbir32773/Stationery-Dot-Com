const origin = (process.env.SDC_BASE_URL || 'https://stationerydotcom.me').replace(/\/$/, '');
const expectedHost = new URL(origin).hostname;
const failures = [];

async function request(pathOrUrl) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : origin + pathOrUrl;
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
    headers: { 'user-agent': 'Stationery-Dot-Com-Health-Check/1.0' }
  });
  return response;
}

for (const path of ['/', '/services', '/smm', '/blog', '/contact', '/privacy-policy', '/help', '/sitemap.xml', '/robots.txt']) {
  try {
    const response = await request(path);
    if (!response.ok) failures.push(path + ' returned HTTP ' + response.status);
    if (new URL(response.url).hostname !== expectedHost) {
      failures.push(path + ' did not resolve to canonical host: ' + response.url);
    }
    if (path === '/' || path === '/services') {
      for (const [name, expected] of [
        ['x-content-type-options', 'nosniff'],
        ['referrer-policy', 'strict-origin-when-cross-origin'],
        ['x-frame-options', 'DENY']
      ]) {
        if ((response.headers.get(name) || '').toLowerCase() !== expected.toLowerCase()) {
          failures.push(path + ' missing/incorrect ' + name + ' header');
        }
      }
    }
    if (path === '/sitemap.xml') {
      const xml = await response.text();
      if (!xml.includes('<urlset') || !xml.includes('</urlset>')) {
        failures.push('sitemap.xml is not a valid urlset document');
      }
      const urls = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map(match => match[1].trim());
      if (urls.length < 20) failures.push('sitemap.xml has unexpectedly few URLs: ' + urls.length);
      if (new Set(urls).size !== urls.length) failures.push('sitemap.xml contains duplicate URLs');
      for (const value of urls) {
        try {
          const parsed = new URL(value);
          if (parsed.origin !== origin || parsed.protocol !== 'https:' || parsed.search || parsed.hash) {
            failures.push('sitemap.xml contains a non-canonical URL: ' + value);
            break;
          }
          if (/^\/(?:admin|account|cart|order|invoice|order-success)(?:\/|$)/i.test(parsed.pathname)) {
            failures.push('sitemap.xml contains a private/transactional URL: ' + value);
            break;
          }
        } catch {
          failures.push('sitemap.xml contains an invalid URL: ' + value);
          break;
        }
      }
    }
    if (path === '/robots.txt') {
      const robots = await response.text();
      for (const rule of [
        'User-agent: *',
        'Allow: /',
        'Sitemap: ' + origin + '/sitemap.xml',
        'Disallow: /admin',
        'Disallow: /account',
        'Disallow: /cart',
        'Disallow: /order',
        'Disallow: /order-success/'
      ]) {
        if (!robots.split(/\r?\n/).map(line => line.trim()).includes(rule)) {
          failures.push('robots.txt is missing rule: ' + rule);
        }
      }
    }
  } catch (error) {
    failures.push(path + ' request failed: ' + (error?.message || String(error)));
  }
}

for (const url of [
  'https://www.stationerydotcom.me/',
  'https://stationerydotcom.stdc.workers.dev/'
]) {
  try {
    const response = await request(url);
    if (!response.ok || new URL(response.url).hostname !== expectedHost) {
      failures.push('Alternate host did not redirect to canonical domain: ' + url + ' -> ' + response.url + ' (' + response.status + ')');
    }
  } catch (error) {
    failures.push('Alternate host check failed for ' + url + ': ' + (error?.message || String(error)));
  }
}

if (failures.length) {
  for (const failure of failures) console.error('FAIL: ' + failure);
  process.exit(1);
}
console.log('PASS: production routes, canonical redirects, security headers, sitemap and robots.txt are healthy.');
