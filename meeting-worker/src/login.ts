import { createMeetingContext } from './browser.js';

async function loginProvision() {
  console.log('\n======================================================');
  console.log(' Spectra Bot Google Account Login Provisioner');
  console.log('======================================================\n');
  console.log('Launching Chrome with persistent profile directory...');

  // Force headed mode for login
  process.env.HEADLESS = 'false';

  const { context, profileDir } = await createMeetingContext('login-session');
  const page = context.pages()[0] || (await context.newPage());

  console.log(`Persistent Profile Directory: ${profileDir}`);
  console.log('Navigating to Google Sign-In...');

  await page.goto('https://accounts.google.com/ServiceLogin?service=mail&continue=https://meet.google.com');

  console.log('\n>>> ACTION REQUIRED:');
  console.log('1. Apne browser window me kisi bhi Google account se login kar lijiye.');
  console.log('2. Login complete hone ke baad browser window band kar dijiye.');
  console.log('3. Session cookies `./bot-profile` me permanently save ho jayengi!\n');

  page.on('close', async () => {
    console.log('[Login Provisioner] Browser closed. Google session saved successfully!');
    try {
      await context.close();
    } catch {}
    process.exit(0);
  });
}

loginProvision().catch((err) => {
  console.error('Error during login provision:', err);
  process.exit(1);
});
