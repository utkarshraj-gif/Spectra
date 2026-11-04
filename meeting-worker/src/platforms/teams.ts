import type { Page } from 'playwright';
import type { MeetingPlatform, PlatformAdapter, MeetingState, ParticipantEventPayload, ChatMessagePayload } from '../types.js';

/**
 * TeamsAdapter — Enterprise adapter for Microsoft Teams Web client.
 * Handles direct Light Meetings normalization, app-launcher bypass, guest name configuration,
 * audio/video modal dismissal, pre-join mute controls, lobby detection, admission monitoring,
 * in-call tear down, and participant/chat observation.
 */
export class TeamsAdapter implements PlatformAdapter {
  readonly platform: MeetingPlatform = 'teams';

  matches(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.includes('teams.microsoft.com') ||
      lower.includes('teams.live.com') ||
      lower.includes('teams.cloud.microsoft')
    );
  }

  normalizeUrl(rawUrl: string): string {
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();

      // Normalize teams.live.com meet links directly to the canonical Light Meetings entry point
      if (host.includes('teams.live.com') && u.pathname.includes('/meet/')) {
        const codeMatch = u.pathname.match(/\/meet\/([^\/?#]+)/i);
        const code = codeMatch ? codeMatch[1] : '';
        const passcode = u.searchParams.get('p') || '';
        const coords = Buffer.from(
          JSON.stringify({
            meetingUrl: url,
            meetingCode: code,
            passcode: passcode,
          })
        ).toString('base64');

        return `https://teams.live.com/light-meetings/launch?p=${encodeURIComponent(
          passcode
        )}&anon=true&agent=web&coords=${encodeURIComponent(coords)}`;
      }
    } catch {}

    return url;
  }

  async configurePreJoin(page: Page, botName: string): Promise<void> {
    // 1. Bypass Microsoft Teams app-launcher interstitial if encountered
    await this.bypassInterstitial(page);

    // 2. Dismiss cookie banner / notifications if present
    try {
      const cookieBtn = page
        .locator('button#onetrust-accept-btn-handler, button:has-text("Accept"), button:has-text("Got it")')
        .first();
      if (await cookieBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await cookieBtn.click().catch(() => {});
        await page.waitForTimeout(300);
      }
    } catch {}

    // 3. Wait for pre-join interface to mount (up to 35s for CDN bundles)
    await this.waitForPreJoinReady(page);

    // 4. Dismiss "Continue without audio or video" permission modal if present
    await this.dismissMediaWarningModal(page);

    // 5. Fill Guest display name input
    await this.fillGuestName(page, botName);

    // 6. Ensure camera is toggled OFF
    await this.ensureCameraOff(page);

    // 7. Ensure microphone is toggled OFF (MUTED)
    await this.ensureMicrophoneOff(page);
  }

  async submitJoinRequest(page: Page): Promise<void> {
    // 1. Dismiss any lingering modal
    await this.dismissMediaWarningModal(page);

    // 2. Re-verify camera and microphone are OFF before clicking Join
    await this.ensureCameraOff(page);
    await this.ensureMicrophoneOff(page);

    // 3. Click Join button ("Join now" / "Join meeting")
    const joinSelectors = [
      'button:has-text("Join now")',
      'button[data-tid="prejoin-join-button"]',
      'button#prejoin-join-button',
      'button[aria-label*="Join now" i]',
      'button:has-text("Join meeting")',
    ];

    for (const sel of joinSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const disabled = await btn.evaluate((el: HTMLElement) => {
          return (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true';
        }).catch(() => false);

        if (!disabled) {
          console.log(`[TeamsAdapter] Submitting join request via ${sel}`);
          await btn.click({ force: true, timeout: 3000 }).catch(() => {});

          // Single click only: In Teams light-meetings, focus immediately shifts to Cancel.
          // Pressing Enter or double-clicking clicks Cancel and aborts with CallEndReasonLocalUserInitiated (12).
          return;
        }
      }
    }
  }

  async waitForAdmission(
    page: Page,
    timeoutMs: number,
    onStateChange: (state: MeetingState, message: string) => void
  ): Promise<boolean> {
    const startTime = Date.now();

    const IN_CALL_SELECTORS = [
      'button[data-tid="hangup-button"]',
      'button#hangup-button',
      'button[data-tid="call-control-hangup"]',
      'button[aria-label*="Leave" i]',
      'button[aria-label*="Hang up" i]',
      'button[data-tid="roster-button"]',
      '[data-tid="call-roster-mount"]',
      'div[data-tid="calling-participant-stream"]',
      'div[data-tid="calling-participant-tile"]',
    ];

    let hasAnnouncedLobby = false;

    while (Date.now() - startTime < timeoutMs) {
      if (page.isClosed()) return false;

      // 1. Check if admitted into meeting
      for (const sel of IN_CALL_SELECTORS) {
        if (await page.locator(sel).first().isVisible({ timeout: 100 }).catch(() => false)) {
          console.log(`[TeamsAdapter] Admitted into Microsoft Teams call (detected via ${sel})`);
          onStateChange('IN_MEETING', 'Admitted to Microsoft Teams meeting');

          // Immediately mute camera and microphone in-meeting so Teams shows the avatar circle (initials) instead of green video
          try {
            await page.keyboard.press('Control+Shift+O').catch(() => {});
            await page.keyboard.press('Control+Shift+M').catch(() => {});
            const camBtn = page.locator('button[data-tid="call-control-video"], button[aria-label*="camera" i], button:has-text("Camera")').first();
            if (await camBtn.isVisible({ timeout: 800 }).catch(() => false)) {
              await camBtn.click().catch(() => {});
            }
          } catch {}

          return true;
        }
      }

      // 2. Inspect document body text for lobby or rejection state
      const bodyText = await page
        .evaluate(() => (document.body ? document.body.innerText : ''))
        .catch(() => '');

      // Check if rejected, disconnected, or call ended
      if (
        /Sorry, we couldn't connect you|removed from the meeting|Meeting ended|request to join was declined|Couldn't join the call|Returning to Teams meetings|Enjoy your call/i.test(
          bodyText
        )
      ) {
        console.log(`[TeamsAdapter] Microsoft Teams admission declined, disconnected or ended`);
        onStateChange('ADMISSION_DENIED', 'Teams meeting is inactive, ended, or join denied');
        return false;
      }

      // 3. Check if waiting in lobby
      const inLobby = /let you in|waiting in the lobby|someone in the meeting|someone will let you in/i.test(bodyText);

      if (inLobby) {
        if (!hasAnnouncedLobby) {
          hasAnnouncedLobby = true;
          console.log(`[TeamsAdapter] Waiting in Microsoft Teams lobby for admission`);
          onStateChange('WAITING_FOR_ADMISSION', 'Waiting in Microsoft Teams lobby for host admission');
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
        'button#hangup-button',
        'button[data-tid="call-control-hangup"]',
        'button[aria-label*="Leave" i]',
        'button[aria-label*="Hang up" i]',
      ];
      for (const sel of leaveSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click().catch(() => {});
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

  private async bypassInterstitial(page: Page): Promise<void> {
    // Check if on launcher page
    if (!page.url().includes('launcher.html')) {
      const isLauncher = await page
        .locator('button[data-tid="joinOnWeb"], button:has-text("Continue on this browser")')
        .first()
        .isVisible({ timeout: 1500 })
        .catch(() => false);
      if (!isLauncher) return;
    }

    console.log('[TeamsAdapter] Resolving Teams Web application URL from launcher...');

    // Attempt direct extraction of the web client URL via the launcher React fiber
    const targetWebUrl = await page
      .evaluate(() => {
        const btn = document.querySelector('[data-tid="joinOnWeb"]') as any;
        if (!btn) return null;
        const key = Object.keys(btn).find(
          k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
        );
        let current = btn[key as string];
        while (current) {
          if (current.stateNode?.launcherService?.getOpenInTeamsWebUrl) {
            return current.stateNode.launcherService.getOpenInTeamsWebUrl();
          }
          current = current.return;
        }
        return null;
      })
      .catch(() => null);

    if (targetWebUrl) {
      console.log(`[TeamsAdapter] Navigating directly to web client: ${targetWebUrl.slice(0, 80)}...`);
      await page.goto(targetWebUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      return;
    }

    // Fallback: Click the "Continue on this browser" button directly
    const webButtonSelectors = [
      'button[data-tid="joinOnWeb"]',
      'button:has-text("Continue on this browser")',
      '#openTeamsClientInBrowser',
      'button:has-text("Join on the web instead")',
    ];

    for (const sel of webButtonSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`[TeamsAdapter] Bypassing app launcher via: ${sel}`);
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
        return;
      }
    }
  }

  private async waitForPreJoinReady(page: Page): Promise<void> {
    for (let s = 1; s <= 35; s++) {
      if (page.isClosed()) return;

      // Check if Teams showed post-call "Did you leave by mistake? Rejoin the call"
      const rejoinBtn = page
        .locator('button:has-text("Rejoin the call"), button:has-text("Rejoin"), button[data-tid="rejoin-button"]')
        .first();
      if (await rejoinBtn.isVisible({ timeout: 100 }).catch(() => false)) {
        console.log('[TeamsAdapter] Post-call splash detected; clicking "Rejoin the call"...');
        await rejoinBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
      }

      const hasModal = await page
        .locator('button:has-text("Continue without audio or video")')
        .first()
        .isVisible({ timeout: 100 })
        .catch(() => false);

      const hasNameInput = await page
        .locator('input[placeholder*="name" i], input[data-tid="prejoin-display-name-input"]')
        .first()
        .isVisible({ timeout: 100 })
        .catch(() => false);

      if (hasModal || hasNameInput) {
        console.log(`[TeamsAdapter] Pre-join screen ready (took ~${s}s)`);
        return;
      }

      await page.waitForTimeout(1000);
    }
  }

  private async dismissMediaWarningModal(page: Page): Promise<void> {
    try {
      const continueBtn = page.locator('button:has-text("Continue without audio or video")').first();
      if (await continueBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        console.log('[TeamsAdapter] Dismissing media permission modal: "Continue without audio or video"');
        await continueBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
      }

      // Remove any leftover modal backdrop to unblock pointer events
      await page
        .evaluate(() => {
          document
            .querySelectorAll('.fui-DialogSurface__backdrop, .fui-DialogSurface, [role="dialog"]')
            .forEach(el => el.remove());
        })
        .catch(() => {});
    } catch {}
  }

  private async fillGuestName(page: Page, botName: string): Promise<void> {
    const nameSelectors = [
      'input[placeholder*="name" i]',
      'input[data-tid="prejoin-display-name-input"]',
      'input[aria-label*="Type your name" i]',
      'input[aria-label*="name" i]',
      'input[type="text"]:not([aria-hidden="true"])',
      'input',
    ];

    for (const sel of nameSelectors) {
      const input = page.locator(sel).first();
      if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        const currentVal = await input.inputValue().catch(() => '');
        if (!currentVal || currentVal.trim() !== botName) {
          console.log(`[TeamsAdapter] Entering bot name '${botName}' via ${sel}`);
          await input.click({ force: true }).catch(() => {});
          await input.fill(botName);
          await page.waitForTimeout(200);
        }
        return;
      }
    }
  }

  private async ensureCameraOff(page: Page): Promise<void> {
    try {
      await page.keyboard.press('Control+Shift+O').catch(() => {});
      // Check camera switches / checkboxes
      await page
        .evaluate(() => {
          const switches = Array.from(document.querySelectorAll('input[type="checkbox"], button[role="switch"]'));
          for (const sw of switches) {
            const label = (sw.getAttribute('aria-label') || '').toLowerCase();
            const parent = (sw.closest('div')?.innerText || '').toLowerCase();
            if (label.includes('video') || label.includes('camera') || parent.includes('camera')) {
              const checked = (sw as HTMLInputElement).checked || sw.getAttribute('aria-checked') === 'true';
              if (checked) {
                (sw as HTMLElement).click();
              }
            }
          }
        })
        .catch(() => {});

      const camSelectors = [
        'button[data-tid="toggle-video"]',
        'button[aria-label*="Turn camera off" i]',
        'button[aria-label*="camera" i][aria-checked="true"]',
      ];

      for (const sel of camSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          const aria = (await btn.getAttribute('aria-label').catch(() => '')) || '';
          const checked = await btn.getAttribute('aria-checked').catch(() => '');
          if (/turn off/i.test(aria) || checked === 'true') {
            console.log(`[TeamsAdapter] Muting camera via ${sel}`);
            await btn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(200);
            return;
          }
        }
      }
    } catch {}
  }

  private async ensureMicrophoneOff(page: Page): Promise<void> {
    try {
      // Check mic switches / checkboxes
      await page
        .evaluate(() => {
          const switches = Array.from(document.querySelectorAll('input[type="checkbox"], button[role="switch"]'));
          for (const sw of switches) {
            const label = (sw.getAttribute('aria-label') || '').toLowerCase();
            const parent = (sw.closest('div')?.innerText || '').toLowerCase();
            if (label.includes('mic') || label.includes('microphone') || parent.includes('mic')) {
              const checked = (sw as HTMLInputElement).checked || sw.getAttribute('aria-checked') === 'true';
              if (checked) {
                (sw as HTMLElement).click();
              }
            }
          }
        })
        .catch(() => {});

      const micSelectors = [
        'button[data-tid="toggle-mute"]',
        'button[aria-label*="Mute mic" i]',
        'button[aria-label*="Turn off microphone" i]',
        'button[aria-label*="mic" i][aria-checked="true"]',
      ];

      for (const sel of micSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          const aria = (await btn.getAttribute('aria-label').catch(() => '')) || '';
          const checked = await btn.getAttribute('aria-checked').catch(() => '');
          if (/mute mic/i.test(aria) || /turn off/i.test(aria) || checked === 'true') {
            console.log(`[TeamsAdapter] Muting microphone via ${sel}`);
            await btn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(200);
            return;
          }
        }
      }

      // Teams keyboard shortcut fallback: Control+Shift+M toggles microphone
      const unmutedBtn = page
        .locator('button[aria-label*="Mute mic" i], [data-tid="toggle-mute"][aria-checked="true"], [aria-label*="Mic on" i]')
        .first();
      if (await unmutedBtn.isVisible({ timeout: 200 }).catch(() => false)) {
        console.log('[TeamsAdapter] Muting microphone via Control+Shift+M');
        await page.keyboard.press('Control+Shift+M').catch(() => {});
        await page.waitForTimeout(200);
      }
    } catch {}
  }
}
