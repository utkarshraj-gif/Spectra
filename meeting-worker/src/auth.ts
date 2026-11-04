import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import type { BrowserContext } from 'playwright';

const workerDir = fileURLToPath(new URL('../', import.meta.url));

export function getBotProfileDir(): string {
  return path.resolve(workerDir, process.env.BOT_PROFILE_DIR || 'bot-profile');
}

export function getStoragePath(): string {
  return path.join(getBotProfileDir(), 'storage.json');
}

export async function hasGoogleSession(context: BrowserContext): Promise<boolean> {
  const cookies = await context.cookies('https://meet.google.com');
  return cookies.some(cookie =>
    /^(SID|__Secure-[13]PSID)$/.test(cookie.name) && cookie.value.length > 0 &&
    (cookie.expires === -1 || cookie.expires > Date.now() / 1000)
  );
}

export async function saveGoogleSession(context: BrowserContext): Promise<string> {
  if (!await hasGoogleSession(context)) {
    throw new Error('No Google sign-in session found. Complete sign-in and open Google Meet before saving.');
  }
  const storagePath = getStoragePath();
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  const temporaryPath = `${storagePath}.${process.pid}.tmp`;
  try {
    await context.storageState({ path: temporaryPath });
    await fs.rename(temporaryPath, storagePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
  return storagePath;
}

export async function saveGoogleSessionWhenReady(context: BrowserContext, timeoutMs: number): Promise<string> {
  const closed = new AbortController();
  const onClose = () => closed.abort();
  context.once('close', onClose);
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline && !closed.signal.aborted) {
      const meetIsOpen = context.pages().some(page => {
        try { return new URL(page.url()).hostname === 'meet.google.com'; }
        catch { return false; }
      });
      if (meetIsOpen && await hasGoogleSession(context)) return await saveGoogleSession(context);
      await delay(250, undefined, { signal: closed.signal }).catch(error => {
        if (!closed.signal.aborted) throw error;
      });
    }
    throw new Error(closed.signal.aborted
      ? 'Chrome closed before the session was saved. Run login again and leave Chrome open until sign-in completes.'
      : 'Sign-in was not completed in time. Run login again.');
  } finally {
    context.off('close', onClose);
  }
}
