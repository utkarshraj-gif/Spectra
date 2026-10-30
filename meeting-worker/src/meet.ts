import { BrowserContext, Page } from 'playwright';
import { createMeetingContext, cleanupProfileDir } from './browser.js';
import { config } from './config.js';
import { MeetingState, SessionStatusEvent } from './types.js';

function normalizeMeetUrl(url: string): string {
  let cleaned = url.trim();
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  try {
    const parsed = new URL(cleaned);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const code = segments[segments.length - 1] || '';
    if (code) {
      return `https://meet.google.com/${code}`;
    }
  } catch {
    // fallback
  }
  return cleaned;
}

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
    this.meetingUrl = normalizeMeetUrl(meetingUrl);
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

      // In persistent context, grab existing page or create new one
      this.page = this.context.pages()[0] || (await this.context.newPage());
      this.page.setDefaultTimeout(config.navigationTimeoutMs);

      // Navigate to Google Meet URL
      this.transitionTo('NAVIGATING', `Navigating to ${this.meetingUrl}`);
      await this.page.goto(this.meetingUrl, { waitUntil: 'domcontentloaded' });

      // Check if immediately blocked with "You can't join this video call"
      const blocked = await this.checkIfBlocked();
      if (blocked) {
        this.transitionTo(
          'FAILED',
          "Google Meet blocked guest entry (Ensure host is inside call and host management allows guests)"
        );
        await this.cleanup();
        return;
      }

      // Handle Pre-Join Setup
      this.transitionTo('PRE_JOIN', 'Configuring pre-join devices and bot identity');
      await this.configurePreJoinRoom();

      // Submit Ask to Join / Join Now
      await this.submitJoinRequest();

      // Monitor Admission State
      await this.waitForAdmissionOrEntry();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.transitionTo('FAILED', `Session execution error: ${errorMsg}`);
      await this.cleanup();
    }
  }

  private async checkIfBlocked(): Promise<boolean> {
    if (!this.page) return false;
    try {
      const blockedLocator = this.page.locator('text=/You can\'t join this video call|Return to home screen/i');
      return (await blockedLocator.count()) > 0 && (await blockedLocator.first().isVisible());
    } catch {
      return false;
    }
  }

  private async configurePreJoinRoom(): Promise<void> {
    if (!this.page) return;

    await this.page.waitForTimeout(2000);

    // Dismiss any introductory dialogs / cookie banners
    try {
      const dismissButtons = this.page.locator(
        'button:has-text("Dismiss"), button:has-text("Got it"), [aria-label*="Dismiss" i]'
      );
      if ((await dismissButtons.count()) > 0) {
        await dismissButtons.first().click().catch(() => {});
      }
    } catch {
      // Non-fatal
    }

    // 1. Turn OFF Microphone
    try {
      const micButton = this.page.locator(
        '[aria-label*="turn off microphone" i], [aria-label*="mute" i], [data-is-muted="false"]'
      );
      if ((await micButton.count()) > 0 && (await micButton.first().isVisible())) {
        await micButton.first().click();
      } else {
        await this.page.keyboard.press('Control+d');
      }
    } catch {
      await this.page.keyboard.press('Control+d');
    }

    // 2. Turn OFF Camera
    try {
      const camButton = this.page.locator(
        '[aria-label*="turn off camera" i], [aria-label*="turn off video" i]'
      );
      if ((await camButton.count()) > 0 && (await camButton.first().isVisible())) {
        await camButton.first().click();
      } else {
        await this.page.keyboard.press('Control+e');
      }
    } catch {
      await this.page.keyboard.press('Control+e');
    }

    // 3. Enter Bot Display Name if name input is required (Guest join flow)
    try {
      const nameInput = this.page.locator(
        'input[type="text"], input[placeholder*="name" i], [aria-label*="name" i]'
      );
      if ((await nameInput.count()) > 0 && (await nameInput.first().isVisible())) {
        await nameInput.first().fill(this.botName);
      }
    } catch {
      // Name input may not be required if already signed in
    }

    await this.page.waitForTimeout(1000);
  }

  private async submitJoinRequest(): Promise<void> {
    if (!this.page) return;

    const joinButton = this.page.locator(
      'button:has-text("Ask to join"), button:has-text("Join now"), button:has-text("Join"), span:has-text("Ask to join"), span:has-text("Join now")'
    );

    try {
      await joinButton.first().waitFor({ state: 'visible', timeout: 15000 });
      await joinButton.first().click();
    } catch (e) {
      // If blocked screen appeared after filling name
      if (await this.checkIfBlocked()) {
        throw new Error("Google Meet blocked entry with 'You can't join this video call'");
      }
      throw e;
    }
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
      const leaveCallBtn = this.page.locator(
        '[aria-label*="leave call" i], [aria-label*="leave meeting" i], button[aria-label*="leave" i]'
      );
      if ((await leaveCallBtn.count()) > 0 && (await leaveCallBtn.first().isVisible())) {
        this.transitionTo('IN_MEETING', 'Bot successfully joined the meeting room');
        this.startInMeetingMonitor();
        return;
      }

      // Check 2: Waiting for Admission
      const waitingText = this.page.locator(
        'text=/Asking to be let in|Waiting for the host|Someone will let you in/i'
      );
      if ((await waitingText.count()) > 0 && (await waitingText.first().isVisible())) {
        if (this.state !== 'WAITING_FOR_ADMISSION') {
          this.transitionTo('WAITING_FOR_ADMISSION', 'Waiting for host to admit bot');
        }
      }

      // Check 3: Host Denied Admission
      const deniedText = this.page.locator(
        'text=/You can\'t join this call|The host denied your request|Someone in the call denied/i'
      );
      if ((await deniedText.count()) > 0 && (await deniedText.first().isVisible())) {
        this.transitionTo('ADMISSION_DENIED', 'Host denied bot entry into the meeting');
        await this.cleanup();
        return;
      }

      await this.page.waitForTimeout(2000);
    }

    if (this.state === 'WAITING_FOR_ADMISSION' || this.state === 'PRE_JOIN') {
      this.transitionTo('ADMISSION_DENIED', 'Admission timeout exceeded (no host response)');
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
        const removedText = this.page.locator(
          'text=/You\'ve been removed from the meeting|You have been removed/i'
        );
        if ((await removedText.count()) > 0 && (await removedText.first().isVisible())) {
          this.transitionTo('CALL_ENDED', 'Bot was removed by meeting host');
          await this.cleanup();
          return;
        }

        const endedText = this.page.locator(
          'text=/You left the meeting|The call has ended|Return to home screen/i'
        );
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
        const leaveButton = this.page.locator(
          '[aria-label*="leave call" i], [aria-label*="leave meeting" i], button[aria-label*="leave" i]'
        );
        if ((await leaveButton.count()) > 0 && (await leaveButton.first().isVisible())) {
          await leaveButton.first().click({ timeout: 3000 }).catch(() => {});
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
