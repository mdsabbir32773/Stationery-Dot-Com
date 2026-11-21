import { chromium } from 'playwright';

const baseURL = process.env.SDC_BASE_URL || 'https://stationerydotcom.stdc.workers.dev';
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

  const launcher = page.getByRole('button', { name: 'Chat with SDC Assistant' });
  await launcher.waitFor({ state: 'visible', timeout: 15000 });
  await launcher.click();

  const chat = page.locator('[aria-label="SDC Assistant chat"]');
  await chat.waitFor({ state: 'visible', timeout: 10000 });

  const orderAction = chat.getByRole('button', { name: /Place an order here/i });
  await orderAction.waitFor({ state: 'visible', timeout: 10000 });
  await orderAction.click();

  // Verify the secure order form opens; never submit an order in this test.
  await chat.getByText('Choose service', { exact: false }).waitFor({ state: 'visible', timeout: 10000 });

  const close = chat.locator('.sdc-action-top button');
  await close.click();

  const depositAction = chat.getByRole('button', { name: /Add wallet funds here/i });
  await depositAction.waitFor({ state: 'visible', timeout: 10000 });
  await depositAction.click();

  // Guest deposit flow must direct the customer to sign in; no deposit is submitted.
  await chat.getByText(/sign in/i).first().waitFor({ state: 'visible', timeout: 10000 });

  if (errors.length) {
    throw new Error('Browser console/page errors:\n' + errors.slice(0, 8).join('\n'));
  }

  console.log('PASS: homepage, chat launcher, order form opening, and guest deposit sign-in gate.');
} finally {
  await browser.close();
}
