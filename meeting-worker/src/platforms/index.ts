import type { Page } from 'playwright';
import type { MeetingPlatform, PlatformAdapter, MeetingState } from '../types.js';

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
    // 1. Fast non-blocking check for "Rejoin" if reused URL
    try {
      const rejoinBtn = page.locator('button:has-text("Rejoin")').first();
      if (await rejoinBtn.isVisible({ timeout: 200 }).catch(() => false)) {
        await rejoinBtn.click({ timeout: 1000 }).catch(() => {});
      }
    } catch {}

    // 2. Instant hardware mute shortcuts for Google Meet
    try {
      await page.keyboard.press('Control+e');
      await page.keyboard.press('Control+d');
    } catch {}

    // 3. Fast non-blocking check for guest identity input
    try {
      const nameInput = page
        .locator('input[aria-label="Your name"], input[jsname][type="text"], input[type="text"]:not([aria-hidden="true"])')
        .first();
      if (await nameInput.isVisible({ timeout: 300 }).catch(() => false)) {
        await nameInput.fill(botName);
      }
    } catch {}
  }

  async submitJoinRequest(page: Page): Promise<void> {
    // Fast check if already admitted
    const inMeeting = await page
      .locator('button[aria-label*="Leave call" i], button[aria-label*="Leave meeting" i], [data-participant-id]')
      .first()
      .isVisible({ timeout: 100 })
      .catch(() => false);
    if (inMeeting) return;

    // Unified reactive locator resolving immediately the moment ANY valid CTA appears
    const primaryCta = page
      .locator(
        'button:has-text("Ask to join"), button:has-text("Join now"), button:has-text("Rejoin"), button:has-text("Switch here"), button:has-text("Join")'
      )
      .first();

    await primaryCta.waitFor({ state: 'visible', timeout: 15000 });
    await primaryCta.click({ timeout: 2000 });
  }

  async waitForAdmission(
    page: Page,
    timeoutMs: number,
    onStateChange: (state: MeetingState, message: string) => void
  ): Promise<boolean> {
    const GOOGLE_ADMISSION_INDICATORS = [
      'button[aria-label*="Leave call" i]',
      'button[aria-label*="Leave meeting" i]',
      '[data-participant-id]',
      '[role="toolbar"]',
    ];
    const GOOGLE_WAITING_INDICATORS = [
      'text=Asking to be let in',
      'text=Waiting for the host',
      'text=Someone will let you in',
      'text=You’ll join the call when someone lets you in',
    ];
    const GOOGLE_REJECTION_INDICATORS = [
      'text=denied your request',
      'text=Your request to join was denied',
      'text=weren\'t allowed to join',
    ];

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (page.isClosed()) return false;

      for (const sel of GOOGLE_ADMISSION_INDICATORS) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          onStateChange('IN_MEETING', 'Admitted to Google Meet call');
          return true;
        }
      }

      for (const sel of GOOGLE_WAITING_INDICATORS) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          onStateChange('WAITING_FOR_ADMISSION', 'Waiting for host to admit bot');
          break;
        }
      }

      for (const sel of GOOGLE_REJECTION_INDICATORS) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          onStateChange('ADMISSION_DENIED', 'Host denied entry to Google Meet');
          return false;
        }
      }

      await page.waitForTimeout(2000);
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

  const zoom = new ZoomAdapter();
  if (zoom.matches(url)) return zoom;

  return new GenericMeetingAdapter();
}
