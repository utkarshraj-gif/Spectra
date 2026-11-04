import type { Page } from 'playwright';
import type { MeetingPlatform, PlatformAdapter, MeetingState, ParticipantEventPayload, ChatMessagePayload } from '../types.js';

export class TeamsAdapter implements PlatformAdapter {
  readonly platform: MeetingPlatform = 'teams';

  matches(url: string): boolean {
    return url.includes('teams.microsoft.com') || url.includes('teams.live.com');
  }

  normalizeUrl(rawUrl: string): string {
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url;
  }

  async configurePreJoin(page: Page, botName: string): Promise<void> {
    // 1. Bypass "Open Microsoft Teams" app prompt by choosing "Continue on this browser"
    try {
      const continueWebSelectors = [
        'button[data-tid="joinOnWeb"]',
        'button:has-text("Continue on this browser")',
        'a:has-text("Continue on this browser")',
        'button:has-text("Join on the web instead")',
      ];
      for (const sel of continueWebSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 4000 }).catch(() => false)) {
          await btn.click({ timeout: 2000 }).catch(() => {});
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          break;
        }
      }
    } catch {}

    // 2. Dismiss cookie / privacy prompts
    try {
      const cookieBtn = page.locator('#banner-accept, button:has-text("Accept"), button:has-text("Got it")').first();
      if (await cookieBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await cookieBtn.click({ timeout: 1000 }).catch(() => {});
      }
    } catch {}

    // 3. Fill display name
    try {
      const nameSelectors = [
        'input[data-tid="prejoin-display-name-input"]',
        'input#username',
        'input[placeholder*="Type your name" i]',
        'input[aria-label*="name" i]',
      ];
      for (const sel of nameSelectors) {
        const input = page.locator(sel).first();
        if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
          await input.fill(botName);
          break;
        }
      }
    } catch {}

    // 4. Mute camera & microphone prior to admission
    try {
      const micBtn = page.locator('button[data-tid="toggle-mute"], button[aria-label*="mute microphone" i]').first();
      if (await micBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const ariaChecked = await micBtn.getAttribute('aria-checked').catch(() => '');
        // In Teams prejoin, aria-checked="true" means mic is ON
        if (ariaChecked === 'true') {
          await micBtn.click().catch(() => {});
        }
      }

      const camBtn = page.locator('button[data-tid="toggle-video"], button[aria-label*="turn camera off" i]').first();
      if (await camBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const ariaChecked = await camBtn.getAttribute('aria-checked').catch(() => '');
        if (ariaChecked === 'true') {
          await camBtn.click().catch(() => {});
        }
      }
    } catch {}
  }

  async submitJoinRequest(page: Page): Promise<void> {
    try {
      const joinSelectors = [
        'button[data-tid="prejoin-join-button"]',
        'button:has-text("Join now")',
        'button:has-text("Join")',
      ];
      for (const sel of joinSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await btn.click({ timeout: 2000 }).catch(() => {});
          break;
        }
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

      // 1. Check for Teams lobby / waiting room
      const lobbySelectors = [
        'div[data-tid="lobby-screen"]',
        'div:has-text("Someone in the meeting should let you in soon")',
        'div:has-text("When the meeting starts, we\'ll let people know you\'re waiting")',
        'div:has-text("Waiting for host to admit you")',
      ];
      for (const sel of lobbySelectors) {
        if (await page.locator(sel).first().isVisible({ timeout: 200 }).catch(() => false)) {
          onStateChange('WAITING_FOR_ADMISSION', 'Waiting in Teams lobby for admission');
          break;
        }
      }

      // 2. Check for in-meeting controls
      const inMeetingSelectors = [
        'button[data-tid="hangup-button"]',
        '[data-tid="call-controls"]',
        'button[aria-label*="Leave" i]',
        '#callingComposableContainer',
      ];
      for (const sel of inMeetingSelectors) {
        if (await page.locator(sel).first().isVisible({ timeout: 200 }).catch(() => false)) {
          onStateChange('IN_MEETING', 'Admitted to Teams meeting');
          return true;
        }
      }

      await page.waitForTimeout(1000);
    }

    return false;
  }

  async leave(page: Page): Promise<void> {
    try {
      const leaveSelectors = [
        'button[data-tid="hangup-button"]',
        'button[aria-label*="Leave" i]',
        'button:has-text("Leave")',
      ];
      for (const sel of leaveSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click({ timeout: 1500 }).catch(() => {});
          break;
        }
      }
    } catch {}
  }

  async setupRosterObserver(
    page: Page,
    onEvent: (type: 'JOINED' | 'LEFT', p: ParticipantEventPayload) => void
  ): Promise<void> {
    try {
      const bridgeFn = `__spectraTeamsRosterBridge_${Date.now()}`;
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
          document.querySelectorAll('[data-tid="roster-participant"], [data-tid="participant-item"]').forEach((el) => {
            const nameEl = el.querySelector('[data-tid="participant-name"], span');
            const name = (nameEl?.textContent || '').replace(/\(Guest\)/gi, '').trim();
            if (name && name.length >= 2) {
              found.add(name);
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
      const bridgeFn = `__spectraTeamsChatBridge_${Date.now()}`;
      await page.exposeFunction(bridgeFn, (sender: string, text: string) => {
        if (!text) return;
        onMessage({
          message_id: `teams_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sender: sender || 'Participant',
          text,
          timestamp_ms: Date.now(),
        });
      });

      await page.evaluate((fnName) => {
        const seenMessages = new Set<string>();

        function scanChat() {
          document.querySelectorAll('[data-tid="chat-message"], .ui-chat__item').forEach((el) => {
            const senderEl = el.querySelector('[data-tid="chat-message-author"], .ui-chat__message__author');
            const textEl = el.querySelector('[data-tid="chat-message-body"], .ui-chat__message__content');
            const sender = (senderEl?.textContent || 'Participant').trim();
            const text = (textEl?.textContent || '').trim();
            const key = `${sender}:${text}`;
            if (text && !seenMessages.has(key)) {
              seenMessages.add(key);
              (window as any)[fnName](sender, text);
            }
          });
        }

        setInterval(scanChat, 1500);
      }, bridgeFn);
    } catch {}
  }
}

