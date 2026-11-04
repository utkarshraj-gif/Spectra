import type { Page } from 'playwright';
import type { MeetingPlatform, PlatformAdapter, MeetingState } from '../types.js';
import { TeamsAdapter } from './teams.js';
export { TeamsAdapter } from './teams.js';

export async function ensureMicrophoneMuted(page: Page): Promise<boolean> {
  try {
    const micSelectors = [
      'button[aria-label*="Turn off microphone" i]',
      'div[role="button"][aria-label*="Turn off microphone" i]',
      '[data-is-muted="false"][aria-label*="mic" i]',
      'button[aria-label*="mute microphone" i]',
      'div[role="button"][aria-label*="mute microphone" i]',
      'button[aria-label*="microphone" i]',
      'div[role="button"][aria-label*="microphone" i]',
      'button[aria-label*="mic" i]',
      'div[role="button"][aria-label*="mic" i]',
      '[data-is-muted="false"]',
    ];

    for (const sel of micSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const aria = (await btn.getAttribute('aria-label').catch(() => '')) || '';
        const isMuted = await btn.getAttribute('data-is-muted').catch(() => '');
        if (/turn off/i.test(aria) || isMuted === 'false') {
          console.log(`[Platform] Muting microphone via ${sel} (${aria})`);
          await btn.click().catch(() => {});
          await page.waitForTimeout(200);
          return true;
        }
      }
    }

    // Google Meet keyboard shortcut fallback (Control+d)
    const anyMic = page.locator('button[aria-label*="mic" i], div[role="button"][aria-label*="mic" i]').first();
    if (await anyMic.isVisible({ timeout: 400 }).catch(() => false)) {
      const aria = (await anyMic.getAttribute('aria-label').catch(() => '')) || '';
      if (/turn off/i.test(aria)) {
        console.log('[Platform] Muting microphone via Control+d shortcut');
        await page.keyboard.press('Control+d').catch(() => {});
        await page.waitForTimeout(200);
        return true;
      }
    }
  } catch (err) {
    console.warn('[Platform] Error ensuring microphone muted:', err);
  }
  return false;
}

export async function ensureCameraMuted(page: Page): Promise<boolean> {
  try {
    const camSelectors = [
      'button[aria-label*="Turn off camera" i]',
      'div[role="button"][aria-label*="Turn off camera" i]',
      'button[aria-label*="camera" i]',
      'div[role="button"][aria-label*="camera" i]',
      '[data-is-muted="false"][aria-label*="camera" i]',
    ];

    for (const sel of camSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const aria = (await btn.getAttribute('aria-label').catch(() => '')) || '';
        if (/turn off/i.test(aria)) {
          console.log(`[Platform] Turning off camera via ${sel} (${aria})`);
          await btn.click().catch(() => {});
          await page.waitForTimeout(200);
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('[Platform] Error ensuring camera muted:', err);
  }
  return false;
}

export class GoogleMeetAdapter implements PlatformAdapter {
  readonly platform: MeetingPlatform = 'google_meet';

  matches(url: string): boolean {
    return url.includes('meet.google.com') || /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(url.trim());
  }

  normalizeUrl(rawUrl: string): string {
    let cleaned = rawUrl.trim();
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = 'https://' + cleaned;
    }
    try {
      const parsed = new URL(cleaned);
      const segments = parsed.pathname.split('/').filter(Boolean);
      const code = segments[segments.length - 1] || '';
      if (code) {
        return `https://meet.google.com/${code}?hl=en`;
      }
    } catch {
      // fallback
    }
    return cleaned.includes('?') ? `${cleaned}&hl=en` : `${cleaned}?hl=en`;
  }

  async configurePreJoin(page: Page, botName: string): Promise<void> {
    // 1. Fast check for "Rejoin" if meeting was previously joined with same URL
    try {
      const rejoinBtn = page.locator('button:has-text("Rejoin")').first();
      if (await rejoinBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await rejoinBtn.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(400);
      }
    } catch {}

    // 2. Proactively fill bot identity into guest name input if present
    try {
      const nameInput = page
        .locator('input[aria-label*="name" i], input[jsname][type="text"], input[type="text"]:not([aria-hidden="true"])')
        .first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const val = await nameInput.inputValue().catch(() => '');
        if (!val || val.trim() !== botName) {
          await nameInput.fill(botName);
          await page.keyboard.press('Enter').catch(() => {});
        }
      }
    } catch {}

    // 3. Ensure camera is muted
    await ensureCameraMuted(page);

    // 4. Ensure microphone is muted on join (always off)
    await ensureMicrophoneMuted(page);
  }

  async submitJoinRequest(page: Page, botName = 'Spectra'): Promise<void> {
    // Fast check if already admitted
    const inMeeting = await page
      .locator('button[aria-label*="Leave call" i], button[aria-label*="Leave meeting" i], [data-participant-id]')
      .first()
      .isVisible({ timeout: 100 })
      .catch(() => false);
    if (inMeeting) return;

    // Check if name input needs filling before clicking join CTA
    const nameInput = page
      .locator('input[aria-label*="name" i], input[type="text"]:not([aria-hidden="true"])')
      .first();
    if (await nameInput.isVisible({ timeout: 500 }).catch(() => false)) {
      const val = await nameInput.inputValue().catch(() => '');
      if (!val || val.trim().length === 0) {
        await nameInput.fill(botName);
        await page.keyboard.press('Enter').catch(() => {});
      }
    }

    // Unified reactive locator resolving immediately the moment ANY valid CTA appears
    const primaryCta = page
      .locator(
        'button:has-text("Ask to join"), button:has-text("Join now"), button:has-text("Rejoin"), button:has-text("Switch here"), button:has-text("Join")'
      )
      .first();

    await primaryCta.waitFor({ state: 'visible', timeout: 15000 });

    const isDisabled = await primaryCta.evaluate((el: HTMLElement) => {
      const btn = el as HTMLButtonElement;
      return btn.disabled || btn.getAttribute('aria-disabled') === 'true';
    }).catch(() => false);

    if (isDisabled) {
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill(botName);
        await page.waitForTimeout(200);
      }
    }

    // Ensure microphone is definitely muted immediately prior to clicking Join
    await ensureMicrophoneMuted(page).catch(() => {});

    await primaryCta.click({ timeout: 2000 });
  }

  async waitForAdmission(
    page: Page,
    timeoutMs: number,
    onStateChange: (state: MeetingState, message: string) => void
  ): Promise<boolean> {
    const GOOGLE_IN_CALL_INDICATORS = [
      'button[aria-label*="Leave call" i]',
      'button[aria-label*="Leave meeting" i]',
      'button[aria-label*="Raise hand" i]',
      'button[aria-label*="Turn on captions" i]',
    ];
    const GOOGLE_WAITING_INDICATORS = [
      'text=/Asking to be let in/i',
      'text=/Waiting for the host/i',
      'text=/Someone will let you in/i',
      'text=/join the call when someone lets you in/i',
      'text=/Asking to join/i',
    ];
    const GOOGLE_REJECTION_INDICATORS = [
      'text=/denied your request/i',
      'text=/request to join was denied/i',
      'text=/weren\'t allowed to join/i',
      'text=/You can\'t join this call/i',
    ];

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (page.isClosed()) return false;

      // 1. Explicit Rejection Check
      for (const sel of GOOGLE_REJECTION_INDICATORS) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          onStateChange('ADMISSION_DENIED', 'Host denied entry to Google Meet');
          return false;
        }
      }

      // 2. Waiting Lobby Check (Must take precedence over ambiguous UI elements)
      let isWaiting = false;
      for (const sel of GOOGLE_WAITING_INDICATORS) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          isWaiting = true;
          onStateChange('WAITING_FOR_ADMISSION', 'Waiting for host to admit bot');
          break;
        }
      }

      if (isWaiting) {
        await page.waitForTimeout(500);
        continue;
      }

      // 3. In-Meeting Check (Only valid if NOT in waiting lobby)
      for (const sel of GOOGLE_IN_CALL_INDICATORS) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          onStateChange('IN_MEETING', 'Admitted to Google Meet call');
          return true;
        }
      }

      // Fast reactive tick
      await page.waitForTimeout(300);
    }
    return false;
  }

  async leave(page: Page): Promise<void> {
    try {
      const leaveButton = page.locator('button[aria-label*="Leave call" i], button[aria-label*="Leave meeting" i]').first();
      if (await leaveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await leaveButton.click({ timeout: 2000 }).catch(() => {});
      }
    } catch {}
  }
}

export class ZoomAdapter implements PlatformAdapter {
  readonly platform: MeetingPlatform = 'zoom';

  matches(url: string): boolean {
    return url.includes('zoom.us');
  }

  normalizeUrl(rawUrl: string): string {
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    // Web client join fallback
    if (!url.includes('/wc/') && url.includes('/j/')) {
      url = url.replace('/j/', '/wc/join/');
    }
    return url;
  }

  async configurePreJoin(page: Page, botName: string): Promise<void> {
    try {
      const nameInput = page.locator('input#inputname, input[name="inputname"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.fill(botName);
      }
    } catch {}
  }

  async submitJoinRequest(page: Page): Promise<void> {
    try {
      const joinBtn = page.locator('button#joinBtn, button:has-text("Join")').first();
      if (await joinBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await joinBtn.click();
      }
    } catch {}
  }

  async waitForAdmission(
    page: Page,
    timeoutMs: number,
    onStateChange: (state: MeetingState, message: string) => void
  ): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (page.isClosed()) return false;

      const inMeeting = await page.locator('button[aria-label*="Leave" i], .footer__leave-btn').first().isVisible().catch(() => false);
      if (inMeeting) {
        onStateChange('IN_MEETING', 'Admitted to Zoom call');
        return true;
      }
      await page.waitForTimeout(2000);
    }
    return false;
  }

  async leave(page: Page): Promise<void> {
    try {
      const leaveBtn = page.locator('button[aria-label*="Leave" i], .footer__leave-btn').first();
      if (await leaveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await leaveBtn.click().catch(() => {});
      }
    } catch {}
  }
}

export class GenericMeetingAdapter implements PlatformAdapter {
  readonly platform: MeetingPlatform = 'generic';

  matches(_url: string): boolean {
    return true;
  }

  normalizeUrl(rawUrl: string): string {
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url;
  }

  async configurePreJoin(page: Page, botName: string): Promise<void> {
    try {
      const nameInput = page.locator('input[type="text"][placeholder*="name" i], input[aria-label*="name" i]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill(botName);
      }
    } catch {}
  }

  async submitJoinRequest(page: Page): Promise<void> {
    try {
      const joinBtn = page.locator('button:has-text("Join"), button:has-text("Enter")').first();
      if (await joinBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await joinBtn.click();
      }
    } catch {}
  }

  async waitForAdmission(
    page: Page,
    timeoutMs: number,
    onStateChange: (state: MeetingState, message: string) => void
  ): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (page.isClosed()) return false;
      const leaveBtn = page.locator('button:has-text("Leave"), button[aria-label*="Leave" i]').first();
      if (await leaveBtn.isVisible().catch(() => false)) {
        onStateChange('IN_MEETING', 'Admitted to meeting');
        return true;
      }
      await page.waitForTimeout(2000);
    }
    return false;
  }

  async leave(page: Page): Promise<void> {
    try {
      const leaveBtn = page.locator('button:has-text("Leave"), button[aria-label*="Leave" i]').first();
      if (await leaveBtn.isVisible().catch(() => false)) {
        await leaveBtn.click().catch(() => {});
      }
    } catch {}
  }
}

export function getAdapterForUrl(url: string): PlatformAdapter {
  const google = new GoogleMeetAdapter();
  if (google.matches(url)) return google;

  const teams = new TeamsAdapter();
  if (teams.matches(url)) return teams;

  const zoom = new ZoomAdapter();
  if (zoom.matches(url)) return zoom;

  return new GenericMeetingAdapter();
}
