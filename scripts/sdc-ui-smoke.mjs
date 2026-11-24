import { chromium } from 'playwright';

const baseURL = process.env.SDC_BASE_URL || 'https://stationerydotcom.me';
const browser = await chromium.launch({ headless: true });
const errors = [];

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

  const subscriptionResponse = await page.goto(`${baseURL}/digital-subscriptions`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!subscriptionResponse || subscriptionResponse.status() >= 400) {
    throw new Error(`Digital subscriptions page returned HTTP ${subscriptionResponse?.status() ?? 'no response'}`);
  }
  await page.getByRole('heading', { name: 'Digital Subscriptions in Bangladesh' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.title.includes('Digital Subscriptions Bangladesh'));

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
  await page.waitForFunction(() => document.title.includes('Graphic Design & Video Editing Bangladesh'));

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

  console.log('PASS: branded homepage schema, digital subscriptions, document, Meta and creative services landing pages, private-route noindex, canonical host redirects, contextual service-to-category links, SMM page and WELCOME5 offer, chat launcher, Gemini service matching, package duration selection, payment QR/screenshot upload, and guest deposit sign-in gate.');
} finally {
  await browser.close();
}
