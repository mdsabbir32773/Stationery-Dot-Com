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

  console.log('PASS: custom domain, chat launcher, Gemini service matching, package duration selection, payment QR/screenshot upload, and guest deposit sign-in gate.');
} finally {
  await browser.close();
}
