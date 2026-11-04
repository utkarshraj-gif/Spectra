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
  '--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor',
  '--disable-site-isolation-trials',
  '--disable-infobars',
  '--disable-notifications',
  '--use-fake-ui-for-media-stream',
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

export async function prewarmBrowserContext(options?: CreateMeetingContextOptions): Promise<void> {
  try {
    const isHeadless = options?.headless !== undefined ? options.headless : config.headless;
    const testDir = path.resolve(process.env.BOT_PROFILE_DIR || './bot-profile', 'prewarm');
    fs.mkdirSync(testDir, { recursive: true });
    const ctx = await chromium.launchPersistentContext(testDir, {
      headless: isHeadless,
      args: [...SPECTRA_JOIN_BROWSER_ARGS],
    });
    await ctx.close().catch(() => {});
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('[Browser] Chrome binary verified and pre-warmed for instant join');
  } catch (err) {
    console.warn('[Browser] Chrome pre-warming warning:', err);
  }
}

export async function createMeetingContext(
  meetingId: string,
  options?: CreateMeetingContextOptions
): Promise<{ context: BrowserContext; profileDir: string }> {
  // Dedicated session profile directory for complete process and session isolation
  const baseProfileDir = path.resolve(process.env.BOT_PROFILE_DIR || './bot-profile');
  const safeMeetingId = meetingId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const profileDir = path.join(baseProfileDir, `session-${safeMeetingId}`);

  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const isHeadless = options?.headless !== undefined ? options.headless : config.headless;

  const baseOptions = {
    headless: isHeadless,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [...SPECTRA_JOIN_BROWSER_ARGS],
    permissions: ['microphone'] as string[],
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  };

  let context: BrowserContext;

  try {
    // Attempt with system Google Chrome channel first
    context = await chromium.launchPersistentContext(profileDir, {
      ...baseOptions,
      channel: 'chrome',
    });
  } catch {
    // Fallback to bundled Chromium (e.g. inside Docker container)
    context = await chromium.launchPersistentContext(profileDir, baseOptions);
  }

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
          return origGUM(constraints);
        };
      }
    } catch {}
  });

  return { context, profileDir };
}

export function cleanupProfileDir(profileDir: string): void {
  try {
    if (profileDir && profileDir.includes('session-') && fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn(`[Browser] Warning cleaning up profile dir ${profileDir}:`, err);
  }
}
