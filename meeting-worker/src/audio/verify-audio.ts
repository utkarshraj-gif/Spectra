/**
 * verify-audio.ts — Verification harness for Spectra Enterprise Audio Capture.
 * Validates PCM conversions, WAV headers, silence gating, and live AudioWorklet streaming.
 */

import fs from 'fs';
import path from 'path';
// @ts-ignore
import { chromium } from 'playwright';
import {
  calculateRms,
  float32ToInt16Pcm,
  createWavHeader,
  WavFileWriter,
  startMeetingAudioCapture,
  validateWavFile,
  isFFmpegAvailable,
} from './index.js';

async function runVerification() {
  console.log('====================================================');
  console.log(' SPECTRA ENTERPRISE AUDIO CAPTURE VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  // --- TEST 1: Float32 to Int16 Conversion & Clipping ---
  console.log('\n--- 1. Testing Float32 -> Int16 PCM Conversion ---');
  const testFloats = new Float32Array([-1.0, -0.5, 0.0, 0.5, 1.0, 1.5, -1.5]);
  const int16Buf = float32ToInt16Pcm(testFloats);

  assert(int16Buf.length === testFloats.length * 2, 'Buffer size matches (2 bytes per sample)');
  assert(int16Buf.readInt16LE(0) === -32768, 'Min sample -1.0 maps to -32768');
  assert(int16Buf.readInt16LE(4) === 0, 'Zero sample 0.0 maps to 0');
  assert(int16Buf.readInt16LE(8) === 32767, 'Max sample 1.0 maps to 32767');
  assert(int16Buf.readInt16LE(10) === 32767, 'Positive clipping (>1.0) clamped to 32767');
  assert(int16Buf.readInt16LE(12) === -32768, 'Negative clipping (<-1.0) clamped to -32768');

  // --- TEST 2: RMS Calculation ---
  console.log('\n--- 2. Testing RMS Silence Gating ---');
  const silence = new Float32Array(4096).fill(0.0);
  const rmsSilence = calculateRms(silence);
  assert(rmsSilence === 0, 'Perfect silence yields 0.0 RMS');

  const loud = new Float32Array(4096).fill(0.5);
  const rmsLoud = calculateRms(loud);
  assert(Math.abs(rmsLoud - 0.5) < 0.0001, 'Loud signal yields exact 0.5 RMS');

  // --- TEST 3: WAV Header Generation ---
  console.log('\n--- 3. Testing 44-byte RIFF/WAVE Header Generation ---');
  const testDataLen = 32000; // 1 second of 16kHz 16-bit mono
  const wavHeader = createWavHeader(testDataLen, 16000, 1, 16);

  assert(wavHeader.length === 44, 'Header length is exactly 44 bytes');
  assert(wavHeader.toString('ascii', 0, 4) === 'RIFF', 'RIFF magic identifier matches');
  assert(wavHeader.readUInt32LE(4) === 36 + testDataLen, 'RIFF chunk size calculation is correct');
  assert(wavHeader.toString('ascii', 8, 12) === 'WAVE', 'WAVE format identifier matches');
  assert(wavHeader.toString('ascii', 12, 16) === 'fmt ', 'fmt subchunk identifier matches');
  assert(wavHeader.readUInt16LE(20) === 1, 'AudioFormat is 1 (PCM)');
  assert(wavHeader.readUInt16LE(22) === 1, 'Channel count is 1 (Mono)');
  assert(wavHeader.readUInt32LE(24) === 16000, 'Sample rate is 16000 Hz');
  assert(wavHeader.readUInt32LE(28) === 32000, 'Byte rate is 32000 bytes/sec');
  assert(wavHeader.readUInt16LE(32) === 2, 'Block align is 2 bytes');
  assert(wavHeader.readUInt16LE(34) === 16, 'Bits per sample is 16');
  assert(wavHeader.toString('ascii', 36, 40) === 'data', 'data subchunk identifier matches');
  assert(wavHeader.readUInt32LE(40) === testDataLen, 'Data size matches 32000 bytes');

  // --- TEST 4: Live AudioWorklet & MediaStream Integration Test in Playwright ---
  console.log('\n--- 4. Live Browser AudioWorklet Stream Capture in Playwright ---');

  const testMeetingId = `verify_meeting_${Date.now()}`;
  const testOutputDir = path.resolve(process.cwd(), 'temp-verify-recordings');

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('  [BROWSER CONSOLE]', msg.text()));
  page.on('pageerror', (err) => console.error('  [BROWSER ERROR]', err));

  // Spin up lightweight local HTTP server (localhost is recognized as a Secure Context by Chromium for AudioWorklet)
  const http = await import('http');
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><title>Web Audio Test</title></head>
        <body>
          <h1>Testing Web Audio Worklet Capture</h1>
          <audio id="test-audio" autoplay></audio>
          <script>
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime);

            const dest = ctx.createMediaStreamDestination();
            osc.connect(dest);
            osc.start();

            const audioEl = document.getElementById('test-audio');
            audioEl.srcObject = dest.stream;
            audioEl.play().catch(() => {});
          </script>
        </body>
      </html>
    `);
  });

  await new Promise<void>((resolve) => server.listen(8999, '127.0.0.1', () => resolve()));

  await page.goto('http://127.0.0.1:8999');

  let chunksReceived = 0;

  const captureSession = await startMeetingAudioCapture(page, {
    meetingId: testMeetingId,
    outputDirectory: testOutputDir,
    silenceThreshold: 0.001,
    onPcmChunk: () => {
      chunksReceived++;
    },
  });

  // Let the AudioWorklet stream 440Hz sine wave audio chunks for 2.5 seconds
  await new Promise((r) => setTimeout(r, 2500));

  const savedFile = await captureSession.stop();
  await browser.close();
  server.close();

  assert(chunksReceived > 0, `AudioWorklet successfully streamed ${chunksReceived} PCM chunks across the bridge`);
  assert(fs.existsSync(savedFile), `WAV recording exists at ${savedFile}`);

  const stat = fs.statSync(savedFile);
  assert(stat.size > 44, `Recorded WAV file size (${stat.size} bytes) is greater than empty header`);

  // Verify the header of the saved file
  const recordedBuf = fs.readFileSync(savedFile);
  assert(recordedBuf.toString('ascii', 0, 4) === 'RIFF', 'Recorded file has valid RIFF header');
  assert(recordedBuf.readUInt32LE(24) === 16000, 'Recorded file is 16kHz sample rate');

  console.log('\n--- 5. Testing Audio File Validator & Probe ---');
  const validRes = await validateWavFile(savedFile, 0.1);
  assert(validRes.valid === true, 'validateWavFile succeeds on valid recorded WAV');
  assert(validRes.sampleRate === 16000, 'Validated sample rate is 16000 Hz');
  assert(validRes.channels === 1, 'Validated channel count is 1 (Mono)');
  assert(validRes.durationSeconds > 0.1, 'Validated duration exceeds 0.1s');

  const nonExistentRes = await validateWavFile(path.join(testOutputDir, 'missing.wav'));
  assert(nonExistentRes.valid === false, 'validateWavFile fails safely on missing file');

  const corruptPath = path.join(testOutputDir, 'corrupt.wav');
  fs.writeFileSync(corruptPath, Buffer.from([1, 2, 3, 4]));
  const corruptRes = await validateWavFile(corruptPath);
  assert(corruptRes.valid === false, 'validateWavFile fails safely on truncated <44-byte file');

  const ffmpegCheck = await isFFmpegAvailable();
  assert(typeof ffmpegCheck === 'boolean', `isFFmpegAvailable returns boolean (result: ${ffmpegCheck})`);

  // Clean up test file and directory
  try {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  } catch {}

  console.log('\n====================================================');
  console.log(` RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('====================================================');

  if (passed === total) {
    console.log('\n🎉 ALL ENTERPRISE AUDIO CAPTURE CHECKS PASSED!\n');
    process.exit(0);
  } else {
    console.error('\n❌ SOME CHECKS FAILED!\n');
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
