import assert from 'assert';
import { chromium } from 'playwright';
import { TeamsAdapter } from './teams.js';
import { getAdapterForUrl } from './index.js';
import type { MeetingState } from '../types.js';

async function runTests() {
  console.log('[TestTeamsAdapter] Starting Microsoft Teams Adapter verification suite...');

  const adapter = new TeamsAdapter();

  // Test 1: URL Matching
  console.log('Test 1: URL matching and resolution');
  const validUrls = [
    'https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz@thread.v2/0?context=%7b%22Tid%22%3a%22123%22%7d',
    'https://teams.live.com/meet/94723948234',
    'http://teams.microsoft.com/meet/12345',
    'https://teams.cloud.microsoft/l/meetup-join/test',
  ];

  for (const url of validUrls) {
    assert.strictEqual(adapter.matches(url), true, `Should match Teams URL: ${url}`);
    const resolved = getAdapterForUrl(url);
    assert.strictEqual(resolved.platform, 'teams', `getAdapterForUrl should resolve to 'teams' for ${url}`);
  }

  const nonTeamsUrls = [
    'https://meet.google.com/abc-defg-hij',
    'https://zoom.us/j/1234567890',
    'https://example.com/conference',
  ];

  for (const url of nonTeamsUrls) {
    assert.strictEqual(adapter.matches(url), false, `Should not match non-Teams URL: ${url}`);
  }
  console.log('  ✓ URL matching verified');

  // Test 2: URL Normalization
  console.log('Test 2: URL normalization');
  assert.strictEqual(
    adapter.normalizeUrl('teams.microsoft.com/l/meetup-join/xyz'),
    'https://teams.microsoft.com/l/meetup-join/xyz'
  );
  console.log('  ✓ URL normalization verified');

  // Test 3: Playwright DOM Execution Simulation
  console.log('Test 3: Browser DOM execution (interstitial, guest name, camera/mic mute, join)');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 3a. Test Interstitial App Launcher Bypass ("Continue on this browser")
    const interstitialHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Microsoft Teams</title></head>
        <body>
          <h2>How do you want to join your Teams meeting?</h2>
          <button data-tid="joinOnWeb" id="openTeamsClientInBrowser">Continue on this browser</button>
        </body>
      </html>
    `;
    await page.setContent(interstitialHtml);

    let clickedContinue = false;
    await page.exposeFunction('__mockClickContinue', () => {
      clickedContinue = true;
    });
    await page.evaluate(() => {
      document.querySelector('[data-tid="joinOnWeb"]')?.addEventListener('click', () => {
        (window as any).__mockClickContinue();
      });
    });

    await adapter.configurePreJoin(page, 'Spectra');
    assert.strictEqual(clickedContinue, true, 'Adapter should click Continue on this browser');
    console.log('  ✓ App launcher interstitial bypass verified');

    // 3b. Test Pre-Join Lobby Setup (Guest Name, Camera Mute, Mic Mute, Join CTA)
    const lobbyHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Microsoft Teams Pre-Join</title></head>
        <body>
          <input data-tid="prejoin-display-name-input" type="text" placeholder="Type your name" value="" />
          <button data-tid="toggle-video" aria-label="Turn camera off" aria-checked="true">Camera</button>
          <button data-tid="toggle-mute" aria-label="Mute mic" aria-checked="true">Mic</button>
          <button data-tid="prejoin-join-button">Join now</button>
        </body>
      </html>
    `;
    await page.setContent(lobbyHtml);

    let cameraClicked = false;
    let micClicked = false;
    let joinClicked = false;

    await page.exposeFunction('__mockCameraClick', () => { cameraClicked = true; });
    await page.exposeFunction('__mockMicClick', () => { micClicked = true; });
    await page.exposeFunction('__mockJoinClick', () => { joinClicked = true; });

    await page.evaluate(() => {
      document.querySelector('[data-tid="toggle-video"]')?.addEventListener('click', () => {
        (window as any).__mockCameraClick();
      });
      document.querySelector('[data-tid="toggle-mute"]')?.addEventListener('click', () => {
        (window as any).__mockMicClick();
      });
      document.querySelector('[data-tid="prejoin-join-button"]')?.addEventListener('click', () => {
        (window as any).__mockJoinClick();
      });
    });

    await adapter.configurePreJoin(page, 'Spectra');

    const enteredName = await page.locator('input[data-tid="prejoin-display-name-input"]').inputValue();
    assert.strictEqual(enteredName, 'Spectra', 'Bot name should be entered into display name input');
    assert.strictEqual(cameraClicked, true, 'Camera should be toggled off');
    assert.strictEqual(micClicked, true, 'Microphone should be muted');
    console.log('  ✓ Guest name and device mute toggles verified');

    await adapter.submitJoinRequest(page);
    assert.strictEqual(joinClicked, true, 'Join now button should be clicked');
    console.log('  ✓ Join CTA submission verified');

    // 3c. Test In-Meeting Admission State Monitoring
    console.log('Test 4: In-meeting admission state transitions');
    const inMeetingHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <div data-tid="call-roster-mount"></div>
          <button data-tid="hangup-button" aria-label="Leave">Hang up</button>
        </body>
      </html>
    `;
    await page.setContent(inMeetingHtml);

    let recordedState: MeetingState | null = null;
    const admitted = await adapter.waitForAdmission(page, 3000, (state) => {
      recordedState = state;
    });

    assert.strictEqual(admitted, true, 'Should detect admission to Microsoft Teams call');
    assert.strictEqual(recordedState, 'IN_MEETING', 'State should transition to IN_MEETING');
    console.log('  ✓ In-meeting admission detection verified');

    // 3d. Test Leave Call
    let leaveClicked = false;
    await page.exposeFunction('__mockLeaveClick', () => { leaveClicked = true; });
    await page.evaluate(() => {
      document.querySelector('[data-tid="hangup-button"]')?.addEventListener('click', () => {
        (window as any).__mockLeaveClick();
      });
    });

    await adapter.leave(page);
    assert.strictEqual(leaveClicked, true, 'Should click hangup button on leave');
    console.log('  ✓ Leave call verification passed');

  } finally {
    await browser.close();
  }

  console.log('\n[TestTeamsAdapter] ALL TESTS PASSED SUCCESSFULLY! ✓');
}

runTests().catch((err) => {
  console.error('[TestTeamsAdapter] FAILED:', err);
  process.exit(1);
});
