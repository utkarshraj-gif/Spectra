export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  defaultBotName: process.env.BOT_NAME || 'Spectra Assistant (Recording)',
  get headless(): boolean {
    return process.env.HEADLESS !== 'false';
  },
  recordingsPath: process.env.RECORDINGS_PATH || './recordings',
  admissionTimeoutMs: parseInt(process.env.ADMISSION_TIMEOUT_MS || '300000', 10), // 5 minutes
  soloMeetingTimeoutMs: parseInt(process.env.SOLO_TIMEOUT_MS || '90000', 10), // 90 seconds
  loneBotTimeoutMs: parseInt(process.env.LONE_BOT_TIMEOUT_MS || '90000', 10), // 90 seconds
  maxSessionDurationMs: parseInt(process.env.MAX_SESSION_DURATION_MS || '10800000', 10), // 3 hours
  maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10), // max 5 concurrent meetings
  navigationTimeoutMs: parseInt(process.env.NAVIGATION_TIMEOUT_MS || '45000', 10), // 45 seconds
  aiServiceWsUrl: process.env.AI_SERVICE_WS_URL || 'ws://127.0.0.1:8000',
};
