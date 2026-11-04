import type { Page } from 'playwright';
import type { MeetingPlatform, PlatformAdapter, MeetingState, ParticipantEventPayload, ChatMessagePayload } from '../types.js';
import { ZoomAdapter } from './zoom.js';
import { TeamsAdapter } from './teams.js';

export { ZoomAdapter } from './zoom.js';
export { TeamsAdapter } from './teams.js';

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

    // 3. Ensure camera is muted without blindly toggling it on
    try {
      const camBtn = page.locator('button[aria-label*="camera" i]').first();
      if (await camBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        const aria = (await camBtn.getAttribute('aria-label').catch(() => '')) || '';
        if (/turn off/i.test(aria)) {
          await camBtn.click().catch(() => {});
        }
      }
    } catch {}

    // 4. Ensure microphone is muted on join
    try {
      const micBtn = page.locator('button[aria-label*="microphone" i]').first();
      if (await micBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        const aria = (await micBtn.getAttribute('aria-label').catch(() => '')) || '';
        if (/turn off/i.test(aria)) {
          await micBtn.click().catch(() => {});
        }
      }
    } catch {}
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

      // 2. Waiting Lobby Check
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

      // 3. In-Meeting Check
      for (const sel of GOOGLE_IN_CALL_INDICATORS) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          onStateChange('IN_MEETING', 'Admitted to Google Meet call');
          return true;
        }
      }

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
          // Roster rows in People panel
          document.querySelectorAll('[role="listitem"]').forEach((r) => {
            const nameEl = r.querySelector('span[class*="name" i], div[class*="name" i], span');
            const txt = (nameEl?.textContent || r.textContent || '')
              .replace(/\(You\)/gi, '')
              .replace(/\(Meeting host\)/gi, '')
              .trim();
            if (txt && txt.length >= 2 && !txt.toLowerCase().includes('people')) {
              found.add(txt);
            }
          });

          // Video tiles
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
          // Look for chat message blocks in Google Meet
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

  const zoom = new ZoomAdapter();
  if (zoom.matches(url)) return zoom;

  const teams = new TeamsAdapter();
  if (teams.matches(url)) return teams;

  return new GenericMeetingAdapter();
}
