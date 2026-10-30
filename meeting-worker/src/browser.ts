import fs from 'fs';
import path from 'path';
import type { BrowserContext } from 'playwright';
// @ts-ignore
import { chromium } from 'playwright-extra';
// @ts-ignore
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from './config.js';

// Configure stealth evasions exactly as verified in Vexa (Pack F / issue #856)
const stealth = StealthPlugin();
stealth.enabledEvasions.delete('iframe.contentWindow');
stealth.enabledEvasions.delete('media.codecs');
stealth.enabledEvasions.delete('user-agent-override');
chromium.use(stealth);

// Canonical browser args ported from Vexa's core/meetings/modules/join/src/browser-args.ts
export const VEXA_JOIN_BROWSER_ARGS: readonly string[] = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor',
  '--disable-site-isolation-trials',
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

export async function createMeetingContext(meetingId: string): Promise<{ context: BrowserContext; profileDir: string }> {
  // Durable persistent profile directory (matching Vexa's durable session pattern)
  const profileDir = path.resolve(process.env.BOT_PROFILE_DIR || './bot-profile');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const baseOptions = {
    headless: config.headless,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [...VEXA_JOIN_BROWSER_ARGS],
    permissions: ['microphone', 'camera'] as string[],
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

  return { context, profileDir };
}

export function cleanupProfileDir(profileDir: string): void {
  // Preserved for durable Google session cookies
}
