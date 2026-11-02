import { BrowserContext, Page } from 'playwright';
import { createMeetingContext, cleanupProfileDir } from './browser.js';
import { config } from './config.js';
import { MeetingState, SessionStatusEvent, PlatformAdapter } from './types.js';
import { startMeetingAudioCapture, AudioCaptureSession, validateWavFile, LiveAudioStreamer } from './audio/index.js';
import { getAdapterForUrl } from './platforms/index.js';

export class MeetingSession {
  public readonly meetingId: string;
  public readonly meetingUrl: string;
  public readonly botName: string;

  private adapter: PlatformAdapter;
  private context: BrowserContext | null = null;
  private profileDir: string | null = null;
  private page: Page | null = null;
  private state: MeetingState = 'INITIALIZING';
  private onEventCallback: (event: SessionStatusEvent) => void;
  private monitorInterval: NodeJS.Timeout | null = null;
  private audioCaptureSession: AudioCaptureSession | null = null;
  private streamer: LiveAudioStreamer | null = null;
  private isDestroyed = false;

  constructor(
    meetingId: string,
    meetingUrl: string,
    botName?: string,
    onEvent?: (event: SessionStatusEvent) => void
  ) {
    this.meetingId = meetingId;
    this.adapter = getAdapterForUrl(meetingUrl);
    this.meetingUrl = this.adapter.normalizeUrl(meetingUrl);
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
      this.transitionTo('INITIALIZING', `Launching browser context for ${this.adapter.platform}`);
      const { context, profileDir } = await createMeetingContext(this.meetingId);
      this.context = context;
      this.profileDir = profileDir;

      this.page = this.context.pages()[0] || (await this.context.newPage());
      this.page.setDefaultTimeout(config.navigationTimeoutMs);

      // Navigate
      this.transitionTo('NAVIGATING', `Navigating to ${this.meetingUrl}`);
      await this.page.goto(this.meetingUrl, { waitUntil: 'domcontentloaded' });

      // Pre-Join Setup
      this.transitionTo('PRE_JOIN', 'Configuring pre-join devices and identity');
      await this.adapter.configurePreJoin(this.page, this.botName);

      // Submit Join Request
      await this.adapter.submitJoinRequest(this.page);

      // Monitor Admission State
      const admitted = await this.adapter.waitForAdmission(
        this.page,
        config.admissionTimeoutMs,
        (st, msg) => this.transitionTo(st, msg)
      );

      if (admitted) {
        this.transitionTo('IN_MEETING', 'Bot successfully joined meeting room');
        this.startInMeetingMonitor();
        await this.startAudioCapture();
        await this.setupSpeakerObserver();
      } else {
        if (this.state !== 'ADMISSION_DENIED') {
          this.transitionTo('ADMISSION_DENIED', 'Admission timeout exceeded');
        }
        await this.cleanup();
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.transitionTo('FAILED', `Session execution error: ${errorMsg}`);
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
        const endedText = this.page.locator('text=/You left the meeting|The call has ended|Meeting ended/i');
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

  private async startAudioCapture(): Promise<void> {
    if (!this.page || this.audioCaptureSession) return;
    try {
      const wsUrl = `${config.aiServiceWsUrl}/ws/transcribe/${this.meetingId}`;
      this.streamer = new LiveAudioStreamer({
        aiServiceWsUrl: wsUrl,
        meetingId: this.meetingId,
        onTranscriptSegment: (segment) => {
          this.onEventCallback({
            event: 'TRANSCRIPT_SEGMENT',
            meeting_id: this.meetingId,
            state: this.state,
            timestamp: Date.now(),
            message: segment.text,
            details: {
              speaker: segment.speaker,
              text: segment.text,
              start_time_ms: segment.start_time_ms,
              end_time_ms: segment.end_time_ms,
              is_final: segment.is_final,
            },
          });
        },
      });
      this.streamer.connect();

      this.audioCaptureSession = await startMeetingAudioCapture(this.page, {
        meetingId: this.meetingId,
        silenceThreshold: 0.003,
        onPcmChunk: ({ pcmBuffer }) => {
          if (this.streamer) {
            this.streamer.sendPcmChunk(pcmBuffer);
          }
        },
      });

      this.onEventCallback({
        event: 'LOG',
        meeting_id: this.meetingId,
        state: this.state,
        timestamp: Date.now(),
        message: 'AudioWorklet active: streaming 16kHz Linear PCM to AI Service',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[MeetingSession] Failed to initialize audio capture: ${msg}`);
    }
  }

  private async setupSpeakerObserver(): Promise<void> {
    if (!this.page) return;
    try {
      const bridgeFn = `__spectraSpeakerBridge_${this.meetingId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await this.page.exposeFunction(bridgeFn, (speakerName: string) => {
        if (!speakerName) return;
        if (this.streamer) {
          this.streamer.notifyActiveSpeaker(speakerName);
        }
        this.onEventCallback({
          event: 'SPEAKER_ACTIVE',
          meeting_id: this.meetingId,
          state: this.state,
          timestamp: Date.now(),
          details: { speaker: speakerName },
        });
      });

      await this.page.evaluate((fnName) => {
        const observer = new MutationObserver(() => {
          const speakingEl = document.querySelector(
            '[data-is-speaking="true"], [aria-label*="speaking" i], div[jscontroller][data-participant-id]:has([class*="speaking"])'
          );
          if (speakingEl) {
            const nameEl = speakingEl.querySelector('[data-self-name], span[title], div[title]');
            const name = nameEl?.textContent?.trim() || speakingEl.getAttribute('aria-label');
            if (name && typeof (window as any)[fnName] === 'function') {
              (window as any)[fnName](name);
            }
          }
        });
        observer.observe(document.body, {
          attributes: true,
          subtree: true,
          attributeFilter: ['data-is-speaking', 'class', 'aria-label'],
        });
      }, bridgeFn);
    } catch {
      // non-critical
    }
  }

  public async leave(reason = 'User requested stop'): Promise<void> {
    if (this.isDestroyed) return;
    this.transitionTo('LEAVING', reason);

    if (this.page && !this.page.isClosed()) {
      try {
        await this.adapter.leave(this.page);
      } catch {}
    }

    this.transitionTo('CALL_ENDED', reason);
    await this.cleanup();
  }

  public async cleanup(): Promise<void> {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.stopMonitoring();

    if (this.streamer) {
      this.streamer.close();
      this.streamer = null;
    }

    if (this.audioCaptureSession) {
      try {
        const savedPath = await this.audioCaptureSession.stop();
        const validation = await validateWavFile(savedPath, 0.1);
        if (validation.valid) {
          this.onEventCallback({
            event: 'AUDIO_READY',
            meeting_id: this.meetingId,
            state: this.state,
            timestamp: Date.now(),
            message: `Audio recording saved and validated (${validation.durationSeconds.toFixed(1)}s, ${validation.fileSizeBytes} bytes)`,
            details: {
              audio_path: savedPath,
              duration_seconds: validation.durationSeconds,
              file_size_bytes: validation.fileSizeBytes,
              sample_rate: validation.sampleRate,
              channels: validation.channels,
            },
          });
        }
      } catch (err: unknown) {
        console.error(`[MeetingSession] Error stopping audio capture:`, err);
      }
      this.audioCaptureSession = null;
    }

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

// Backward-compatible alias
export type GoogleMeetSession = MeetingSession;
export const GoogleMeetSession = MeetingSession;
