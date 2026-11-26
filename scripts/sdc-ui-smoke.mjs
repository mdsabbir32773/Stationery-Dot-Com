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
if (walletMethods.map(method => method.name).join(',') !== 'bKash,Nagad,Rocket,Bank transfer,Bangla QR') {
  throw new Error('Wallet deposit must offer only RPC-supported mobile banking and bank transfer methods.');
}
if (getWalletPaymentMethods({ payment_qr_url: '/shared-qr.png' }).map(method => method.name).join(',') !== 'Bangla QR') {
  throw new Error('Bangla QR must be available when it is configured for SMM wallet deposits.');
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
  try {
    await page.locator('.home-hero h1').waitFor({ state: 'visible', timeout: 20000 });
  } catch (error) {
    const bodyText = await page.locator('body').innerText().catch(() => '(body text unavailable)');
    throw new Error('Homepage React content did not render. Browser errors: ' + errors.slice(0,8).join(' | ') + ' Body text: ' + bodyText.slice(0,1200) + ' Original: ' + error.message);
  }
  await page.locator('.scard').first().waitFor({ state: 'visible', timeout: 20000 });
  // Verify client-side navigation from the homepage into each major service route.
  const routeTargets = [
    { href: '/digital-subscriptions', label: 'digital subscriptions' },
    { href: '/smm', label: 'SMM panel' },
    { href: '/meta-services', label: 'Meta services' },
    { href: '/creative-services', label: 'creative services' },
    { href: '/document-services', label: 'document services' },
    { href: '/services/canva', label: 'a subscription detail' }
  ];
  for (const target of routeTargets) {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('.home-hero h1').waitFor({ state: 'visible', timeout: 20000 });
    const routeLink = page.locator(`.home-seo-links a[href="${target.href}"]`).first();
    await routeLink.scrollIntoViewIfNeeded();
    await routeLink.click();
    console.log('Client navigation check: ' + target.label + ' (' + target.href + ')');
    await page.waitForURL(url => url.pathname === target.href, { timeout: 15000 });
    await page.locator('h1:visible').first().waitFor({ state: 'visible', timeout: 20000 });
    const routeText = await page.locator('body').innerText();
    if (routeText.trim().length < 80 || /PAGE DID NOT LOAD|Let’s get this page back/i.test(routeText)) {
      throw new Error(`Client navigation to ${target.label} did not render usable page content.`);
    }
  }
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('.home-hero h1').waitFor({ state: 'visible', timeout: 20000 });
  const zeroPriceServiceCards = await page.locator('.scard').evaluateAll(cards => cards.filter(card => card.innerText.includes('Starting from') && card.innerText.includes('৳0')).map(card => card.innerText.slice(0,160)));
  if (zeroPriceServiceCards.length) {
    throw new Error('Service cards must label zero-price quote packages as Price on request, not ৳0: ' + zeroPriceServiceCards.join(' | '));
  }
  const missingHomepageAlt = await page.locator('img').evaluateAll(images => images.filter(image => !image.hasAttribute('alt')).map(image => image.currentSrc || image.src));
  if (missingHomepageAlt.length) throw new Error('Homepage images missing alt attributes: ' + missingHomepageAlt.join(', '));
  const visibleH1 = page.locator('h1:visible');
  if (await visibleH1.count() !== 1) throw new Error('Homepage should have exactly one visible primary h1 heading; found ' + await visibleH1.count() + ': ' + JSON.stringify(await visibleH1.allTextContents()));
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
  if (organization?.address ||
      organization?.sameAs?.some(url => url.includes('google.com/maps') || url.includes('share.google')) ||
      organization.logo !== `${baseURL}/stationery-dot-com-logo.webp`) {
    throw new Error('Online-only Organization structured data must retain the brand logo and omit physical address/location links.');
  }
  const localBusiness = nodes.find(node => node['@type'] === 'LocalBusiness');
  if (localBusiness) {
    throw new Error('Online-only Stationery Dot Com must not publish LocalBusiness physical-location structured data.');
  }
  const crawlableHome = await page.request.get(baseURL + '/?seo-smoke=home');
  const crawlableHomeHtml = await crawlableHome.text();
  if (crawlableHome.status() !== 200 ||
      !crawlableHomeHtml.includes('Helpful guides from Stationery Dot Com') ||
      !crawlableHomeHtml.includes('/blog/nid-correction-preparation-checklist')) {
    throw new Error('Homepage fallback is missing crawlable links to published helpful guides.');
  }
  const nidSeoResponse = await page.request.get(baseURL + '/services/nid?seo-smoke=nid', { headers: { accept: 'text/html' } });
  const nidSeoHtml = await nidSeoResponse.text();
  const titleStart = nidSeoHtml.indexOf('<title>');
  const titleEnd = nidSeoHtml.indexOf('</title>', titleStart);
  const nidTitleSource = titleStart >= 0 && titleEnd > titleStart ? nidSeoHtml.slice(titleStart + 7, titleEnd) : '';
  const nidTitleText = nidTitleSource.replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
  const hasNidTitle = nidTitleText.includes('NID Application') && nidTitleText.includes('Correction BD') && nidTitleText.includes('Stationery Dot Com');
  const hasNidContent = nidSeoHtml.includes('Bangladesh National Identity Card application or correction assistance');
  if (nidSeoResponse.status() !== 200 || !hasNidTitle || !hasNidContent) {
    console.error('NID SEO smoke details:', JSON.stringify({ status: nidSeoResponse.status(), titleSource: nidTitleSource, titleText: nidTitleText, hasNidContent }));
    throw new Error('NID service fallback does not have a distinct, readable SEO title and useful content.');
  }
  const favicon = page.locator('link[rel="icon"][type="image/webp"]');
  const faviconHref = await favicon.getAttribute('href');
  if (faviconHref !== '/stationery-dot-com-logo.webp') {
    throw new Error(`Official Stationery Dot Com logo favicon is missing or incorrect: ${faviconHref}`);
  }
  const faviconResponse = await page.request.get(new URL(faviconHref, baseURL).href);
  if (faviconResponse.status() !== 200 || !(faviconResponse.headers()['content-type'] || '').includes('image/webp')) {
    throw new Error('Official WebP logo favicon did not return a successful image/webp response.');
  }

  // Privacy notice must disclose the optional GA4 event collection introduced in the analytics rollout.
  await page.goto(new URL('/privacy-policy', baseURL).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('heading', { name: 'Privacy Policy' }).waitFor({ state: 'visible', timeout: 15000 });
  const privacyText = await page.locator('main').innerText();
  if (!/Google Analytics 4/i.test(privacyText) || !/Measurement ID/i.test(privacyText) || !/query strings and order or invoice identifiers/i.test(privacyText)) {
    throw new Error('Privacy policy does not clearly disclose optional GA4 measurement and sanitized page paths.');
  }
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Mobile quick-nav must navigate, reset the viewport, and show the active destination.
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobileErrors = [];
  const mobileRequestFailures = [];
  mobilePage.on('pageerror', error => { mobileErrors.push(error.message); errors.push(error.message); });
  mobilePage.on('console', message => { if (message.type() === 'error') { mobileErrors.push(message.text()); errors.push(message.text()); } });
  mobilePage.on('requestfailed', request => mobileRequestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
  const mobileResponse = await mobilePage.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await mobilePage.waitForFunction(() => document.querySelector('#root')?.childElementCount > 0, { timeout: 15000 });
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
        url: location.href,
        title: document.title,
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        viewportMeta: document.querySelector('meta[name="viewport"]')?.content,
        rootChildren: document.querySelector('#root')?.childElementCount || 0,
        bodyText: document.body.innerText.slice(0, 500),
        scriptSources: [...document.scripts].map(script => script.src).filter(Boolean),
        navExists: Boolean(nav),
        display: style?.display,
        visibility: style?.visibility,
        rect: rect ? { width: rect.width, height: rect.height, bottom: rect.bottom } : null,
        stylesheets: [...document.styleSheets].map(sheet => sheet.href).filter(Boolean)
      };
    });
    mobileNavDiagnostics.responseStatus = mobileResponse?.status() ?? null;
    mobileNavDiagnostics.pageErrors = mobileErrors.slice(-10);
    mobileNavDiagnostics.requestFailures = mobileRequestFailures.slice(-10);
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
  await mobilePage.locator('.contact-page').waitFor({ state: 'visible', timeout: 10000 });
  const contactText = await mobilePage.locator('.contact-page').innerText();
  if (!/Fully online/i.test(contactText) || /G-Nat Tower|Fakirapool|VIP Road|Business address|Google Business Profile|Please contact us before visiting/i.test(contactText)) {
    throw new Error('Contact page must clearly describe remote-only support and must not show a physical address or office-visit instructions.');
  }
  if (await burger.getAttribute('aria-expanded') !== 'false') {
    throw new Error('Selecting a hamburger-menu destination did not close the mobile menu.');
  }
  await mobilePage.close();

  // Service data outages must be visible and recoverable on both homepage and catalog.
  const recoveryPage = await browser.newPage();
  recoveryPage.on('pageerror', error => errors.push('recovery page: '+error.message));
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
  try { await homeRecoveryAlert.waitFor({ state: 'visible', timeout: 20000 }); } catch (error) { const bodyText=await recoveryPage.locator('body').innerText().catch(()=>'(unavailable)'); throw new Error('Homepage outage alert missing; intercepted service requests='+failedServiceRequests+'; body='+bodyText.slice(0,1200)+'; browser errors='+errors.slice(-8).join(' | ')+'; '+error.message); }
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
    await recoveryPage.goto(`${baseURL}/meta-services`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const categoryRecoveryAlert = recoveryPage.getByRole('alert');
  await categoryRecoveryAlert.waitFor({ state: 'visible', timeout: 15000 });
  const beforeCategoryRetry = failedServiceRequests;
  await categoryRecoveryAlert.getByRole('button', { name: 'Try again' }).click();
  await recoveryPage.waitForTimeout(1000);
  if (failedServiceRequests <= beforeCategoryRetry) {
    throw new Error('Service category retry did not re-request its service list.');
  }

  await recoveryPage.goto(`${baseURL}/digital-subscriptions`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const subscriptionRecoveryAlert = recoveryPage.getByRole('alert');
  await subscriptionRecoveryAlert.waitFor({ state: 'visible', timeout: 15000 });
  const beforeSubscriptionRetry = failedServiceRequests;
  await subscriptionRecoveryAlert.getByRole('button', { name: 'Try again' }).click();
  await recoveryPage.waitForTimeout(1000);
  if (failedServiceRequests <= beforeSubscriptionRetry) {
    throw new Error('Digital subscription retry did not re-request its service list.');
  }

  await recoveryPage.goto(`${baseURL}/document-services`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const documentRecoveryAlert = recoveryPage.getByRole('alert');
  await documentRecoveryAlert.waitFor({ state: 'visible', timeout: 15000 });
  const beforeDocumentRetry = failedServiceRequests;
  await documentRecoveryAlert.getByRole('button', { name: 'Try again' }).click();
  await recoveryPage.waitForTimeout(1000);
  if (failedServiceRequests <= beforeDocumentRetry) {
    throw new Error('Document service retry did not re-request its service list.');
  }

  await recoveryPage.goto(`${baseURL}/services/canva`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const detailRecoveryAlert = recoveryPage.getByRole('alert');
  await detailRecoveryAlert.waitFor({ state: 'visible', timeout: 15000 });
  const beforeDetailRetry = failedServiceRequests;
  await detailRecoveryAlert.getByRole('button', { name: 'Try again' }).click();
  await recoveryPage.waitForTimeout(1000);
  if (failedServiceRequests <= beforeDetailRetry) {
    throw new Error('Service detail retry did not re-request its service record.');
  }

  await recoveryPage.goto(`${baseURL}/smm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const smmRecoveryAlert = recoveryPage.getByRole('alert');
  await smmRecoveryAlert.waitFor({ state: 'visible', timeout: 15000 });
  const beforeSmmRetry = failedServiceRequests;
  await smmRecoveryAlert.getByRole('button', { name: 'Try again' }).click();
  await recoveryPage.waitForTimeout(1000);
  if (failedServiceRequests <= beforeSmmRetry) {
    throw new Error('SMM catalogue retry did not re-request its service list.');
  }

  await recoveryPage.unroute('**/rest/v1/services**');
  let failedBlogRequests = 0;
  await recoveryPage.route('**/rest/v1/blog_posts**', async route => {
    failedBlogRequests += 1;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Simulated blog data outage' })
    });
  });
  await recoveryPage.goto(`${baseURL}/blog`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const blogRecoveryAlert = recoveryPage.getByRole('alert');
  await blogRecoveryAlert.waitFor({ state: 'visible', timeout: 15000 });
  const beforeBlogRetry = failedBlogRequests;
  await blogRecoveryAlert.getByRole('button', { name: 'Try again' }).click();
  await recoveryPage.waitForTimeout(1000);
  if (failedBlogRequests <= beforeBlogRetry) {
    throw new Error('Blog retry did not re-request published article data.');
  }

  await recoveryPage.close();

  // Quote-only cart items must offer a working next step instead of a disabled checkout.
  await page.evaluate(() => localStorage.setItem('stationery_cart_v1', JSON.stringify([
    { id: 'sdc-smoke-quote', name: 'Quote-only package', service_name: 'Quote-only service', price: 0, quantity: 1 }
  ])));
  await page.goto(`${baseURL}/cart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const quoteContact = page.getByRole('link', { name: 'Discuss these items on WhatsApp' });
  await quoteContact.waitFor({ state: 'visible', timeout: 10000 });
  if (!(await quoteContact.getAttribute('href'))?.includes('wa.me')) {
    throw new Error('Quote-only cart item does not have a valid WhatsApp discussion link.');
  }
  const quoteCheckoutButton = page.getByRole('button', { name: /Place 0 orders together/ });
  if (await quoteCheckoutButton.count()) {
    throw new Error('Quote-only cart must not expose an unusable paid checkout action.');
  }

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
  const quantityField = page.getByRole('textbox', { name: 'Quantity of Smoke test package' });
  await quantityField.waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('button', { name: 'Increase quantity of Smoke test package' }).waitFor({ state: 'visible' });
  const decreaseQuantity = page.getByRole('button', { name: 'Decrease quantity of Smoke test package' });
  if (!(await decreaseQuantity.isDisabled())) {
    throw new Error('Cart quantity decrement should be disabled at the minimum quantity of one.');
  }
  await page.getByRole('button', { name: 'Remove Smoke test package from cart' }).click();
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

  const assistantHelloStarted = Date.now();
  const assistantHelloResponse = await page.request.post(assistantEndpoint, {
    data: JSON.stringify({ message: 'Hello', history: [] }),
    headers: { 'content-type': 'application/json' },
    timeout: 10000
  });
  const assistantHelloElapsed = Date.now() - assistantHelloStarted;
  const assistantHelloData = await assistantHelloResponse.json();
  if (assistantHelloResponse.status() !== 200 || !/^Hello!/i.test(assistantHelloData.reply || '') || assistantHelloElapsed > 2500) {
    throw new Error(`Simple chatbot greeting should return a fast direct reply; status=${assistantHelloResponse.status()}, elapsed=${assistantHelloElapsed}ms, reply=${assistantHelloData.reply || assistantHelloData.error || 'empty'}`);
  }

  const streamStarted = Date.now();
  const streamController = new AbortController();
  const streamTimeout = setTimeout(() => streamController.abort(), 12000);
  let streamReader;
  let firstTokenText = '';
  try {
    const streamResponse = await fetch(assistantEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'What services do you offer? Reply in one short sentence.', history: [], stream: true }),
      signal: streamController.signal
    });
    if (!streamResponse.ok || !(streamResponse.headers.get('content-type') || '').includes('text/event-stream')) {
      const bodyText = await streamResponse.text();
      throw new Error(`Chatbot stream endpoint returned ${streamResponse.status}: ${bodyText.slice(0, 250)}`);
    }
    if (!streamResponse.body) throw new Error('Chatbot stream response has no readable body.');
    streamReader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!firstTokenText) {
      const { value, done } = await streamReader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      const boundary = buffer.indexOf('\n\n');
      if (boundary >= 0) {
        const event = buffer.slice(0, boundary);
        const dataLine = event.split('\n').find(line => line.startsWith('data:'));
        const data = dataLine?.slice(5).trim();
        if (data && data !== '[DONE]') {
          const payload = JSON.parse(data);
          firstTokenText = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
        }
      }
    }
    const firstTokenElapsed = Date.now() - streamStarted;
    if (!firstTokenText || firstTokenElapsed > 8000) {
      throw new Error(`Chatbot should stream its first text token promptly; elapsed=${firstTokenElapsed}ms, text=${firstTokenText.slice(0, 100)}`);
    }
  } finally {
    clearTimeout(streamTimeout);
    if (streamReader) await streamReader.cancel().catch(() => {});
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
  await page.waitForFunction(() => document.querySelector('.digital-subscriptions-page h1')?.textContent.includes('Digital Subscriptions in Bangladesh'), { timeout: 25000 }).catch(async error => {
    const state = await page.evaluate(() => ({ path: location.pathname, title: document.title, headings: [...document.querySelectorAll('h1,h2')].map(x => x.textContent.trim()), body: document.body.innerText.slice(0, 1800) }));
    throw new Error('Digital subscriptions heading did not render: ' + JSON.stringify(state) + ' · ' + error.message);
  });
  const missingSubscriptionAlt = await page.locator('img').evaluateAll(images => images.filter(image => !image.hasAttribute('alt')).map(image => image.currentSrc || image.src));
  if (missingSubscriptionAlt.length) throw new Error('Subscription page images missing alt attributes: ' + missingSubscriptionAlt.join(', '));
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
  const subscriptionLinks = page.locator('.blog-article-body a[href="/digital-subscriptions"]');
  if (await subscriptionLinks.count() < 1) throw new Error('Blog article is missing its internal digital-subscriptions link.');
  await subscriptionLinks.first().waitFor({ state: 'visible', timeout: 10000 });
  const missingArticleAlt = await page.locator('img').evaluateAll(images => images.filter(image => !image.hasAttribute('alt')).map(image => image.currentSrc || image.src));
  if (missingArticleAlt.length) throw new Error('Blog article images missing alt attributes: ' + missingArticleAlt.join(', '));
  const blogDescription = await page.locator('meta[name="description"]').getAttribute('content');
  if (!blogDescription || blogDescription.length > 165) {
    throw new Error('Blog article meta description is missing or exceeds the 165-character limit.');
  }

  const videoGuideResponse = await page.goto(`${baseURL}/blog/video-editing-footage-preparation-checklist`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!videoGuideResponse || videoGuideResponse.status() >= 400) {
    throw new Error(`New video-editing guide returned HTTP ${videoGuideResponse?.status() ?? 'no response'}`);
  }
  await page.locator('.blog-detail h1').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.title.includes('ভিডিও এডিটিংয়ের ফুটেজ প্রস্তুতি: চেকলিস্ট'));
  if (await page.locator('html').getAttribute('lang') !== 'bn-BD') {
    throw new Error('Bengali blog article must set the document language to bn-BD.');
  }
  const videoGuideGraph = JSON.parse(await page.locator('#stationery-seo-jsonld').textContent())['@graph'] || [];
  if (!videoGuideGraph.some(node => node['@type'] === 'BlogPosting')) {
    throw new Error('New video-editing guide is missing BlogPosting structured data.');
  }
  await page.locator('.blog-article-body a[href="/services/video-editing-creation"]').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.blog-article-body a[href="/creative-services"]').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.blog-article-body a[href="/contact"]').first().waitFor({ state: 'visible', timeout: 10000 });

  const internalLinkChecks = [
    ['personal-vs-shared-digital-subscription-guide', ['/digital-subscriptions', '/help']],
    ['smm-panel-bangladesh-order-checklist', ['/smm', '/meta-services']],
    ['nid-correction-preparation-checklist', ['/services/nid', '/document-services']],
    ['design-video-editing-order-brief-checklist', ['/services/graphic-design', '/services/video-editing-creation']],
    ['online-service-checklist', ['/services', '/help']],
    ['facebook-page-growth-quality', ['/meta-services', '/services/social-media-page-management']]
  ];
  for (const [slug, links] of internalLinkChecks) {
    const response = await page.goto(`${baseURL}/blog/${slug}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response || response.status() >= 400) throw new Error(`Internal-link article ${slug} returned HTTP ${response?.status() ?? 'no response'}`);
    await page.locator('.blog-detail h1').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.blog-article-body').waitFor({ state: 'visible', timeout: 15000 });
    for (const href of links) {
    const articleLink = page.locator(`.blog-article-body a[href="${href}"]`);
    if (await articleLink.count() < 1) throw new Error('Blog article ' + slug + ' is missing internal link: ' + href);
    await articleLink.first().waitFor({ state: 'visible', timeout: 10000 });
  }
  }

  const nidSourceResponse = await page.goto(`${baseURL}/blog/nid-correction-preparation-checklist`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!nidSourceResponse || nidSourceResponse.status() >= 400) throw new Error('NID guide with official sources did not load.');
  const officialNidLink = page.locator('.blog-article-body a[href^="https://services.nidw.gov.bd/"]').first();
  await officialNidLink.waitFor({ state: 'visible', timeout: 10000 });
  if (await officialNidLink.getAttribute('target') !== '_blank') throw new Error('External official-source link must open in a new tab.');
  const externalRel = await officialNidLink.getAttribute('rel') || '';
  if (!externalRel.includes('noopener') || !externalRel.includes('noreferrer') || !externalRel.includes('nofollow')) {
    throw new Error('External source links must use safe rel attributes.');
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
  await page.waitForFunction(() => document.title.includes('Birth Certificate'));
  const documentCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  if (documentCanonical !== `${baseURL}/services/birth-certificate`) {
    throw new Error('Document service detail canonical URL is incorrect: ' + documentCanonical);
  }
  const documentDescription = await page.locator('meta[name="description"]').getAttribute('content');
  if (!documentDescription || documentDescription.length > 165) {
    throw new Error('Document service detail meta description is missing or too long.');
  }
  const documentGraph = JSON.parse(await page.locator('#stationery-seo-jsonld').textContent())['@graph'] || [];
  if (!documentGraph.some(node => node['@type'] === 'Service' && node.name && node.areaServed?.name === 'Bangladesh')) {
    throw new Error('Document service detail is missing its Service structured data for Bangladesh.');
  }
  if (!documentGraph.some(node => node['@type'] === 'BreadcrumbList')) {
    throw new Error('Document service detail is missing BreadcrumbList structured data.');
  }
  const missingDocumentAlt = await page.locator('img').evaluateAll(images => images.filter(image => !image.hasAttribute('alt')).map(image => image.currentSrc || image.src));
  if (missingDocumentAlt.length) throw new Error('Document service detail images missing alt attributes: ' + missingDocumentAlt.join(', '));

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

  // Simple greetings should be answered locally without waiting for Gemini.
  const compose = chat.locator('.sdc-chat-compose input');
  let greetingNetworkCalls = 0;
  const countGreetingCall = (request) => { if (request.url().includes('/functions/v1/sdc-assistant')) greetingNetworkCalls += 1; };
  page.on('request', countGreetingCall);
  const greetingStarted = Date.now();
  await compose.fill('Hello');
  await compose.press('Enter');
  await chat.getByText(/Hello! 😊 Welcome to Stationery Dot Com/i).last().waitFor({ state: 'visible', timeout: 1500 });
  const greetingElapsed = Date.now() - greetingStarted;
  page.off('request', countGreetingCall);
  if (greetingElapsed > 1000 || greetingNetworkCalls !== 0) {
    throw new Error(`Client greeting should be instant and must not call Gemini; elapsed=${greetingElapsed}ms, requests=${greetingNetworkCalls}`);
  }

  // Verify the customer-facing chat renders streamed AI text before the full response completes.
  let streamResponseObserved = false;
  const observeChatStream = response => {
    if (response.url().includes('/functions/v1/sdc-assistant') && (response.headers()['content-type'] || '').includes('text/event-stream')) {
      streamResponseObserved = true;
    }
  };
  page.on('response', observeChatStream);
  await compose.fill('What services do you offer? Reply briefly.');
  await compose.press('Enter');
  await page.waitForFunction(() => {
    const bubbles = document.querySelectorAll('[aria-label="SDC Assistant chat"] .sdc-chat-row.is-assistant .sdc-chat-bubble');
    return bubbles.length > 0 && (bubbles[bubbles.length - 1].textContent || '').trim().length > 8;
  }, null, { timeout: 15000 });
  await page.waitForFunction(() => {
    const input = document.querySelector('[aria-label="SDC Assistant chat"] .sdc-chat-compose input');
    return input && !input.disabled;
  }, null, { timeout: 25000 });
  const streamedReply = await chat.locator('.sdc-chat-row.is-assistant .sdc-chat-bubble').last().innerText();
  page.off('response', observeChatStream);
  if (!streamResponseObserved || streamedReply.length < 15 || /trouble connecting/i.test(streamedReply)) {
    throw new Error(`Chat UI did not render a valid streamed AI response: stream=${streamResponseObserved}, reply=${streamedReply.slice(0, 120)}`);
  }

  // Outcome-based SMM request should enter the same in-chat order journey,
  // even when the customer does not type the exact catalogue title.
  await compose.fill('Instagram followers chai');
  await compose.press('Enter');
  const smmOrderFlow = chat.locator('.sdc-convo-card');
  await smmOrderFlow.waitFor({ state: 'visible', timeout: 15000 });
  const smmOrderText = await smmOrderFlow.innerText();
  if (!/followers|sign in|option/i.test(smmOrderText)) {
    throw new Error('Natural SMM request did not resolve to a service/order flow: ' + smmOrderText.slice(0, 180));
  }

  // Clear the unfinished guest SMM request before exercising the standard order flow.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  const freshLauncher = page.getByRole('button', { name: 'Chat with SDC Assistant' });
  await freshLauncher.waitFor({ state: 'visible', timeout: 15000 });
  await freshLauncher.click();
  const freshChat = page.locator('[aria-label="SDC Assistant chat"]');
  await freshChat.waitFor({ state: 'visible', timeout: 10000 });
  const freshCompose = freshChat.locator('.sdc-chat-compose input');

  // The order flow starts when the visitor types a natural request; do not submit an order.
  await compose.fill('ORDER KORTE CHAI');
  await compose.press('Enter');

  const orderFlow = freshChat.locator('.sdc-convo-card');
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
