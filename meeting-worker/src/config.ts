export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  defaultBotName: process.env.BOT_NAME || 'Spectra Assistant (Recording)',
  headless: process.env.HEADLESS !== 'false',
  recordingsPath: process.env.RECORDINGS_PATH || './recordings',
  admissionTimeoutMs: parseInt(process.env.ADMISSION_TIMEOUT_MS || '300000', 10), // 5 minutes
  soloMeetingTimeoutMs: parseInt(process.env.SOLO_TIMEOUT_MS || '60000', 10), // 1 minute alone
  navigationTimeoutMs: parseInt(process.env.NAVIGATION_TIMEOUT_MS || '45000', 10), // 45 seconds
};

