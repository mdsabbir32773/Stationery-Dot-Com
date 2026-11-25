import { chromium } from 'playwright';
import { getPaymentMethods, getWalletPaymentMethods } from '../src/lib/paymentMethods.js';
import { getSmmUnitPrice } from '../src/lib/smmPricing.js';
import { getUploadMime, getPaymentProofMime } from '../src/lib/fileValidation.js';

const baseURL = process.env.SDC_BASE_URL || 'https://stationerydotcom.me';
const browser = await chromium.launch({ headless: true });
const errors = [];

const paymentMethods = getPaymentMethods({
  payment_bkash_number: '01700000000',
  payment_bkash_qr_url: '/bkash-qr.png',
  payment_nagad_number: '01800000000',
  payment_nagad_qr_url: '/nagad-qr.png',
  payment_rocket_number: '01900000000',
  payment_bank_details: 'Example Bank · Account 123456',
  payment_qr_url: '/shared-qr.png'
});
for (const name of ['bKash', 'Nagad', 'Rocket', 'Bank transfer', 'Bangla QR']) {
  if (!paymentMethods.some(method => method.name === name)) {
    throw new Error(`Configured payment channel is missing from checkout options: ${name}`);
  }
}
const walletMethods = getWalletPaymentMethods({
  payment_bkash_number: '01700000000',
  payment_nagad_qr_url: '/nagad-qr.png',
  payment_rocket_number: '01900000000',
  payment_bank_details: 'Example Bank · Account 123456',
  payment_qr_url: '/shared-qr.png'
});
if (walletMethods.map(method => method.name).join(',') !== 'bKash,Nagad,Rocket,Bank transfer') {
  throw new Error('Wallet deposit must offer only RPC-supported mobile banking and bank transfer methods.');
}
if (getWalletPaymentMethods({ payment_qr_url: '/shared-qr.png' }).length !== 0) {
  throw new Error('Generic Bangla QR must not be offered for SMM wallet deposits.');
}
const genericPayment = getPaymentMethods({ payment_number: '01700000000' });
if (genericPayment.length !== 1 || genericPayment[0].name !== 'Mobile banking') {
  throw new Error('Generic mobile banking payment fallback is missing.');
}
if (getPaymentProofMime({ type: '', name: 'receipt.jpg' }) !== 'image/jpeg' ||
    getPaymentProofMime({ type: 'application/octet-stream', name: 'receipt.png' }) !== 'image/png' ||
    getUploadMime({ type: 'application/octet-stream', name: 'identity.pdf' }) !== 'application/pdf' ||
    getPaymentProofMime({ type: 'application/pdf', name: 'receipt.pdf' }) !== '') {
  throw new Error('Mobile-safe upload MIME detection is not enforcing the allowed file types correctly.');
}
const fridaySmmPrice = getSmmUnitPrice({ smm_service_code: 'FB-FOL-WW', smm_price_per_1000: 100 }, new Date('2026-11-27T00:00:00Z'));
const regularSmmPrice = getSmmUnitPrice({ smm_service_code: 'FB-FOL-WW', smm_price_per_1000: 100 }, new Date('2026-11-26T00:00:00Z'));
if (fridaySmmPrice !== 80 || regularSmmPrice !== 100) {
  throw new Error(`Friday SMM pricing mismatch: Friday=${fridaySmmPrice}, regular=${regularSmmPrice}`);
}

try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!response || response.status() >= 400) {
    throw new Error(`Homepage returned HTTP ${response?.status() ?? 'no response'}`);
  }

  const homepageHeaders = response.headers();
  for (const [header, expected] of Object.entries({
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  })) {
    if ((homepageHeaders[header] || '').toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`Homepage security header ${header} is missing or incorrect: ${homepageHeaders[header] || 'missing'}`);
    }
  }

  if (!(await page.title()).includes('Stationery Dot Com')) {
    throw new Error('Homepage title does not identify Stationery Dot Com.');
  }
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  if (canonical !== `${baseURL}/`) {
    throw new Error(`Homepage canonical is incorrect: ${canonical}`);
  }
  await page.waitForFunction(() => Boolean(document.querySelector('#stationery-seo-jsonld')?.textContent));
  const graph = JSON.parse(await page.locator('#stationery-seo-jsonld').textContent());
  const nodes = graph['@graph'] || [];
  const website = nodes.find(node => node['@type'] === 'WebSite');
  const organization = nodes.find(node => node['@type'] === 'Organization');
  if (website?.name !== 'Stationery Dot Com' || !website.alternateName?.includes('stationerydotcom.me')) {
    throw new Error('Homepage WebSite structured data is missing the Stationery Dot Com brand identity.');
  }
  if (!organization?.sameAs?.includes('https://share.google/xEArz6d6u5OedmY07') ||
      organization.logo !== `${baseURL}/stationery-dot-com-logo.webp`) {
    throw new Error('Organization structured data is missing the Google Business Profile link or brand logo.');
  }
  const faviconHref = await page.locator('link[rel="icon"][type="image/png"]').getAttribute('href');
  if (faviconHref !== '/favicon-192.png') {
    throw new Error(`Google-compatible PNG favicon is missing or incorrect: ${faviconHref}`);
  }
  const faviconResponse = await page.request.get(new URL(faviconHref, baseURL).href);
  if (faviconResponse.status() !== 200 || !(faviconResponse.headers()['content-type'] || '').includes('image/png')) {
    throw new Error('PNG favicon did not return a successful image/png response.');
  }

  // Mobile quick-nav must navigate, reset the viewport, and show the active destination.
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobilePage.on('pageerror', error => errors.push(error.message));
  mobilePage.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mobilePage.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await mobilePage.waitForFunction(() => {
      const nav = document.querySelector('.sdc-mobile-nav');
      if (!nav) return false;
      const style = getComputedStyle(nav);
      const rect = nav.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }, { timeout: 15000 });
  } catch {
    const mobileNavDiagnostics = await mobilePage.evaluate(() => {
      const nav = document.querySelector('.sdc-mobile-nav');
      const style = nav ? getComputedStyle(nav) : null;
      const rect = nav?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        viewportMeta: document.querySelector('meta[name="viewport"]')?.content,
        navExists: Boolean(nav),
        display: style?.display,
        visibility: style?.visibility,
        rect: rect ? { width: rect.width, height: rect.height, bottom: rect.bottom } : null,
        stylesheets: [...document.styleSheets].map(sheet => sheet.href).filter(Boolean)
      };
    });
    throw new Error('Mobile quick navigation is not visible: ' + JSON.stringify(mobileNavDiagnostics));
  }
  await mobilePage.evaluate(() => window.scrollTo(0, Math.max(500, document.body.scrollHeight - window.innerHeight)));
  await mobilePage.locator('.sdc-mobile-nav a[href="/services"]').click();
  await mobilePage.waitForURL('**/services');
  await mobilePage.waitForFunction(() => window.scrollY <= 2);
  await mobilePage.locator('.catalog-head h1').waitFor({ state: 'visible', timeout: 15000 });
  const servicesNavState = await mobilePage.locator('.sdc-mobile-nav a[href="/services"]').evaluate(el => ({
    ariaCurrent: el.getAttribute('aria-current'),
    className: el.className,
    pathname: window.location.pathname,
    html: el.outerHTML
  }));
  if (servicesNavState.ariaCurrent !== 'page' && !servicesNavState.className.split(/\\s+/).includes('active')) {
    throw new Error('Mobile quick navigation did not visibly mark Services as active: ' + JSON.stringify(servicesNavState));
  }
  await mobilePage.evaluate(() => window.scrollTo(0, Math.max(500, document.body.scrollHeight - window.innerHeight)));
  await mobilePage.locator('.sdc-mobile-nav a[href="/services"]').click();
  await mobilePage.waitForFunction(() => window.scrollY <= 2, { timeout: 10000 });

  const burger = mobilePage.locator('button.burger');
  await burger.click();
  if (await burger.getAttribute('aria-expanded') !== 'true') {
    throw new Error('Mobile hamburger menu did not expose its expanded state.');
  }
  await mobilePage.locator('#site-navigation a[href="/contact"]').click();
  await mobilePage.waitForURL('**/contact');
  await mobilePage.waitForFunction(() => window.scrollY <= 2, { timeout: 10000 });
  if (await burger.getAttribute('aria-expanded') !== 'false') {
    throw new Error('Selecting a hamburger-menu destination did not close the mobile menu.');
  }
  await mobilePage.close();

  // Service data outages must be visible and recoverable on both homepage and catalog.
  const recoveryPage = await browser.newPage();
  let failedServiceRequests = 0;
  await recoveryPage.route('**/rest/v1/services**', async route => {
    failedServiceRequests += 1;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Simulated service data outage' })
    });
  });
  await recoveryPage.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const homeRecoveryAlert = recoveryPage.getByRole('alert');
  await homeRecoveryAlert.waitFor({ state: 'visible', timeout: 15000 });
  await homeRecoveryAlert.getByRole('button', { name: 'Try again' }).click();
  await recoveryPage.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('Browse services'), { timeout: 15000 });
  if (failedServiceRequests < 4) {
    throw new Error('Homepage retry did not re-request service data after a simulated outage.');
  }

  await recoveryPage.goto(`${baseURL}/services`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const catalogRecoveryAlert = recoveryPage.getByRole('alert');
  await catalogRecoveryAlert.waitFor({ state: 'visible', timeout: 15000 });
  const beforeCatalogRetry = failedServiceRequests;
  await catalogRecoveryAlert.getByRole('button', { name: 'Try again' }).click();
  await recoveryPage.waitForTimeout(1000);
  if (failedServiceRequests <= beforeCatalogRetry) {
    throw new Error('Services catalog retry did not re-request its service list.');
  }
  await recoveryPage.close();

  // Cart item removal must update the visible cart and persisted cart state.
  await page.evaluate(() => localStorage.setItem('stationery_cart_v1', JSON.stringify([
    { id: 'sdc-smoke-package', name: 'Smoke test package', service_name: 'Smoke test service', price: 100, quantity: 1 }
  ])));
  const cartPageResponse = await page.goto(`${baseURL}/cart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!cartPageResponse || cartPageResponse.status() >= 400) {
    throw new Error(`Cart page returned HTTP ${cartPageResponse?.status() ?? 'no response'}`);
  }
  await page.locator('.cart-item').waitFor({ state: 'visible', timeout: 15000 });
  const paymentSelector = page.getByLabel('Choose payment method *');
  await paymentSelector.waitFor({ state: 'visible', timeout: 15000 });
  const livePaymentOptions = await paymentSelector.locator('option').allTextContents();
  for (const name of ['bKash', 'Nagad', 'Rocket', 'Bangla QR']) {
    if (!livePaymentOptions.includes(name)) {
      throw new Error(`Live cart checkout is missing configured payment method: ${name}`);
    }
  }
  await paymentSelector.selectOption({ label: 'Nagad' });
  if (await paymentSelector.inputValue() !== 'Nagad') {
    throw new Error('Cart checkout did not switch to the selected Nagad payment channel.');
  }
  await paymentSelector.selectOption({ label: 'bKash' });
  await page.getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('heading', { name: 'Your cart is empty' }).waitFor({ state: 'visible', timeout: 10000 });
  const remainingCartItems = await page.evaluate(() => JSON.parse(localStorage.getItem('stationery_cart_v1') || '[]'));
  if (remainingCartItems.length !== 0) {
    throw new Error('Removing the last cart item did not clear the persisted cart.');
  }

  // Verify crawl configuration and sitemap coverage on the deployed domain.
  const [robotsResponse, sitemapResponse] = await Promise.all([
    page.request.get(`${baseURL}/robots.txt`),
    page.request.get(`${baseURL}/sitemap.xml`)
  ]);
  if (robotsResponse.status() !== 200 || sitemapResponse.status() !== 200) {
    throw new Error(`Robots/sitemap endpoint failed: robots=${robotsResponse.status()}, sitemap=${sitemapResponse.status()}`);
  }
  const sitemapHeaders = sitemapResponse.headers();
  if ((sitemapHeaders['x-content-type-options'] || '').toLowerCase() !== 'nosniff' ||
      (sitemapHeaders['x-frame-options'] || '').toLowerCase() !== 'deny') {
    throw new Error('Worker-generated sitemap is missing security response headers.');
  }
  const robotsText = await robotsResponse.text();
  const sitemapText = await sitemapResponse.text();
  if (!robotsText.includes(`Sitemap: ${baseURL}/sitemap.xml`)) {
    throw new Error('robots.txt does not reference the canonical sitemap URL.');
  }
  if (!sitemapText.includes(`${baseURL}/track-order`) || !sitemapText.includes(`${baseURL}/blog/`)) {
    throw new Error('Sitemap is missing the public order-tracking page or published blog URLs.');
  }
  if (/\/(?:invoice|cart|order|account|admin)(?:\/|<)/i.test(sitemapText)) {
    throw new Error('Sitemap contains a private or transactional URL that should not be indexed.');
  }

  // Unknown client-side routes must return a real HTTP 404 and remain non-indexable.
  const missingPage = await page.request.get(`${baseURL}/this-page-does-not-exist-sdc-smoke`, { headers: { accept: 'text/html' } });
  const missingHtmlText = await missingPage.text();
  if (missingPage.status() !== 404 || !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(missingHtmlText)) {
    throw new Error(`Unknown public route must return HTTP 404 with server-side noindex, got status=${missingPage.status()}`);
  }
  await page.evaluate(() => {
    window.history.pushState({}, '', '/this-page-does-not-exist-sdc-smoke');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForFunction(() => document.title.toLowerCase().includes('page not found') &&
    document.querySelector('meta[name="robots"]')?.content.includes('noindex'));
  const missingRobots = await page.locator('meta[name="robots"]').getAttribute('content');
  if (!missingRobots?.includes('noindex')) {
    throw new Error('SPA navigation to an unknown route did not apply noindex metadata.');
  }

  const checkoutAlias = await page.request.get(`${baseURL}/checkout`, { maxRedirects: 0 });
  if (checkoutAlias.status() !== 308 || new URL(checkoutAlias.headers().location || '', baseURL).pathname !== '/cart') {
    throw new Error('Checkout alias must permanently redirect to the private cart route.');
  }

  // Public assistant endpoint must reject oversized and malformed request bodies before model execution.
  const assistantEndpoint = 'https://efrqreeyuopdvmghfedx.supabase.co/functions/v1/sdc-assistant';
  const oversizedAssistantBody = JSON.stringify({ message: 'x'.repeat(25000), history: [] });
  const oversizedAssistantResponse = await page.request.post(assistantEndpoint, {
    data: oversizedAssistantBody,
    headers: { 'content-type': 'application/json' }
  });
  if (oversizedAssistantResponse.status() !== 413) {
    throw new Error(`SDC Assistant must reject request bodies above 24 KB, got ${oversizedAssistantResponse.status()}`);
  }
  const malformedAssistantResponse = await page.request.post(assistantEndpoint, {
    data: '{',
    headers: { 'content-type': 'application/json' }
  });
  if (malformedAssistantResponse.status() !== 400) {
    throw new Error(`SDC Assistant must return 400 for malformed JSON, got ${malformedAssistantResponse.status()}`);
  }

  const trackingResponse = await page.goto(`${baseURL}/track-order`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!trackingResponse || trackingResponse.status() >= 400) {
    throw new Error(`Track Order page returned HTTP ${trackingResponse?.status() ?? 'no response'}`);
  }
  const trackingRobots = await page.locator('meta[name="robots"]').getAttribute('content');
  if (trackingRobots?.includes('noindex')) {
    throw new Error('Public Track Order landing page is incorrectly marked noindex.');
  }

  // SPA navigation to a private tokenized tracking URL must refresh noindex metadata.
  await page.evaluate(() => {
    window.history.pushState({}, '', '/track-order?token=SEO-SMOKE-TEST');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForFunction(() => document.querySelector('meta[name="robots"]')?.content.includes('noindex'));
  const spaTrackingRobots = await page.locator('meta[name="robots"]').getAttribute('content');
  if (!spaTrackingRobots?.includes('noindex')) {
    throw new Error('SPA navigation to token-based tracking URL did not apply noindex.');
  }

  const invoiceResponse = await page.goto(`${baseURL}/invoice/SEO-SMOKE-TEST`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!invoiceResponse || invoiceResponse.status() >= 400) {
    throw new Error(`Invoice route returned HTTP ${invoiceResponse?.status() ?? 'no response'}`);
  }
  const invoiceRobots = await page.locator('meta[name="robots"]').getAttribute('content');
  if (!invoiceRobots?.includes('noindex')) {
    throw new Error('Private invoice route is missing its noindex directive.');
  }

  const invoiceRootResponse = await page.request.get(`${baseURL}/invoice`, { headers: { accept: 'text/html' } });
  const invoiceRootHtml = await invoiceRootResponse.text();
  if (invoiceRootResponse.status() !== 404 ||
      !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(invoiceRootHtml)) {
    throw new Error('Invoice root without an invoice code must return 404 and server-side noindex.');
  }

  const orderSuccessRootResponse = await page.request.get(`${baseURL}/order-success`, { headers: { accept: 'text/html' } });
  const orderSuccessRootHtml = await orderSuccessRootResponse.text();
  if (orderSuccessRootResponse.status() !== 404 ||
      !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(orderSuccessRootHtml)) {
    throw new Error('Order-success root without an order code must return 404 and server-side noindex.');
  }

  const accountResponse = await page.goto(`${baseURL}/account`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!accountResponse || accountResponse.status() >= 400) {
    throw new Error(`Account route returned HTTP ${accountResponse?.status() ?? 'no response'}`);
  }
  const accountRobots = await page.locator('meta[name="robots"]').getAttribute('content');
  if (!accountRobots?.includes('noindex')) {
    throw new Error('Private customer account route is missing its noindex directive.');
  }

  const secureTrackingResponse = await page.goto(`${baseURL}/track-order?token=SEO-SMOKE-TEST`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!secureTrackingResponse || secureTrackingResponse.status() >= 400) {
    throw new Error(`Secure tracking route returned HTTP ${secureTrackingResponse?.status() ?? 'no response'}`);
  }
  const secureTrackingRobots = await page.locator('meta[name="robots"]').getAttribute('content');
  if (!secureTrackingRobots?.includes('noindex')) {
    throw new Error('Token-based private tracking URL is missing its noindex directive.');
  }

  const subscriptionResponse = await page.goto(`${baseURL}/digital-subscriptions`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!subscriptionResponse || subscriptionResponse.status() >= 400) {
    throw new Error(`Digital subscriptions page returned HTTP ${subscriptionResponse?.status() ?? 'no response'}`);
  }
  await page.getByRole('heading', { name: 'Digital Subscriptions in Bangladesh' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.title.includes('Digital Subscriptions Bangladesh'));
  await page.waitForFunction(() => {
    try {
      const graph = JSON.parse(document.querySelector('#stationery-seo-jsonld')?.textContent || '{}')['@graph'] || [];
      return graph.some(node => node['@type'] === 'WebPage' && node.name?.includes('Digital Subscriptions Bangladesh'));
    } catch { return false; }
  });
  const internalGraph = JSON.parse(await page.locator('#stationery-seo-jsonld').textContent())['@graph'] || [];
  if (internalGraph.some(node => node['@type'] === 'WebSite')) {
    throw new Error('WebSite site-name structured data should only be present on the homepage.');
  }
  const internalWebPage = internalGraph.find(node => node['@type'] === 'WebPage');
  if (internalWebPage?.isPartOf) {
    throw new Error('A non-homepage WebPage must not reference a WebSite node omitted from its structured-data graph.');
  }

  const blogArticleResponse = await page.goto(`${baseURL}/blog/personal-vs-shared-digital-subscription-guide`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!blogArticleResponse || blogArticleResponse.status() >= 400) {
    throw new Error(`Published blog article returned HTTP ${blogArticleResponse?.status() ?? 'no response'}`);
  }
  await page.locator('.blog-detail h1').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.title.includes('Personal নাকি Shared Subscription?'));
  const blogGraph = JSON.parse(await page.locator('#stationery-seo-jsonld').textContent())['@graph'] || [];
  if (!blogGraph.some(node => node['@type'] === 'BlogPosting')) {
    throw new Error('Published blog article is missing BlogPosting structured data.');
  }
  const blogOgType = await page.locator('meta[property="og:type"]').getAttribute('content');
  if (blogOgType !== 'article') {
    throw new Error(`Published blog article Open Graph type should be article, got: ${blogOgType}`);
  }
  const blogPublishedTime = await page.locator('meta[property="article:published_time"]').getAttribute('content');
  if (!blogPublishedTime) {
    throw new Error('Published blog article is missing article:published_time metadata.');
  }
  await page.locator('.blog-article-body a[href="/digital-subscriptions"]').waitFor({ state: 'visible', timeout: 10000 });
  const blogDescription = await page.locator('meta[name="description"]').getAttribute('content');
  if (!blogDescription || blogDescription.length > 165) {
    throw new Error('Blog article meta description is missing or exceeds the 165-character limit.');
  }

  const documentResponse = await page.goto(`${baseURL}/document-services`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!documentResponse || documentResponse.status() >= 400) {
    throw new Error(`Document services page returned HTTP ${documentResponse?.status() ?? 'no response'}`);
  }
  await page.getByRole('heading', { name: 'Online Document Services in Bangladesh' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByText(/No approval or completion time can be guaranteed/).waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => document.title.includes('Online Document Services Bangladesh'));

  const metaResponse = await page.goto(`${baseURL}/meta-services`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!metaResponse || metaResponse.status() >= 400) {
    throw new Error(`Meta services page returned HTTP ${metaResponse?.status() ?? 'no response'}`);
  }
  await page.getByRole('heading', { name: 'Meta Ads & Social Media Services in Bangladesh' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.title.includes('Meta Ads & Page Services Bangladesh'));

  const creativeResponse = await page.goto(`${baseURL}/creative-services`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!creativeResponse || creativeResponse.status() >= 400) {
    throw new Error(`Creative services page returned HTTP ${creativeResponse?.status() ?? 'no response'}`);
  }
  await page.getByRole('heading', { name: 'Graphic Design, Video Editing & Web Design in Bangladesh' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.title.includes('Graphic Design & Video Editing BD'));

  const cartResponse = await page.goto(`${baseURL}/cart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!cartResponse || cartResponse.status() >= 400) {
    throw new Error(`Cart page returned HTTP ${cartResponse?.status() ?? 'no response'}`);
  }
  const cartRobots = await page.locator('meta[name="robots"]').getAttribute('content');
  if (!cartRobots?.includes('noindex')) {
    throw new Error('Customer cart route is missing its noindex directive.');
  }

  const wwwResponse = await page.goto('https://www.stationerydotcom.me/services/canva', { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!wwwResponse || new URL(page.url()).hostname !== 'stationerydotcom.me') {
    throw new Error('The www hostname did not redirect to the canonical domain.');
  }
  const legacyResponse = await page.goto('https://stationerydotcom.stdc.workers.dev/services/canva', { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!legacyResponse || new URL(page.url()).hostname !== 'stationerydotcom.me') {
    throw new Error('The workers.dev hostname did not redirect to the canonical domain.');
  }
  await page.getByRole('link', { name: /Browse all digital subscriptions/ }).waitFor({ state: 'visible', timeout: 15000 });

  const documentDetailResponse = await page.goto(`${baseURL}/services/birth-certificate`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!documentDetailResponse || documentDetailResponse.status() >= 400) {
    throw new Error(`Birth certificate detail page returned HTTP ${documentDetailResponse?.status() ?? 'no response'}`);
  }
  await page.getByRole('link', { name: /Browse all document services/ }).waitFor({ state: 'visible', timeout: 15000 });

  const reviewServiceResponse = await page.goto(`${baseURL}/services/smm-fb-reviews-genuine`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!reviewServiceResponse || reviewServiceResponse.status() >= 400) {
    throw new Error(`Facebook reviews service page returned HTTP ${reviewServiceResponse?.status() ?? 'no response'}`);
  }
  await page.waitForFunction(() => document.title.includes('Facebook Reviews Service Bangladesh'));

  const smmResponse = await page.goto(`${baseURL}/smm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!smmResponse || smmResponse.status() >= 400) {
    throw new Error(`SMM page returned HTTP ${smmResponse?.status() ?? 'no response'}`);
  }
  await page.getByRole('heading', { name: /SMM Panel Bangladesh/ }).waitFor({ state: 'visible', timeout: 15000 });
  const welcomeOffer = page.locator('.welcome5-smm-banner');
  await welcomeOffer.waitFor({ state: 'visible', timeout: 25000 });
  const offerText = await welcomeOffer.innerText();
  if (!/WELCOME5/.test(offerText) || !/5% OFF/.test(offerText) || !/৳300/.test(offerText) || !/৳50/.test(offerText)) {
    throw new Error('WELCOME5 SMM offer banner is missing its code or discount terms.');
  }

  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const launcher = page.getByRole('button', { name: 'Chat with SDC Assistant' });
  await launcher.waitFor({ state: 'visible', timeout: 15000 });
  await launcher.click();

  const chat = page.locator('[aria-label="SDC Assistant chat"]');
  await chat.waitFor({ state: 'visible', timeout: 10000 });

  // The order flow starts when the visitor types a natural request; do not submit an order.
  const compose = chat.locator('.sdc-chat-compose input');
  await compose.fill('ORDER KORTE CHAI');
  await compose.press('Enter');

  const orderFlow = chat.locator('.sdc-convo-card');
  await orderFlow.waitFor({ state: 'visible', timeout: 15000 });
  const orderReply = orderFlow.locator('input[aria-label="Your message"]');
  await orderReply.waitFor({ state: 'visible', timeout: 10000 });
  await orderReply.fill('GEMINI ORDER KORBO');
  await orderReply.press('Enter');
  await chat.getByText(/Gemini AI \/ Google AI/i).last().waitFor({ state: 'visible', timeout: 10000 });
  await orderReply.fill('12 months');
  await orderReply.press('Enter');
  await chat.getByText(/অর্ডারে কোন নামটি দেব/i).waitFor({ state: 'visible', timeout: 10000 });

  // Fill demo-only details, confirm the review, and stop at payment without uploading or submitting.
  await orderReply.fill('Smoke Test Customer');
  await orderReply.press('Enter');
  await chat.getByText(/আপনার বাংলাদেশি মোবাইল নম্বরটি দিন/i).last().waitFor({ state: 'visible', timeout: 10000 });
  await orderReply.fill('01700000000');
  await orderReply.press('Enter');
  await chat.getByText(/WhatsApp নম্বরটি কি মোবাইল নম্বরের থেকে আলাদা/i).last().waitFor({ state: 'visible', timeout: 10000 });
  await orderReply.fill('same');
  await orderReply.press('Enter');
  await chat.getByText(/অর্ডারের জন্য কোন ইমেইল ব্যবহার করব/i).last().waitFor({ state: 'visible', timeout: 10000 });
  await orderReply.fill('skip');
  await orderReply.press('Enter');
  await chat.getByText(/টিমকে জানানোর মতো কোনো নির্দেশনা আছে/i).last().waitFor({ state: 'visible', timeout: 10000 });
  await orderReply.fill('skip');
  await orderReply.press('Enter');
  await chat.getByText(/অর্ডারের তথ্যগুলো আবার দেখুন/i).last().waitFor({ state: 'visible', timeout: 10000 });
  await orderReply.fill('confirm');
  await orderReply.press('Enter');

  const proofUpload = orderFlow.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]');
  await proofUpload.waitFor({ state: 'visible', timeout: 10000 });
  const qrImage = orderFlow.locator('.pay .qrbox img');
  await qrImage.waitFor({ state: 'visible', timeout: 10000 });
  const qr = await qrImage.evaluate(image => ({ source: image.src, width: image.naturalWidth }));
  if (!qr.source.startsWith('data:image/jpeg;base64,') || qr.width < 200) {
    throw new Error('Payment QR JPG did not load correctly in the chat.');
  }

  // Reload to leave the unfinished order and check that guest wallet requests still require sign-in.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  const reloadedLauncher = page.getByRole('button', { name: 'Chat with SDC Assistant' });
  await reloadedLauncher.waitFor({ state: 'visible', timeout: 15000 });
  await reloadedLauncher.click();
  const depositChat = page.locator('[aria-label="SDC Assistant chat"]');
  await depositChat.waitFor({ state: 'visible', timeout: 10000 });
  const depositCompose = depositChat.locator('.sdc-chat-compose input');
  await depositCompose.fill('wallet deposit');
  await depositCompose.press('Enter');
  await depositChat.getByRole('link', { name: /sign in/i }).waitFor({ state: 'visible', timeout: 15000 });

  if (errors.length) {
    throw new Error('Browser console/page errors:\n' + errors.slice(0, 8).join('\n'));
  }

  console.log('PASS: crawlable robots and sitemap endpoints, public Track Order indexing, private invoice/account/token-tracking noindex, published blog title, excerpt, BlogPosting schema and contextual internal link, homepage-only WebSite schema, branded homepage and PNG favicon, digital subscriptions, document, Meta and creative services landing pages, private-route noindex, canonical host redirects, contextual service-to-category links, Facebook reviews service SEO metadata, SMM page and WELCOME5 offer, chat launcher, Gemini service matching, package duration selection, payment QR/screenshot upload, and guest deposit sign-in gate.');
} finally {
  await browser.close();
}
