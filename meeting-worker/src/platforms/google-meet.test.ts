import assert from 'assert';
import { chromium } from 'playwright';
import { GoogleMeetAdapter } from './index.js';
import { getAdapterForUrl } from './index.js';
import type { MeetingState } from '../types.js';

async function runTests() {
  console.log('[TestGoogleMeetAdapter] Starting Google Meet Adapter verification suite...');

  const adapter = new GoogleMeetAdapter();

  // Test 1: URL Matching
  console.log('Test 1: URL matching and resolution');
  const validUrls = [
    'https://meet.google.com/abc-defg-hij',
    'https://meet.google.com/uke-kavu-bsx?hl=en',
    'meet.google.com/xyz-uvwx-rst',
    'abc-defg-hij',
  ];

  for (const url of validUrls) {
    assert.strictEqual(adapter.matches(url), true, `Should match Google Meet URL: ${url}`);
    const resolved = getAdapterForUrl(url);
    assert.strictEqual(resolved.platform, 'google_meet', `getAdapterForUrl should resolve to 'google_meet' for ${url}`);
  }

  const nonGoogleUrls = [
    'https://teams.microsoft.com/l/meetup-join/123',
    'https://zoom.us/j/1234567890',
    'https://example.com/conference',
  ];

  for (const url of nonGoogleUrls) {
    assert.strictEqual(adapter.matches(url), false, `Should not match non-Google URL: ${url}`);
  }
  console.log('  ✓ URL matching verified');

  // Test 2: URL Normalization
  console.log('Test 2: URL normalization');
  assert.strictEqual(
    adapter.normalizeUrl('meet.google.com/abc-defg-hij'),
    'https://meet.google.com/abc-defg-hij?hl=en'
  );
  assert.strictEqual(
    adapter.normalizeUrl('abc-defg-hij'),
    'https://meet.google.com/abc-defg-hij?hl=en'
  );
  console.log('  ✓ URL normalization verified');

  // Test 3: Playwright DOM Execution Simulation
  console.log('Test 3: Browser DOM execution (modal dismissal, guest name, join submission)');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 3a. Pre-Join DOM: Guest name input, modal dismissal, Ask to join
    const prejoinHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Google Meet</title></head>
        <body>
          <button>Continue without microphone and camera</button>
          <input type="text" aria-label="Your name" value="" />
          <button aria-label="Turn off microphone">Mic</button>
          <button aria-label="Turn off camera">Camera</button>
          <button>Ask to join</button>
        </body>
      </html>
    `;
    await page.setContent(prejoinHtml);

    let modalClicked = false;
    let joinClicked = false;

    await page.exposeFunction('__mockModalClick', () => { modalClicked = true; });
    await page.exposeFunction('__mockJoinClick', () => { joinClicked = true; });

    await page.evaluate(() => {
      Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Continue without'))
        ?.addEventListener('click', () => { (window as any).__mockModalClick(); });
      Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Ask to join'))
        ?.addEventListener('click', () => { (window as any).__mockJoinClick(); });
    });

    await adapter.configurePreJoin(page, 'Spectra Bot');
    await adapter.submitJoinRequest(page, 'Spectra Bot');

    assert.strictEqual(modalClicked, true, 'Adapter should dismiss Continue without modal');
    assert.strictEqual(joinClicked, true, 'Adapter should click Ask to join CTA');

    const enteredName = await page.locator('input[aria-label="Your name"]').inputValue();
    assert.strictEqual(enteredName, 'Spectra Bot', 'Adapter should fill guest bot name');
    console.log('  ✓ Pre-join setup & join CTA submission verified');

    // 3b. Blocked Screen Detection ("You can't join this video call")
    const blockedHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Meet</title></head>
        <body>
          <h2>You can't join this video call</h2>
          <p>No one can join a meeting unless invited or admitted by the host</p>
          <button>Return to home screen</button>
        </body>
      </html>
    `;
    await page.setContent(blockedHtml);

    let errorThrown = false;
    try {
      await adapter.submitJoinRequest(page, 'Spectra Bot');
    } catch (err: any) {
      errorThrown = true;
      assert.ok(err.message.includes("You can't join this video call"), 'Should throw informative error when blocked');
    }
    assert.strictEqual(errorThrown, true, 'Adapter should reject immediately when meeting is restricted');
    console.log('  ✓ Blocked meeting detection & descriptive rejection verified');

    // 3c. Lobby Admission and In-Call State Detection
    const inMeetingHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Meet - in call</title></head>
        <body>
          <button aria-label="Leave call">Leave call</button>
        </body>
      </html>
    `;
    await page.setContent(inMeetingHtml);

    const states: MeetingState[] = [];
    const admitted = await adapter.waitForAdmission(page, 2000, (state, msg) => {
      states.push(state);
    });

    assert.strictEqual(admitted, true, 'Should detect in-call status');
    assert.strictEqual(states.includes('IN_MEETING'), true, 'Should report IN_MEETING state');
    console.log('  ✓ In-call admission confirmation verified');

  } finally {
    await browser.close();
  }

  console.log('[TestGoogleMeetAdapter] All Google Meet verification tests passed successfully!\n');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
