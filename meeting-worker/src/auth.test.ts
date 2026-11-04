import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { getBotProfileDir, getStoragePath, hasGoogleSession, saveGoogleSession, saveGoogleSessionWhenReady } from './auth.js';
import { createMeetingContext } from './browser.js';

const originalCwd = process.cwd();
const originalProfile = process.env.BOT_PROFILE_DIR;
const temporaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spectra-auth-test-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  delete process.env.BOT_PROFILE_DIR;
  const expectedProfile = fileURLToPath(new URL('../bot-profile', import.meta.url));
  assert.equal(getBotProfileDir(), expectedProfile);
  process.chdir(temporaryDir);
  assert.equal(getBotProfileDir(), expectedProfile, 'Default profile must not change with terminal working directory');
  process.env.BOT_PROFILE_DIR = 'custom-profile';
  assert.equal(getBotProfileDir(), fileURLToPath(new URL('../custom-profile', import.meta.url)));
  process.env.BOT_PROFILE_DIR = path.join(temporaryDir, 'profile');
  const context = await browser.newContext();
  assert.equal(await hasGoogleSession(context), false);
  await assert.rejects(saveGoogleSession(context), /No Google sign-in session/);
  await assert.rejects(fs.access(getStoragePath()), /ENOENT/);

  await context.addCookies([{
    name: '__Secure-1PSID', value: 'synthetic-regression-cookie', domain: '.google.com',
    path: '/', secure: true, httpOnly: true, expires: Date.now() / 1000 + 3600,
  }]);
  assert.equal(await hasGoogleSession(context), true);
  await saveGoogleSession(context);
  const firstSave = await fs.readFile(getStoragePath(), 'utf8');
  await context.clearCookies();
  await assert.rejects(saveGoogleSession(context), /No Google sign-in session/);
  assert.equal(await fs.readFile(getStoragePath(), 'utf8'), firstSave, 'Failed login must preserve existing state');

  const automaticSave = saveGoogleSessionWhenReady(context, 10_000);
  const loginPage = await context.newPage();
  await context.route('https://meet.google.com/**', route => route.fulfill({ body: '<h1>Meet test fixture</h1>' }));
  await loginPage.goto('https://meet.google.com/');
  assert.equal(await fs.readFile(getStoragePath(), 'utf8'), firstSave, 'An unsigned Meet page must not overwrite the session');
  await context.addCookies([{
    name: '__Secure-1PSID', value: 'synthetic-regression-cookie', domain: '.google.com',
    path: '/', secure: true, httpOnly: true, expires: Date.now() / 1000 + 3600,
  }]);
  assert.equal(await automaticSave, getStoragePath(), 'Sign-in must save automatically without terminal input');
  const cancelledContext = await browser.newContext();
  const cancelledSave = assert.rejects(saveGoogleSessionWhenReady(cancelledContext, 10_000), /Chrome closed before/);
  await cancelledContext.close();
  await cancelledSave;

  const meeting = await createMeetingContext('auth-regression', { headless: true });
  try {
    assert.equal(await hasGoogleSession(meeting.context), true, 'Worker must restore exported Google cookies');
    const cookies = await meeting.context.cookies('https://meet.google.com');
    assert.equal(cookies.find(cookie => cookie.name === '__Secure-1PSID')?.value, 'synthetic-regression-cookie');
    await saveGoogleSession(meeting.context);
    const secondMeeting = await createMeetingContext('auth-isolation-regression', { headless: true });
    try {
      await meeting.context.clearCookies();
      assert.equal(await hasGoogleSession(secondMeeting.context), true, 'Meetings must retain isolated state');
    } finally {
      await secondMeeting.context.close();
    }
  } finally {
    await meeting.context.browser()?.close();
  }
  console.log('Auth regression checks passed: stable paths, explicit save, preserved state, worker restore, context isolation.');
} finally {
  await browser.close();
  process.chdir(originalCwd);
  if (originalProfile === undefined) delete process.env.BOT_PROFILE_DIR;
  else process.env.BOT_PROFILE_DIR = originalProfile;
  await fs.rm(temporaryDir, { recursive: true, force: true, maxRetries: 3 });
}
