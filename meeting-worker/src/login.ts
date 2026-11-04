import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const stealth = StealthPlugin();
stealth.enabledEvasions.delete('iframe.contentWindow');
stealth.enabledEvasions.delete('media.codecs');
stealth.enabledEvasions.delete('user-agent-override');
chromium.use(stealth);

async function loginProvision() {
  console.log('\n======================================================');
  console.log(' Spectra Bot Google Account Login Provisioner');
  console.log('======================================================\n');
  console.log('Launching visible Chrome browser window...');

  const baseProfileDir = path.resolve(process.env.BOT_PROFILE_DIR || './bot-profile');
  if (!fs.existsSync(baseProfileDir)) {
    fs.mkdirSync(baseProfileDir, { recursive: true });
  }
  const storagePath = path.join(baseProfileDir, 'storage.json');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-notifications',
      '--window-size=1280,720',
      '--lang=en-US',
    ],
  });

  const contextOptions: any = {
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  };
  if (fs.existsSync(storagePath)) {
    contextOptions.storageState = storagePath;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  console.log('Navigating to Google Sign-In...');
  await page.goto('https://accounts.google.com/ServiceLogin?service=mail&continue=https://meet.google.com');

  console.log('\n>>> ACTION REQUIRED:');
  console.log('1. Log into your Google account in the opened Chrome browser window.');
  console.log('2. Once logged in, close the browser window.');
  console.log('3. Session state and cookies will be saved to `./bot-profile/storage.json`!\n');

  page.on('close', async () => {
    console.log('[Login Provisioner] Browser window closed. Capturing Google session state...');
    try {
      await context.storageState({ path: storagePath });
      console.log(`[Login Provisioner] Google session successfully saved to ${storagePath}!`);
      await browser.close();
    } catch (err) {
      console.warn('[Login Provisioner] Warning saving storage state:', err);
    }
    process.exit(0);
  });
}

loginProvision().catch((err) => {
  console.error('Error during login provision:', err);
  process.exit(1);
});
