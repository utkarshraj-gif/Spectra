import type { Page } from 'playwright';
import type { MeetingPlatform, PlatformAdapter, MeetingState, ParticipantEventPayload, ChatMessagePayload } from '../types.js';

export class ZoomAdapter implements PlatformAdapter {
  readonly platform: MeetingPlatform = 'zoom';

  matches(url: string): boolean {
    return url.includes('zoom.us') || url.includes('zoomgov.com');
  }

  normalizeUrl(rawUrl: string): string {
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      const pathname = parsed.pathname;

      // Translate standard app redirect /j/{id} to modern web client /wc/join/{id}
      if (pathname.includes('/j/')) {
        const meetingId = pathname.split('/j/')[1]?.split('/')[0] || '';
        const search = parsed.search || '';
        // Route to app.zoom.us/wc/join/
        return `https://app.zoom.us/wc/join/${meetingId}${search}`;
      }

      // If already /wc/ or /wc/join/
      if (pathname.includes('/wc/')) {
        return url;
      }
    } catch {
      // Fallback regex replacement
      if (!url.includes('/wc/') && url.includes('/j/')) {
        url = url.replace('/j/', '/wc/join/');
      }
    }

    return url;
  }

  async configurePreJoin(page: Page, botName: string, passcode?: string): Promise<void> {
    // 1. Dismiss cookie/GDPR consent dialogs
    try {
      const cookieSelectors = [
        '#onetrust-accept-btn-handler',
        'button:has-text("Accept All")',
        'button:has-text("Agree")',
        'button:has-text("I Accept")',
        '#onetrust-banner-sdk button',
      ];
      for (const sel of cookieSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click({ timeout: 1000 }).catch(() => {});
          break;
        }
      }
    } catch {}

    // 2. Handle intermediate "Join from your browser" link if landed on app-launch landing page
    try {
      const webClientLink = page
        .locator('a:has-text("Join from Your Browser"), a:has-text("join from browser"), a[href*="/wc/"]')
        .first();
      if (await webClientLink.isVisible({ timeout: 1500 }).catch(() => false)) {
        await webClientLink.click({ timeout: 2000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
      }
    } catch {}

    // 3. Fill participant/bot display name
    try {
      const nameSelectors = [
        '#input-for-name',
        'input#inputname',
        'input[name="inputname"]',
        'input[placeholder*="name" i]',
        'input[aria-label*="name" i]',
      ];
      for (const sel of nameSelectors) {
        const input = page.locator(sel).first();
        if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
          await input.fill(botName);
          break;
        }
      }
    } catch {}

    // 4. Fill meeting passcode if present or required
    try {
      let pwd = passcode;
      if (!pwd) {
        // Attempt extraction from current page URL query parameters
        try {
          const currentUrl = new URL(page.url());
          pwd = currentUrl.searchParams.get('pwd') || undefined;
        } catch {}
      }

      if (pwd) {
        const pwdSelectors = [
          '#input-for-pwd',
          'input#inputpasscode',
          'input[name="password"]',
          'input[placeholder*="passcode" i]',
          'input[placeholder*="password" i]',
        ];
        for (const sel of pwdSelectors) {
          const input = page.locator(sel).first();
          if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
            await input.fill(pwd);
            break;
          }
        }
      }
    } catch {}

    // 5. Ensure camera and microphone are muted prior to joining
    try {
      // Checkbox mutes (older web client style)
      const micCheckbox = page.locator('input#checkbox-audio-off, input[type="checkbox"][aria-label*="audio" i]').first();
      if (await micCheckbox.isVisible({ timeout: 500 }).catch(() => false)) {
        const isChecked = await micCheckbox.isChecked().catch(() => false);
        if (!isChecked) await micCheckbox.check().catch(() => {});
      }

      const camCheckbox = page.locator('input#checkbox-video-off, input[type="checkbox"][aria-label*="video" i]').first();
      if (await camCheckbox.isVisible({ timeout: 500 }).catch(() => false)) {
        const isChecked = await camCheckbox.isChecked().catch(() => false);
        if (!isChecked) await camCheckbox.check().catch(() => {});
      }

      // Preview button toggles (modern web client style)
      const micBtn = page.locator('.preview-audio-control button, button[aria-label*="mute" i]').first();
      if (await micBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        const label = (await micBtn.getAttribute('aria-label').catch(() => '')) || '';
        if (/mute my microphone/i.test(label) || /turn off/i.test(label)) {
          await micBtn.click().catch(() => {});
        }
      }

      const camBtn = page.locator('.preview-video-control button, button[aria-label*="stop video" i]').first();
      if (await camBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        const label = (await camBtn.getAttribute('aria-label').catch(() => '')) || '';
        if (/stop video/i.test(label) || /turn off/i.test(label)) {
          await camBtn.click().catch(() => {});
        }
      }
    } catch {}
  }

  async submitJoinRequest(page: Page): Promise<void> {
    try {
      const joinSelectors = [
        'button.preview-join-button',
        'button#joinBtn',
        'button:has-text("Join")',
        'button[type="submit"]',
      ];
      for (const sel of joinSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
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

      // 1. Check for waiting room indicators
      const waitingSelectors = [
        '.waiting-room',
        'div:has-text("Please wait, the meeting host will let you in soon")',
        'div:has-text("Waiting for the host to start this meeting")',
        'div:has-text("The meeting host will let you in soon")',
      ];
      for (const sel of waitingSelectors) {
        if (await page.locator(sel).first().isVisible({ timeout: 200 }).catch(() => false)) {
          onStateChange('WAITING_FOR_ADMISSION', 'Waiting in Zoom lobby for host admission');
          break;
        }
      }

      // 2. Check for in-meeting indicator (toolbar / leave button)
      const inMeetingSelectors = [
        'button[aria-label*="Leave" i]',
        '.footer__leave-btn',
        'button:has-text("Leave")',
        '[data-testid="leave-button"]',
        '.meeting-client-inner',
        '#meeting-app',
      ];
      for (const sel of inMeetingSelectors) {
        if (await page.locator(sel).first().isVisible({ timeout: 200 }).catch(() => false)) {
          onStateChange('IN_MEETING', 'Admitted to Zoom meeting');

          // Once admitted: Automatically bypass "Join Audio by Computer" prompt
          await this.bypassAudioModal(page);

          // Dismiss any recording/transcription disclaimers ("Got it", "Stay in Meeting")
          await this.dismissInMeetingDisclaimers(page);

          return true;
        }
      }

      await page.waitForTimeout(1000);
    }

    return false;
  }

  private async bypassAudioModal(page: Page): Promise<void> {
    try {
      const audioModalSelectors = [
        'button:has-text("Join Audio by Computer")',
        'button.join-audio-by-computer',
        'button:has-text("Computer Audio")',
        'button[aria-label*="Join Audio" i]',
        '.join-dialog button:has-text("Join")',
      ];
      for (const sel of audioModalSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await btn.click({ timeout: 2000 }).catch(() => {});
          break;
        }
      }
    } catch {}
  }

  private async dismissInMeetingDisclaimers(page: Page): Promise<void> {
    try {
      const disclaimerSelectors = [
        'button:has-text("Got it")',
        'button:has-text("Stay in Meeting")',
        'button:has-text("I Agree")',
        'button:has-text("Continue")',
        '.zm-modal button:has-text("Got it")',
      ];
      for (const sel of disclaimerSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await btn.click({ timeout: 1500 }).catch(() => {});
        }
      }
    } catch {}
  }

  async leave(page: Page): Promise<void> {
    try {
      const leaveSelectors = [
        'button[aria-label*="Leave" i]',
        '.footer__leave-btn',
        'button:has-text("Leave")',
        '[data-testid="leave-button"]',
      ];
      for (const sel of leaveSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click({ timeout: 1500 }).catch(() => {});
          // Confirm dialog if shown: "Leave Meeting"
          const confirmBtn = page.locator('button:has-text("Leave Meeting")').first();
          if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await confirmBtn.click().catch(() => {});
          }
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
      const bridgeFn = `__spectraZoomRosterBridge_${Date.now()}`;
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
          // Zoom web client participant list items
          document.querySelectorAll('.participants-item__display-name, .participants-ul li').forEach((el) => {
            const name = (el.textContent || '').replace(/\(Host\)/gi, '').replace(/\(Me\)/gi, '').trim();
            if (name && name.length >= 2) {
              found.add(name);
            }
          });

          // Diff against current
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
      const bridgeFn = `__spectraZoomChatBridge_${Date.now()}`;
      await page.exposeFunction(bridgeFn, (sender: string, text: string) => {
        if (!text) return;
        onMessage({
          message_id: `zoom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sender: sender || 'Participant',
          text,
          timestamp_ms: Date.now(),
        });
      });

      await page.evaluate((fnName) => {
        const seenMessages = new Set<string>();

        function scanChat() {
          document.querySelectorAll('.chat-item__chat-info, .chat-message__container').forEach((el) => {
            const senderEl = el.querySelector('.chat-item__sender, .chat-message__sender');
            const textEl = el.querySelector('.chat-item__chat-text, .chat-message__text');
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

