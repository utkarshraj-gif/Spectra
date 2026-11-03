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
  private currentSpeaker = '';
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

      const pages = this.context.pages();
      if (pages.length > 0 && pages[0].url() === 'about:blank') {
        this.page = pages[0];
      } else {
        this.page = await this.context.newPage();
      }
      const page = this.page;
      if (!page) {
        throw new Error('Failed to initialize page in context');
      }
      page.setDefaultTimeout(config.navigationTimeoutMs);

      // Navigate
      this.transitionTo('NAVIGATING', `Navigating to ${this.meetingUrl}`);
      await page.goto(this.meetingUrl, { waitUntil: 'domcontentloaded' }).catch(async () => {
        await page.goto(this.meetingUrl, { waitUntil: 'commit' });
      });

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

        // Open People panel to ensure participant names and microphone states are directly visible in DOM
        try {
          const peopleButton = this.page
            .locator('button[aria-label*="People" i], button[aria-label*="Show everyone" i], button[data-tab-id="1"]')
            .first();
          if (await peopleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await peopleButton.click().catch(() => {});
          }
        } catch {}

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

    const joinedAt = Date.now();
    let hadHumanParticipants = false;
    let soloCounter = 0;

    this.monitorInterval = setInterval(async () => {
      if (this.isDestroyed || !this.page || this.page.isClosed()) {
        this.stopMonitoring();
        return;
      }

      try {
        // 1. Check for explicit meeting termination / ejection indicators
        const ENDED_SELECTORS = [
          'text=/You left the meeting/i',
          'text=/The call has ended/i',
          'text=/Meeting ended/i',
          'text=/Your call was ended/i',
          'text=/ended the meeting for everyone/i',
          'text=/removed from the meeting/i',
          'text=/Return to home screen/i',
          'text=/You can\'t join this video call/i',
          'text=/This meeting has already ended/i',
          'button:has-text("Return to home screen")',
        ];

        for (const sel of ENDED_SELECTORS) {
          if (await this.page.locator(sel).first().isVisible().catch(() => false)) {
            this.transitionTo('CALL_ENDED', 'Meeting has ended or host ended call');
            await this.cleanup();
            return;
          }
        }

        // 2. Check participant count
        const participantCount = await this.page.evaluate((botName) => {
          const botLower = (botName || '').trim().toLowerCase();

          // Check People tab counter badge
          const counterEl = document.querySelector(
            '[aria-label*="people" i], [aria-label*="everyone" i], [data-tab-id="1"]'
          );
          if (counterEl) {
            const countMatch = (counterEl.textContent || counterEl.getAttribute('aria-label') || '').match(/\b([0-9]+)\b/);
            if (countMatch) {
              return parseInt(countMatch[1], 10);
            }
          }

          // Check participant rows in People panel
          const rows = document.querySelectorAll('[role="listitem"]');
          if (rows.length > 0) {
            let count = 0;
            rows.forEach((r) => {
              const txt = (r.textContent || '').toLowerCase();
              if (txt && !txt.includes(botLower)) count++;
            });
            return count > 0 ? count + 1 : 1;
          }

          // Check video tiles
          const tiles = document.querySelectorAll('div[data-participant-id], div[data-requested-participant-id]');
          return tiles.length;
        }, this.botName).catch(() => -1);

        if (participantCount > 1) {
          hadHumanParticipants = true;
          soloCounter = 0;
        } else if (participantCount === 1) {
          // If human participants were previously confirmed, and bot is now the sole participant left
          // for at least 15 seconds (10 checks) after the initial 30s grace period
          if (hadHumanParticipants && Date.now() - joinedAt > 30000) {
            soloCounter++;
            if (soloCounter >= 10) {
              console.log(`[MeetingSession] All participants left meeting ${this.meetingId}. Leaving call automatically.`);
              await this.leave('All participants have left the meeting');
              return;
            }
          }
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
    }, 1500);
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
          const effectiveSpeaker =
            this.currentSpeaker && this.currentSpeaker !== 'Speaker 1'
              ? this.currentSpeaker
              : segment.speaker && segment.speaker !== 'Speaker 1'
              ? segment.speaker
              : this.currentSpeaker || 'Speaker';

          this.onEventCallback({
            event: 'TRANSCRIPT_SEGMENT',
            meeting_id: this.meetingId,
            state: this.state,
            timestamp: Date.now(),
            message: segment.text,
            details: {
              speaker: effectiveSpeaker,
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
        silenceThreshold: 0.0008,
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
        const changed = speakerName !== this.currentSpeaker;
        this.currentSpeaker = speakerName;
        if (this.streamer) {
          this.streamer.notifyActiveSpeaker(speakerName);
        }
        if (changed) {
          this.onEventCallback({
            event: 'SPEAKER_ACTIVE',
            meeting_id: this.meetingId,
            state: this.state,
            timestamp: Date.now(),
            details: { speaker: speakerName },
          });
        }
      });

      await this.page.evaluate(
        ({ fnName, botName }) => {
          const botLower = (botName || '').trim().toLowerCase();

          function cleanCandidateName(raw: string): string {
            return raw
              .replace(/\s*\(You\)/gi, '')
              .replace(/\s*\(Host\)/gi, '')
              .replace(/\s*\(Meeting host\)/gi, '')
              .replace(/\s*Meeting host/gi, '')
              .replace(/\s*\(Presentation\)/gi, '')
              .replace(/('s video|'s screen|presentation|video feed)$/gi, '')
              .replace(/[\n\r]+/g, ' ')
              .trim();
          }

          function isValidPersonName(name: string): boolean {
            if (!name || name.length < 2 || name.length > 50) return false;
            const lower = name.toLowerCase();
            if (lower.includes(botLower) || botLower.includes(lower)) return false;
            if (
              /^(you|people|chat|activities|details|meeting details|contributors|in the meeting|add people|search for people|pin|mute|turn on|turn off|more options|leave call|everyone|\d+|\d+:\d+)$/i.test(
                name
              )
            ) {
              return false;
            }
            return true;
          }

          function scanAndReportSpeaker() {
            const foundNames = new Set<string>();
            let activeSpeaker: string | null = null;

            // 1. Google Meet People Panel rows ([role="listitem"])
            document.querySelectorAll('[role="listitem"]').forEach((row) => {
              const rowText = row.textContent || '';
              if (rowText.toLowerCase().includes(botLower)) return;

              const spans = row.querySelectorAll('span, div');
              for (const span of Array.from(spans)) {
                if (span.children.length === 0) {
                  const cleaned = cleanCandidateName(span.textContent || '');
                  if (isValidPersonName(cleaned)) {
                    foundNames.add(cleaned);

                    // Check if unmuted or speaking in the row
                    const isSpeaking = row.querySelector(
                      '[data-is-speaking="true"], [aria-label*="speaking" i], [class*="speaking" i]'
                    );
                    const isUnmuted = row.querySelector(
                      '[aria-label*="microphone" i]:not([aria-label*="off" i]):not([aria-label*="muted" i]), [data-is-muted="false"]'
                    );
                    if (isSpeaking || isUnmuted) {
                      activeSpeaker = cleaned;
                    }
                    break;
                  }
                }
              }
            });

            // 2. Video grid tiles & badges
            const tileSelectors = [
              'div[data-participant-id]',
              'div[data-requested-participant-id]',
              'div[data-tile-id]',
              'div[data-allocation-index]',
              'div[role="region"]',
            ];

            for (const sel of tileSelectors) {
              document.querySelectorAll(sel).forEach((tile) => {
                const selfName = tile.getAttribute('data-self-name');
                if (selfName) {
                  const cleaned = cleanCandidateName(selfName);
                  if (isValidPersonName(cleaned)) foundNames.add(cleaned);
                }

                const aria = tile.getAttribute('aria-label');
                if (aria) {
                  const cleaned = cleanCandidateName(aria);
                  if (isValidPersonName(cleaned)) foundNames.add(cleaned);
                }

                const badges = tile.querySelectorAll('span, div');
                for (const badge of Array.from(badges)) {
                  if (badge.children.length === 0) {
                    const cleaned = cleanCandidateName(badge.textContent || '');
                    if (isValidPersonName(cleaned)) {
                      foundNames.add(cleaned);

                      const isSpeaking = tile.querySelector(
                        '[data-is-speaking="true"], [aria-label*="speaking" i], [jsname="B7I4Od"], [class*="speaking" i]'
                      );
                      if (isSpeaking) {
                        activeSpeaker = cleaned;
                      }
                      break;
                    }
                  }
                }
              });
            }

            // 3. Search elements with (You) or (Host)
            document.querySelectorAll('span, div').forEach((el) => {
              if (el.children.length === 0) {
                const txt = el.textContent || '';
                if (txt.includes('(You)') || txt.includes('(Host)')) {
                  const cleaned = cleanCandidateName(txt);
                  if (isValidPersonName(cleaned)) {
                    foundNames.add(cleaned);
                  }
                }
              }
            });

            const namesList = Array.from(foundNames);

            if (!activeSpeaker && namesList.length > 0) {
              activeSpeaker = namesList[0];
            }

            if (activeSpeaker && typeof (window as any)[fnName] === 'function') {
              (window as any)[fnName](activeSpeaker);
            }
          }

          // Initial scan
          scanAndReportSpeaker();

          // Mutation observer
          const observer = new MutationObserver(() => scanAndReportSpeaker());
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-is-speaking', 'aria-label', 'class', 'data-self-name'],
          });

          // Periodic scan every 1000ms
          (window as any)[`__timer_${fnName}`] = setInterval(scanAndReportSpeaker, 1000);
        },
        { fnName: bridgeFn, botName: this.botName }
      );
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

    if (this.page && !this.page.isClosed()) {
      try {
        const bridgeFn = `__spectraSpeakerBridge_${this.meetingId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        await this.page.evaluate((fnName) => {
          const tId = (window as any)[`__timer_${fnName}`];
          if (tId) clearInterval(tId);
        }, bridgeFn).catch(() => {});
      } catch {}
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
      if (this.page && !this.page.isClosed()) {
        await this.page.close().catch(() => {});
      }
    } finally {
      this.page = null;
      this.context = null;
      this.profileDir = null;
    }
  }
}

// Backward-compatible alias
export type GoogleMeetSession = MeetingSession;
export const GoogleMeetSession = MeetingSession;
