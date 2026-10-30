import fs from 'fs';
import path from 'path';
import { chromium, BrowserContext } from 'playwright';
import { config } from './config.js';

export const BROWSER_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--disable-notifications',
  '--disable-infobars',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--window-size=1280,720',
  '--autoplay-policy=no-user-gesture-required',
];

export async function createMeetingContext(meetingId: string): Promise<{ context: BrowserContext; profileDir: string }> {
  // Durable persistent profile directory (matching Vexa's durable session pattern)
  // Preserves Google session cookies and device trust across restarts
  const profileDir = path.resolve(process.env.BOT_PROFILE_DIR || './bot-profile');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const baseOptions = {
    headless: config.headless,
    ignoreDefaultArgs: ['--enable-automation'],
    args: BROWSER_ARGS,
    permissions: ['microphone', 'camera'] as string[],
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  };

  let context: BrowserContext;

  try {
    // Priority: system Google Chrome channel
    context = await chromium.launchPersistentContext(profileDir, {
      ...baseOptions,
      channel: 'chrome',
    });
  } catch {
    // Fallback: bundled Chromium (Docker Linux)
    context = await chromium.launchPersistentContext(profileDir, baseOptions);
  }

  // Stealth script to remove automation traces
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // @ts-ignore
    window.chrome = {
      runtime: {},
      loadTimes: function () {},
      csi: function () {},
      app: {},
    };

    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  return { context, profileDir };
}

export function cleanupProfileDir(profileDir: string): void {
  // Do NOT wipe the durable profile - cookies and Google session must persist like in Vexa!
}
