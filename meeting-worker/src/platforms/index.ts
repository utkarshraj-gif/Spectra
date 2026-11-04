import type { Page } from 'playwright';
import type { MeetingPlatform, PlatformAdapter, MeetingState, ParticipantEventPayload, ChatMessagePayload } from '../types.js';
import { ZoomAdapter } from './zoom.js';
import { TeamsAdapter } from './teams.js';

export { ZoomAdapter } from './zoom.js';
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
      'button[aria-label*="camera" i]:not([aria-label*="Turn on camera" i])',
      'button:has-text("Camera")',
      'button[data-tid="call-control-video"]',
      'div[role="button"][aria-label*="camera" i]',
      '[data-is-muted="false"][aria-label*="camera" i]',
    ];

    for (const sel of camSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        const aria = (await btn.getAttribute('aria-label').catch(() => '')) || '';
        const checked = await btn.getAttribute('aria-checked').catch(() => '');
        if (/turn off/i.test(aria) || checked === 'true' || /camera/i.test(aria)) {
          console.log(`[Platform] Turning off camera via ${sel} (${aria})`);
          await btn.click().catch(() => {});
          await page.waitForTimeout(200);
          return true;
        }
      }
    }

    // Teams shortcut Control+Shift+O, Meet shortcut Control+e
    await page.keyboard.press('Control+Shift+O').catch(() => {});
    await page.keyboard.press('Control+e').catch(() => {});
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
    const codeMatch = cleaned.match(/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
    if (codeMatch) {
      return `https://meet.google.com/${codeMatch[1].toLowerCase()}?hl=en`;
    }
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = 'https://' + cleaned;
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
    // 1. Fast check if already admitted
    const inMeeting = await page
      .locator('button[aria-label*="Leave call" i], button[aria-label*="Leave meeting" i], [data-participant-id]')
      .first()
      .isVisible({ timeout: 100 })
      .catch(() => false);
    if (inMeeting) return;

    // 2. Dismiss media warning modal if present ("Continue without microphone and camera")
    try {
      const modalBtn = page.locator('button:has-text("Continue without"), [role="button"]:has-text("Continue without")').first();
      if (await modalBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await modalBtn.click().catch(() => {});
        await page.waitForTimeout(300);
      }
    } catch {}

    // 3. Check for immediate meeting restriction / ejection screen
    const bodyText = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
    if (/you can't join this (video )?call|no one can join a meeting unless invited|this meeting has already ended/i.test(bodyText)) {
      throw new Error(
        "Google Meet rejected join request: Meeting access is restricted ('You can't join this video call'). The meeting host must set Meeting Access to 'Open' in Google Meet Host Controls, or the bot must be signed into an authorized Google account."
      );
    }

    // 4. Check if name input needs filling before clicking join CTA
    const nameInput = page
      .locator('input[aria-label*="name" i], input[type="text"]:not([aria-hidden="true"])')
      .first();
    if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      const val = await nameInput.inputValue().catch(() => '');
      if (!val || val.trim().length === 0) {
        await nameInput.fill(botName);
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(300);
      }
    }

    // 5. Try finding and clicking visible CTA button
    const JOIN_SELECTORS = [
      'button:has-text("Ask to join")',
      'button:has-text("Join now")',
      'button:has-text("Rejoin")',
      'button:has-text("Switch here")',
      'button:has-text("Join")',
    ];

    for (const sel of JOIN_SELECTORS) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 600 }).catch(() => false)) {
        const isDisabled = await btn.evaluate((el: HTMLElement) => {
          const b = el as HTMLButtonElement;
          return b.disabled || b.getAttribute('aria-disabled') === 'true';
        }).catch(() => false);

        if (isDisabled && (await nameInput.isVisible().catch(() => false))) {
          await nameInput.fill(botName);
          await page.waitForTimeout(200);
        }

        await ensureMicrophoneMuted(page).catch(() => {});
        await btn.click({ timeout: 3000 }).catch(() => {});
        return;
      }
    }

    // 6. Check again if blocked screen appeared after attempt
    const postBodyText = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
    if (/you can't join this (video )?call|no one can join a meeting unless invited|this meeting has already ended/i.test(postBodyText)) {
      throw new Error(
        "Google Meet rejected join request: Meeting access is restricted ('You can't join this video call'). The meeting host must set Meeting Access to 'Open' in Google Meet Host Controls, or the bot must be signed into an authorized Google account."
      );
    }

    // 7. Fallback: wait up to 5s for any CTA to become visible
    const primaryCta = page
      .locator('button:has-text("Ask to join"), button:has-text("Join now"), button:has-text("Rejoin"), button:has-text("Join")')
      .first();
    await primaryCta.waitFor({ state: 'visible', timeout: 5000 });
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
      'button[aria-label*="End call" i]',
      'div[aria-label*="Leave call" i]',
      'div[aria-label*="Leave meeting" i]',
      'button[data-tooltip*="Leave call" i]',
      '[data-call-ended="false"]',
    ];

    const GOOGLE_WAITING_INDICATORS = [
      'text="Waiting to be let in"',
      'text="Asking to be let in"',
      'text="Someone will let you in shortly"',
      'text="You\'ll join the call when someone lets you in"',
      'div[aria-label*="Waiting to be let in" i]',
      'div[aria-label*="Asking to be let in" i]',
    ];

    const GOOGLE_DENIED_INDICATORS = [
      'text="You can\'t join this call"',
      'text="You were removed from the meeting"',
      'text="Someone denied your request to join"',
      'text="Your request to join was denied"',
      'text="Meeting is full"',
    ];

    const startTime = Date.now();
    let waitingReported = false;

    while (Date.now() - startTime < timeoutMs) {
      if (page.isClosed()) return false;

      // 1. Check for in-call indicators (Strict, positive confirmation)
      for (const sel of GOOGLE_IN_CALL_INDICATORS) {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 50 }).catch(() => false)) {
          onStateChange('IN_MEETING', 'Admitted to Google Meet call');
          return true;
        }
      }

      // Check for participant video tiles or people list
      const hasParticipants = await page
        .evaluate(() => {
          const tiles = document.querySelectorAll(
            'div[data-participant-id], div[data-requested-participant-id], div[data-tile-id], div[data-allocation-index]'
          );
          return tiles.length > 0;
        })
        .catch(() => false);

      if (hasParticipants) {
        onStateChange('IN_MEETING', 'Admitted to Google Meet (participant grid active)');
        return true;
      }

      // 2. Check for waiting/lobby state
      if (!waitingReported) {
        for (const sel of GOOGLE_WAITING_INDICATORS) {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 50 }).catch(() => false)) {
            onStateChange('WAITING_FOR_ADMISSION', 'Waiting in Google Meet lobby for host admission');
            waitingReported = true;
            break;
          }
        }
      }

      // 3. Check for denied/removed state
      for (const sel of GOOGLE_DENIED_INDICATORS) {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 50 }).catch(() => false)) {
          onStateChange('ADMISSION_DENIED', 'Admission to Google Meet was denied or room is full');
          return false;
        }
      }

      await page.waitForTimeout(500);
    }

    return false;
  }

  async leave(page: Page): Promise<void> {
    const leaveSelectors = [
      'button[aria-label*="Leave call" i]',
      'button[aria-label*="Leave meeting" i]',
      'button[aria-label*="End call" i]',
      'div[aria-label*="Leave call" i]',
      'button[data-tooltip*="Leave call" i]',
    ];

    for (const sel of leaveSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(500);
        return;
      }
    }
  }

  async setupRosterObserver(
    page: Page,
    onEvent: (type: 'JOINED' | 'LEFT', p: ParticipantEventPayload) => void
  ): Promise<void> {
    try {
      const bridgeFn = `__spectraGMeetRosterBridge_${Date.now()}`;
      await page.exposeFunction(bridgeFn, (type: 'JOINED' | 'LEFT', name: string) => {
        if (!name) return;
        onEvent(type, {
          participant_id: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name,
          timestamp_ms: Date.now(),
        });
      });

      await page.evaluate((fnName) => {
        const currentParticipants = new Set<string>();

        function scanParticipants() {
          const found = new Set<string>();
          document.querySelectorAll('div[data-participant-id], div[data-self-name]').forEach((t) => {
            const selfName = t.getAttribute('data-self-name');
            if (selfName && selfName.trim().length >= 2) {
              found.add(selfName.trim());
            }
          });

          for (const name of found) {
            if (!currentParticipants.has(name)) {
              currentParticipants.add(name);
              (window as any)[fnName]('JOINED', name);
            }
          }

          for (const name of currentParticipants) {
            if (!found.has(name)) {
              currentParticipants.delete(name);
              (window as any)[fnName]('LEFT', name);
            }
          }
        }

        setInterval(scanParticipants, 2000);
      }, bridgeFn);
    } catch {}
  }

  async setupChatObserver(
    page: Page,
    onMessage: (msg: ChatMessagePayload) => void
  ): Promise<void> {
    try {
      const bridgeFn = `__spectraGMeetChatBridge_${Date.now()}`;
      await page.exposeFunction(bridgeFn, (sender: string, text: string) => {
        if (!text) return;
        onMessage({
          message_id: `gmeet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sender: sender || 'Participant',
          text,
          timestamp_ms: Date.now(),
        });
      });

      await page.evaluate((fnName) => {
        const seenMessages = new Set<string>();

        function scanChat() {
          document.querySelectorAll('div[data-message-id], div[data-sender-name], div[jsname][class*="message" i]').forEach((el) => {
            const sender = el.getAttribute('data-sender-name') || el.querySelector('[class*="sender" i], span')?.textContent || 'Participant';
            const text = el.querySelector('[data-message-text], [class*="content" i], span:last-child')?.textContent || el.textContent || '';
            const key = `${sender.trim()}:${text.trim()}`;
            if (text.trim() && !seenMessages.has(key)) {
              seenMessages.add(key);
              (window as any)[fnName](sender.trim(), text.trim());
            }
          });
        }

        setInterval(scanChat, 1500);
      }, bridgeFn);
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
