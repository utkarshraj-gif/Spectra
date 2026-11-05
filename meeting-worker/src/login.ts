import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { getBotProfileDir, getStoragePath, saveGoogleSessionWhenReady } from './auth.js';

async function findChrome(): Promise<string> {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  for (const candidate of candidates) {
    if (candidate && await fs.access(candidate).then(() => true, () => false)) return candidate;
  }
  throw new Error('Google Chrome was not found. Install Chrome or set CHROME_PATH to its executable.');
}

async function loginProvision(): Promise<void> {
  console.log('\nSpectra Google account login');
  console.log(`Session will be saved to: ${getStoragePath()}`);
  const chromePath = await findChrome();
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a Chrome debugging port.');
  const endpoint = `http://127.0.0.1:${address.port}`;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await fs.mkdir(getBotProfileDir(), { recursive: true });
  // Each provisioner owns its Chrome profile; meeting workers only read storage.json.
  const loginProfile = await fs.mkdtemp(path.join(getBotProfileDir(), 'login-'));
  const child = spawn(chromePath, [
    `--user-data-dir=${loginProfile}`,
    `--remote-debugging-port=${address.port}`,
    '--remote-debugging-address=127.0.0.1',
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fmeet.google.com%2F',
  ], { stdio: 'ignore', windowsHide: false });
  let launchError: Error | undefined;
  child.on('error', error => { launchError = error; });
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined;
  try {
    console.log('Opening a regular Chrome window. Sign in with the Google account the bot should use.');
    const deadline = Date.now() + 30_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (child.exitCode !== null) throw new Error(`Chrome exited with code ${child.exitCode}.`);
      ready = await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(1000) })
        .then(response => response.ok, () => false);
      if (ready) break;
      await delay(200);
    }
    if (!ready) throw new Error('Chrome did not start within 30 seconds. Run this command in PowerShell on your Windows desktop.');
    browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    if (!context) throw new Error('Chrome did not provide a browser context.');

    console.log('Complete Google sign-in and open Google Meet. Leave Chrome open; the session will save automatically.');
    const storagePath = await saveGoogleSessionWhenReady(context, 15 * 60_000);
    console.log(`Google session saved to ${storagePath}. New bot sessions will load it automatically.`);
  } finally {
    if (browser?.isConnected()) {
      const cdp = await browser.newBrowserCDPSession().catch(() => undefined);
      await cdp?.send('Browser.close').catch(() => {});
      await browser.close().catch(() => {});
    }
    if (child.exitCode === null) {
      await Promise.race([new Promise<void>(resolve => child.once('exit', () => resolve())), delay(3000)]);
    }
    if (child.exitCode === null) child.kill();
    await fs.rm(loginProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      .catch(() => console.warn(`Chrome profile remains at ${loginProfile}; close its Chrome window before removing it.`));
  }
}

loginProvision().catch(error => {
  console.error('Login failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
