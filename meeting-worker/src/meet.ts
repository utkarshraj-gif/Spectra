import { BrowserContext, Page } from 'playwright';
import { createMeetingContext, cleanupProfileDir } from './browser.js';
import { config } from './config.js';
import { MeetingState, SessionStatusEvent } from './types.js';

// Vexa-aligned URL normalizer with pinned locale (?hl=en)
function withPinnedMeetLocale(rawUrl: string): string {
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

// Selectors directly ported from Vexa's core/meetings/modules/join/src/googlemeet/selectors.ts
const GOOGLE_NAME_INPUT_SELECTORS = [
  'input[jsname][type="text"]',
  'input[type="text"]:not([aria-hidden="true"])',
  'div[jscontroller] input[type="text"]',
  'input[type="text"][aria-label="Your name"]',
  'input[placeholder*="name" i]',
];

const GOOGLE_JOIN_BUTTON_SELECTORS = [
  '//button[.//span[text()="Ask to join"]]',
  'button:has-text("Ask to join")',
  'button:has-text("Join now")',
  'button:has-text("Join")',
  'button[jsname]:not([aria-label]):has(span)',
];

const GOOGLE_MIC_SELECTORS = [
  '[aria-label*="Turn off microphone" i]',
  'button[aria-label*="Turn off microphone" i]',
  '[data-is-muted="false"]',
];

const GOOGLE_CAM_SELECTORS = [
  '[aria-label*="Turn off camera" i]',
  'button[aria-label*="Turn off camera" i]',
  'button[aria-label*="Turn off video" i]',
];

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
  '[aria-label*="waiting room" i]',
  '[aria-label*="Asking to be let in" i]',
];

const GOOGLE_REJECTION_INDICATORS = [
  'text=denied your request',
  'text=denied your request to join',
  'text=Your request to join was denied',
  'text=You were denied',
  'text=weren\'t allowed to join',
  'text=Meeting has ended',
  'text=Meeting not found',
];

export class GoogleMeetSession {
  public readonly meetingId: string;
  public readonly meetingUrl: string;
  public readonly botName: string;

  private context: BrowserContext | null = null;
  private profileDir: string | null = null;
  private page: Page | null = null;
  private state: MeetingState = 'INITIALIZING';
  private onEventCallback: (event: SessionStatusEvent) => void;
  private monitorInterval: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  constructor(
    meetingId: string,
    meetingUrl: string,
    botName?: string,
    onEvent?: (event: SessionStatusEvent) => void
  ) {
    this.meetingId = meetingId;
    this.meetingUrl = withPinnedMeetLocale(meetingUrl);
    this.botName = botName || config.defaultBotName;
    this.onEventCallback = onEvent || (() => {});
  }

  public getState(): MeetingState {
    return this.state;
  }

  private transitionTo(newState: MeetingState, message?: string, details?: Record<string, unknown>) {
    if (this.isDestroyed && newState !== 'CALL_ENDED' && newState !== 'FAILED') {
      return;
    }
    this.state = newState;
    const event: SessionStatusEvent = {
      event: 'STATE_CHANGE',
      meeting_id: this.meetingId,
      state: newState,
      timestamp: Date.now(),
      message,
      details,
    };
    this.onEventCallback(event);
  }

  public async start(): Promise<void> {
    try {
      this.transitionTo('INITIALIZING', 'Launching persistent browser context');
      const { context, profileDir } = await createMeetingContext(this.meetingId);
      this.context = context;
      this.profileDir = profileDir;

      this.page = this.context.pages()[0] || (await this.context.newPage());
      this.page.setDefaultTimeout(config.navigationTimeoutMs);

      // Navigate with pinned locale (?hl=en)
      this.transitionTo('NAVIGATING', `Navigating to ${this.meetingUrl}`);
      await this.page.goto(this.meetingUrl, { waitUntil: 'domcontentloaded' });

      // Pre-Join Setup
      this.transitionTo('PRE_JOIN', 'Configuring pre-join devices and identity');
      await this.configurePreJoinRoom();

      // Submit Join Request
      await this.submitJoinRequest();

      // Monitor Admission State
      await this.waitForAdmissionOrEntry();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.transitionTo('FAILED', `Session execution error: ${errorMsg}`);
      await this.cleanup();
    }
  }

  private async configurePreJoinRoom(): Promise<void> {
    if (!this.page) return;

    // Wait for Google Meet pre-join SPA hydration
    await this.page.waitForTimeout(3000);

    // Dismiss any introductory dialogs
    try {
      const dismissButtons = this.page.locator('button:has-text("Dismiss"), button:has-text("Got it")');
      if ((await dismissButtons.count()) > 0) {
        await dismissButtons.first().click().catch(() => {});
      }
    } catch {
      // Non-fatal
    }

    // 1. Turn OFF Microphone
    try {
      for (const sel of GOOGLE_MIC_SELECTORS) {
        const mic = this.page.locator(sel).first();
        if (await mic.isVisible()) {
          await mic.click().catch(() => {});
          break;
        }
      }
    } catch {
      await this.page.keyboard.press('Control+d');
    }

    // 2. Turn OFF Camera
    try {
      for (const sel of GOOGLE_CAM_SELECTORS) {
        const cam = this.page.locator(sel).first();
        if (await cam.isVisible()) {
          await cam.click().catch(() => {});
          break;
        }
      }
    } catch {
      await this.page.keyboard.press('Control+e');
    }

    // 3. Fill Bot Display Name if name field exists (Guest Join)
    try {
      for (const sel of GOOGLE_NAME_INPUT_SELECTORS) {
        const nameInput = this.page.locator(sel).first();
        if (await nameInput.isVisible()) {
          await nameInput.fill(this.botName);
          break;
        }
      }
    } catch {
      // Name input may not be present if signed in
    }

    await this.page.waitForTimeout(1000);
  }

  private async submitJoinRequest(): Promise<void> {
    if (!this.page) return;

    for (const sel of GOOGLE_JOIN_BUTTON_SELECTORS) {
      const btn = this.page.locator(sel).first();
      try {
        if (await btn.isVisible()) {
          await btn.click();
          return;
        }
      } catch {
        // try next selector
      }
    }

    // If none was instantly visible, wait up to 10s for the primary CTA
    const primaryCta = this.page.locator(GOOGLE_JOIN_BUTTON_SELECTORS.join(', ')).first();
    await primaryCta.waitFor({ state: 'visible', timeout: 10000 });
    await primaryCta.click();
  }

  private async waitForAdmissionOrEntry(): Promise<void> {
    if (!this.page) return;

    const startTime = Date.now();

    while (!this.isDestroyed && Date.now() - startTime < config.admissionTimeoutMs) {
      if (!this.page || this.page.isClosed()) {
        this.transitionTo('CALL_ENDED', 'Browser page closed');
        return;
      }

      // Check 1: In Meeting (Leave call button or in-meeting controls are visible)
      for (const sel of GOOGLE_ADMISSION_INDICATORS) {
        const el = this.page.locator(sel).first();
        try {
          if (await el.isVisible()) {
            this.transitionTo('IN_MEETING', 'Bot successfully admitted to meeting room');
            this.startInMeetingMonitor();
            return;
          }
        } catch {}
      }

      // Check 2: Waiting Room Indicators (Vexa-aligned: "Asking to be let in")
      for (const sel of GOOGLE_WAITING_INDICATORS) {
        const el = this.page.locator(sel).first();
        try {
          if (await el.isVisible()) {
            if (this.state !== 'WAITING_FOR_ADMISSION') {
              this.transitionTo('WAITING_FOR_ADMISSION', 'Waiting for host to admit bot');
            }
            break;
          }
        } catch {}
      }

      // Check 3: Genuine Rejection (Host denied, NOT the "Return to home screen" button)
      for (const sel of GOOGLE_REJECTION_INDICATORS) {
        const el = this.page.locator(sel).first();
        try {
          if (await el.isVisible()) {
            this.transitionTo('ADMISSION_DENIED', 'Host denied bot entry or call ended');
            await this.cleanup();
            return;
          }
        } catch {}
      }

      await this.page.waitForTimeout(2000);
    }

    if (this.state === 'WAITING_FOR_ADMISSION' || this.state === 'PRE_JOIN') {
      this.transitionTo('ADMISSION_DENIED', 'Admission timeout exceeded');
      await this.cleanup();
    }
  }

  private startInMeetingMonitor(): void {
    if (this.monitorInterval) clearInterval(this.monitorInterval);

    this.monitorInterval = setInterval(async () => {
      if (this.isDestroyed || !this.page || this.page.isClosed()) {
        this.stopMonitoring();
        return;
      }

      try {
        const endedText = this.page.locator('text=/You left the meeting|The call has ended/i');
        if ((await endedText.count()) > 0 && (await endedText.first().isVisible())) {
          this.transitionTo('CALL_ENDED', 'Meeting has ended');
          await this.cleanup();
          return;
        }

        this.onEventCallback({
          event: 'HEARTBEAT',
          meeting_id: this.meetingId,
          state: this.state,
          timestamp: Date.now(),
        });
      } catch {
        // Non-critical
      }
    }, 5000);
  }

  private stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  public async leave(reason = 'User requested stop'): Promise<void> {
    if (this.isDestroyed) return;
    this.transitionTo('LEAVING', reason);

    if (this.page && !this.page.isClosed()) {
      try {
        const leaveButton = this.page.locator('button[aria-label*="Leave call" i], button[aria-label*="Leave meeting" i]').first();
        if (await leaveButton.isVisible()) {
          await leaveButton.click({ timeout: 3000 }).catch(() => {});
        }
      } catch {
        // Ignore
      }
    }

    this.transitionTo('CALL_ENDED', reason);
    await this.cleanup();
  }

  public async cleanup(): Promise<void> {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.stopMonitoring();

    try {
      if (this.context) {
        await this.context.close().catch(() => {});
      }
    } finally {
      this.page = null;
      this.context = null;
      if (this.profileDir) {
        cleanupProfileDir(this.profileDir);
        this.profileDir = null;
      }
    }
  }
}
