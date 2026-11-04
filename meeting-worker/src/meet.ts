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
  public readonly passcode?: string;

  private adapter: PlatformAdapter;
  private context: BrowserContext | null = null;
  private profileDir: string | null = null;
  private page: Page | null = null;
  private state: MeetingState = 'INITIALIZING';
  private onEventCallback: (event: SessionStatusEvent) => void;
  private monitorInterval: NodeJS.Timeout | null = null;
  private maxDurationTimer: NodeJS.Timeout | null = null;
  private audioCaptureSession: AudioCaptureSession | null = null;
  private streamer: LiveAudioStreamer | null = null;
  private currentSpeaker = '';
  private isDestroyed = false;

  constructor(
    meetingId: string,
    meetingUrl: string,
    botName?: string,
    passcodeOrOnEvent?: string | ((event: SessionStatusEvent) => void),
    onEvent?: (event: SessionStatusEvent) => void
  ) {
    this.meetingId = meetingId;
    this.adapter = getAdapterForUrl(meetingUrl);
    this.meetingUrl = this.adapter.normalizeUrl(meetingUrl);
    this.botName = botName || config.defaultBotName;

    if (typeof passcodeOrOnEvent === 'function') {
      this.onEventCallback = passcodeOrOnEvent;
      this.passcode = undefined;
    } else {
      this.passcode = passcodeOrOnEvent;
      this.onEventCallback = onEvent || (() => {});
    }
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
      // 1. Arm hard session duration watchdog (e.g. 3-hour limit per session)
      this.maxDurationTimer = setTimeout(async () => {
        if (!this.isDestroyed) {
          console.warn(`[MeetingSession] Max session duration (${config.maxSessionDurationMs / 3600000}h) reached for ${this.meetingId}. Auto-leaving.`);
          await this.leave(`Session exceeded maximum allowed duration (${config.maxSessionDurationMs / 3600000} hours)`);
        }
      }, config.maxSessionDurationMs);

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

      // 2. Navigate
      this.transitionTo('NAVIGATING', `Navigating to ${this.meetingUrl}`);
      await page.goto(this.meetingUrl, { waitUntil: 'domcontentloaded' }).catch(async () => {
        await page.goto(this.meetingUrl, { waitUntil: 'commit' });
      });

      // 3. Pre-Join Setup
      this.transitionTo('PRE_JOIN', 'Configuring pre-join devices and identity');
      await this.adapter.configurePreJoin(this.page, this.botName, this.passcode);

      // 4. Submit Join Request
      await this.adapter.submitJoinRequest(this.page, this.botName);

      // 5. Monitor Admission State
      const admitted = await this.adapter.waitForAdmission(
        this.page,
        config.admissionTimeoutMs,
        (st, msg) => this.transitionTo(st, msg)
      );

      if (admitted) {
        this.transitionTo('IN_MEETING', 'Bot successfully joined meeting room');
        this.startInMeetingMonitor();

        // Open People panel in Google Meet if needed to ensure participant list in DOM
        try {
          const isPeoplePanelOpen = await this.page.evaluate(() => {
            return !!document.querySelector('div[role="tabpanel"], div[aria-label*="People" i][role="region"], div[data-tab-id="1"]');
          });
          if (!isPeoplePanelOpen) {
            const peopleButton = this.page
              .locator('button[aria-label*="People" i], button[aria-label*="Show everyone" i], button[data-tab-id="1"]')
              .first();
            if (await peopleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
              await peopleButton.click().catch(() => {});
            }
          }
        } catch {}

        // Setup Audio Stream & Recorders
        await this.startAudioCapture();
        await this.setupSpeakerObserver();

        // Setup In-Meeting Participant Roster Observer (Task G-2)
        if (this.adapter.setupRosterObserver) {
          await this.adapter.setupRosterObserver(this.page, (type, p) => {
            this.onEventCallback({
              event: type === 'JOINED' ? 'PARTICIPANT_JOINED' : 'PARTICIPANT_LEFT',
              meeting_id: this.meetingId,
              state: this.state,
              timestamp: Date.now(),
              message: `${p.name} ${type === 'JOINED' ? 'joined' : 'left'} the meeting`,
              details: {
                participant_id: p.participant_id,
                name: p.name,
                timestamp_ms: p.timestamp_ms,
              },
            });
          });
        }

        // Setup In-Meeting Chat Scraper (Task G-2)
        if (this.adapter.setupChatObserver) {
          await this.adapter.setupChatObserver(this.page, (msg) => {
            this.onEventCallback({
              event: 'CHAT_MESSAGE',
              meeting_id: this.meetingId,
              state: this.state,
              timestamp: Date.now(),
              message: `${msg.sender}: ${msg.text}`,
              details: {
                message_id: msg.message_id,
                sender: msg.sender,
                text: msg.text,
                timestamp_ms: msg.timestamp_ms,
              },
            });
          });
        }
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
    let loneBotStartTime: number | null = null;

    this.monitorInterval = setInterval(async () => {
      if (this.isDestroyed || !this.page || this.page.isClosed()) {
        this.stopMonitoring();
        return;
      }

      try {
        // 1. Check for explicit meeting termination / ejection screens across Google Meet, Zoom, Teams
        const ENDED_SELECTORS = [
          'text=/You left the meeting/i',
          'text=/The call has ended/i',
          'text=/Meeting ended/i',
          'text=/Your call was ended/i',
          'text=/ended the meeting for everyone/i',
          'text=/The meeting has ended for everyone/i',
          'text=/removed from the meeting/i',
          'text=/The host has ended this meeting/i',
          'text=/You have been removed by the host/i',
          'text=/Meeting ended by host/i',
          'text=/You\'ve been kicked out/i',
          'text=/Return to home screen/i',
          'text=/You can\'t join this video call/i',
          'text=/This meeting has already ended/i',
          'button:has-text("Return to home screen")',
        ];

        for (const sel of ENDED_SELECTORS) {
          if (await this.page.locator(sel).first().isVisible({ timeout: 100 }).catch(() => false)) {
            this.transitionTo('CALL_ENDED', 'Meeting ended by host or bot ejected');
            await this.cleanup();
            return;
          }
        }

        // 2. Check participant count
        const participantCount = await this.page.evaluate((botName) => {
          const botLower = (botName || '').trim().toLowerCase();

          // Check People tab counter badge (Google Meet)
          const counterEl = document.querySelector(
            '[aria-label*="people" i], [aria-label*="everyone" i], [data-tab-id="1"]'
          );
          if (counterEl) {
            const countMatch = (counterEl.textContent || counterEl.getAttribute('aria-label') || '').match(/\b([0-9]+)\b/);
            if (countMatch) {
              return parseInt(countMatch[1], 10);
            }
          }

          // Check Zoom participant count header
          const zoomCountEl = document.querySelector('.footer-button__number-counter, .participants-header__title');
          if (zoomCountEl) {
            const countMatch = (zoomCountEl.textContent || '').match(/\b([0-9]+)\b/);
            if (countMatch) {
              return parseInt(countMatch[1], 10);
            }
          }

          // Check participant rows in People panel
          const rows = document.querySelectorAll('[role="listitem"], .participants-item__display-name, [data-tid="roster-participant"]');
          if (rows.length > 0) {
            let count = 0;
            rows.forEach((r) => {
              const txt = (r.textContent || '').toLowerCase();
              if (txt && !txt.includes(botLower)) count++;
            });
            return count > 0 ? count + 1 : 1;
          }

          // Check video tiles
          const tiles = document.querySelectorAll('div[data-participant-id], div[data-requested-participant-id], [data-testid="participant-tile"]');
          return tiles.length;
        }, this.botName).catch(() => -1);

        // 3. Intelligent "Lone Bot" Auto-Departure (Task G-3)
        // If human participants were confirmed, and bot is left alone for > 90 seconds
        if (participantCount > 1) {
          hadHumanParticipants = true;
          loneBotStartTime = null;
        } else if (participantCount === 1) {
          if (hadHumanParticipants && Date.now() - joinedAt > 15000) {
            if (loneBotStartTime === null) {
              loneBotStartTime = Date.now();
            } else if (Date.now() - loneBotStartTime >= config.loneBotTimeoutMs) {
              console.log(`[MeetingSession] Lone bot departure: sole participant for >${config.loneBotTimeoutMs / 1000}s in ${this.meetingId}. Auto-leaving.`);
              await this.leave('Lone bot departure: no other participants present for >90s');
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
        // Non-critical poll catch
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
        outputDirectory: config.recordingsPath,
        onPcmChunk: (chunk) => {
          if (this.streamer) {
            this.streamer.sendPcmChunk(chunk.pcmBuffer);
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
            let str = (raw || '').trim();
            const unpinMatch = str.match(/(?:unpin|pin)\s+(.+?)\s+(?:from|to)\s+your\s+main\s+screen/i);
            if (unpinMatch && unpinMatch[1]) str = unpinMatch[1];
            const micMatch = str.match(/(?:mute|unmute)\s+(.+?)(?:'s|\s+microphone)/i);
            if (micMatch && micMatch[1]) str = micMatch[1];

            return str
              .replace(/^(?:unpin|pin)\s+/i, '')
              .replace(/\s+(?:from|to)\s+your\s+main\s+screen$/i, '')
              .replace(/^(?:mute|unmute)\s+/i, '')
              .replace(/\s+'s\s+microphone$/i, '')
              .replace(/^(?:turn off|turn on)\s+/i, '')
              .replace(/\s+'s\s+video$/i, '')
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
            if (!name || name.length < 2 || name.length > 40) return false;
            const lower = name.toLowerCase();
            if (lower.includes(botLower) || botLower.includes(lower)) return false;
            if (
              /^(you|people|chat|activities|details|meeting details|contributors|in the meeting|add people|search for people|pin|unpin|mute|unmute|turn on|turn off|more options|leave call|everyone|\d+|\d+:\d+)$/i.test(
                name
              )
            ) {
              return false;
            }
            if (/^(?:unpin|pin|mute|unmute|turn)\b/i.test(name)) return false;
            if (/\b(?:from your main screen|to your main screen)\b/i.test(name)) return false;
            return true;
          }

          function scanAndReportSpeaker() {
            const foundNames = new Set<string>();
            let activeSpeaker: string | null = null;

            const tileSelectors = [
              'div[data-participant-id]',
              'div[data-requested-participant-id]',
              'div[data-tile-id]',
              'div[data-allocation-index]',
              'div[role="region"]',
              '.participants-item__display-name',
              '[data-tid="roster-participant"]',
            ];

            for (const sel of tileSelectors) {
              document.querySelectorAll(sel).forEach((tile) => {
                const nameBadge = tile.querySelector('div[class*="name" i], span[class*="name" i], [data-self-name]');
                if (nameBadge) {
                  const cleaned = cleanCandidateName(nameBadge.getAttribute('data-self-name') || nameBadge.textContent || '');
                  if (isValidPersonName(cleaned)) foundNames.add(cleaned);
                }

                const isSpeaking =
                  tile.getAttribute('data-is-speaking') === 'true' ||
                  tile.getAttribute('aria-label')?.includes('speaking') ||
                  tile.querySelector('[data-is-speaking="true"], [class*="speaking" i], [class*="active-speaker" i]') !== null;

                if (isSpeaking) {
                  const nameBadge = tile.querySelector('div[class*="name" i], span[class*="name" i], [data-self-name]');
                  if (nameBadge) {
                    const cleaned = cleanCandidateName(nameBadge.getAttribute('data-self-name') || nameBadge.textContent || '');
                    if (isValidPersonName(cleaned)) activeSpeaker = cleaned;
                  }
                }
              });
            }

            const namesList = Array.from(foundNames);
            if (!activeSpeaker && namesList.length > 0) {
              activeSpeaker = namesList[0];
            }

            if (activeSpeaker && typeof (window as any)[fnName] === 'function') {
              (window as any)[fnName](activeSpeaker);
            }
          }

          scanAndReportSpeaker();
          const observer = new MutationObserver(() => scanAndReportSpeaker());
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-is-speaking', 'aria-label', 'class', 'data-self-name'],
          });
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

    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

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

    // 1. Flush and validate WAV recording file BEFORE destroying context
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

    // 2. Close page cleanly
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close().catch(() => {});
      }
    } catch {}

    // 3. Explicitly close context to kill Chromium child processes (eliminates orphaned Chrome processes)
    try {
      if (this.context) {
        await this.context.close().catch(() => {});
      }
    } catch {}

    // 4. Remove session profile directory if isolated
    if (this.profileDir) {
      cleanupProfileDir(this.profileDir);
    }

    this.page = null;
    this.context = null;
    this.profileDir = null;
  }
}

// Backward-compatible alias
export type GoogleMeetSession = MeetingSession;
export const GoogleMeetSession = MeetingSession;
