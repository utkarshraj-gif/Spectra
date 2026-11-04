import path from 'path';
import { createMeetingContext } from './browser.js';

async function loginProvision() {
  console.log('\n======================================================');
  console.log(' Spectra Bot Google Account Login Provisioner');
  console.log('======================================================\n');
  console.log('Launching Chrome with persistent profile directory...');

  // Force headed mode for login
  process.env.HEADLESS = 'false';

  const { context, profileDir } = await createMeetingContext('login-session', { headless: false });
  const page = context.pages()[0] || (await context.newPage());

  console.log(`Persistent Profile Directory: ${profileDir}`);
  console.log('Navigating to Google Sign-In...');

  await page.goto('https://accounts.google.com/ServiceLogin?service=mail&continue=https://meet.google.com');

  console.log('\n>>> ACTION REQUIRED:');
  console.log('1. Log into your Google account in the opened Chrome browser window.');
  console.log('2. Once logged in, close the browser window.');
  console.log('3. Session state and cookies will be saved to `./bot-profile/storage.json`!\n');

  page.on('close', async () => {
    console.log('[Login Provisioner] Browser closed. Capturing Google session state...');
    try {
      const storagePath = path.resolve(process.env.BOT_PROFILE_DIR || './bot-profile', 'storage.json');
      await context.storageState({ path: storagePath });
      console.log(`[Login Provisioner] Google session successfully saved to ${storagePath}!`);
      await context.close();
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
