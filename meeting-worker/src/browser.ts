import fs from 'fs';
import path from 'path';
import type { BrowserContext } from 'playwright';
// @ts-ignore
import { chromium } from 'playwright-extra';
// @ts-ignore
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from './config.js';

// Configure stealth evasions for meeting bot automation
const stealth = StealthPlugin();
stealth.enabledEvasions.delete('iframe.contentWindow');
stealth.enabledEvasions.delete('media.codecs');
stealth.enabledEvasions.delete('user-agent-override');
chromium.use(stealth);

// Canonical browser args for stealth meeting joins (Google Meet, Zoom, Teams)
export const SPECTRA_JOIN_BROWSER_ARGS: readonly string[] = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-infobars',
  '--disable-notifications',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--lang=en-US',
  '--accept-lang=en-US,en',
  '--window-size=1280,720',
];

export interface CreateMeetingContextOptions {
  headless?: boolean;
}

let sharedBrowser: any = null;

export async function prewarmBrowserContext(options?: CreateMeetingContextOptions): Promise<void> {
  const isHeadless = options?.headless !== undefined ? options.headless : config.headless;
  try {
    if (!sharedBrowser || !sharedBrowser.isConnected()) {
      const baseOptions = {
        headless: isHeadless,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [...SPECTRA_JOIN_BROWSER_ARGS],
      };
      try {
        sharedBrowser = await chromium.launch({ ...baseOptions, channel: 'chrome' });
      } catch {
        sharedBrowser = await chromium.launch(baseOptions);
      }
    }
    console.log('[Browser] Chrome automation environment pre-warmed and ready');
  } catch (err) {
    console.warn('[Browser] Chrome pre-warming warning:', err);
  }
}

export async function createMeetingContext(
  meetingId: string,
  options?: CreateMeetingContextOptions
): Promise<{ context: BrowserContext; profileDir: string }> {
  const isHeadless = options?.headless !== undefined ? options.headless : config.headless;
  const baseProfileDir = path.resolve(process.env.BOT_PROFILE_DIR || './bot-profile');
  const storagePath = path.join(baseProfileDir, 'storage.json');

  // Interactive login session: uses persistent context for permanent Google credentials capture
  if (meetingId === 'login-session') {
    if (!fs.existsSync(baseProfileDir)) {
      fs.mkdirSync(baseProfileDir, { recursive: true });
    }
    const context = await chromium.launchPersistentContext(baseProfileDir, {
      headless: isHeadless,
      args: [...SPECTRA_JOIN_BROWSER_ARGS],
      channel: 'chrome',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
    });
    return { context, profileDir: baseProfileDir };
  }

  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    const baseOptions = {
      headless: isHeadless,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [...SPECTRA_JOIN_BROWSER_ARGS],
    };
    try {
      sharedBrowser = await chromium.launch({ ...baseOptions, channel: 'chrome' });
    } catch {
      sharedBrowser = await chromium.launch(baseOptions);
    }
  }

  const contextOptions: any = {
    permissions: ['microphone', 'camera'],
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  };

  // If saved Google account session state exists in bot-profile, attach it to authenticate bot
  if (fs.existsSync(storagePath)) {
    contextOptions.storageState = storagePath;
  }

  // Create isolated, in-memory browser context per meeting session to eliminate cross-meeting state bleed
  const context: BrowserContext = await sharedBrowser.newContext(contextOptions);

  // Ensure bot never exposes synthetic green test video to meetings
  await context.addInitScript(() => {
    try {

      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const origEnumerate = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
        navigator.mediaDevices.enumerateDevices = async () => {
          const devices = await origEnumerate();
          return devices.filter((d) => d.kind !== 'videoinput');
        };
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          if (constraints && typeof constraints === 'object') {
            if (constraints.video) {
              constraints.video = false;
            }
          }
          if (!constraints || (!constraints.audio && !constraints.video)) {
            const err = new Error('Requested device not found');
            err.name = 'NotFoundError';
            throw err;
          }
          const stream = await origGUM(constraints);
          // Disable outgoing microphone tracks so bot never transmits audio
          if (stream && stream.getAudioTracks) {
            stream.getAudioTracks().forEach((t) => {
              t.enabled = false;
            });
          }
          return stream;
        };
      }
    } catch {}
  });

  return { context, profileDir: '' };
}

export function cleanupProfileDir(profileDir: string): void {
  try {
    if (profileDir && fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  } catch {}
}
