import { createMeetingContext } from './browser.js';
import { GoogleMeetAdapter } from './platforms/index.js';

const url = process.argv[2];
if (!url) {
  console.error('Usage: npm --prefix meeting-worker run test:meet -- https://meet.google.com/xxx-xxxx-xxx');
  process.exitCode = 1;
} else {
  const adapter = new GoogleMeetAdapter();
  if (!adapter.matches(url)) throw new Error('Provide a Google Meet URL or meeting code.');
  const { context } = await createMeetingContext('live-meet-check');
  try {
    const page = await context.newPage();
    page.on('response', response => {
      if (response.url().includes('MeetingSpaceService/ResolveMeetingSpace')) {
        console.log(`[Meet] ResolveMeetingSpace HTTP ${response.status()}`);
      }
    });
    await page.goto(adapter.normalizeUrl(url), { waitUntil: 'domcontentloaded' });
    await adapter.configurePreJoin(page, 'Spectra Assistant (Recording)');
    await adapter.submitJoinRequest(page, 'Spectra Assistant (Recording)');
    const admitted = await adapter.waitForAdmission(page, 120_000, (state, message) => console.log(`[Meet] ${state}: ${message}`));
    if (!admitted) throw new Error('Bot was denied admission or the host did not admit it within two minutes.');
    await page.getByRole('button', { name: /leave call|leave meeting|end call/i }).first()
      .waitFor({ state: 'visible', timeout: 10_000 });
    console.log('[Meet] Verified: bot admitted to the meeting.');
    await adapter.leave(page);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await context.browser()?.close();
  }
}
