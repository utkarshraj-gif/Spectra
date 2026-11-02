/**
 * capture-manager.ts — Enterprise-grade Web Audio Worklet capture manager for Google Meet.
 */

import path from 'path';
import type { Page } from 'playwright';
import { WORKLET_SOURCE_CODE, PCM_WORKLET_NAME, TARGET_SAMPLE_RATE } from './pcm-worklet.js';
import { float32ToInt16Pcm, WavFileWriter } from './wav.js';

export interface AudioCaptureOptions {
  meetingId: string;
  outputDirectory?: string;
  silenceThreshold?: number; // Minimum RMS amplitude (e.g. 0.003) to filter out background noise
  onPcmChunk?: (chunk: { streamIndex: number; pcmBuffer: Buffer; timestamp: number }) => void;
}

export interface AudioCaptureSession {
  stop(): Promise<string>;
  getRecordedSeconds(): number;
  getTrackCount(): number;
}

export async function startMeetingAudioCapture(
  page: Page,
  options: AudioCaptureOptions
): Promise<AudioCaptureSession> {
  const meetingId = options.meetingId;
  const outDir = options.outputDirectory || path.resolve(process.cwd(), '../recordings');
  const filePath = path.join(outDir, `${meetingId}.wav`);
  const wavWriter = new WavFileWriter(filePath);
  const silenceThreshold = options.silenceThreshold ?? 0.003;

  let streamCount = 0;
  let totalChunksReceived = 0;
  let activeChunksEmitted = 0;
  let isRunning = true;

  console.log(`[AudioCapture] Initializing Web Audio Worklet capture for meeting ${meetingId}`);
  console.log(`[AudioCapture] Target recording path: ${filePath}`);

  // 1. Expose real-time PCM bridge function from browser page to Node.js
  const bridgeFunctionName = `__spectraAudioBridge_${meetingId.replace(/[^a-zA-Z0-9]/g, '_')}`;

  await page.exposeFunction(
    bridgeFunctionName,
    (streamIndex: number, base64Data: string, rms: number) => {
      if (!isRunning) return;
      totalChunksReceived++;

      try {
        const rawBuf = Buffer.from(base64Data, 'base64');
        const floatArray = new Float32Array(rawBuf.buffer, rawBuf.byteOffset, rawBuf.length / 4);

        // Convert Float32 to 16-bit Linear PCM
        const int16Buffer = float32ToInt16Pcm(floatArray);

        // Write to WAV file
        wavWriter.writePcmChunk(int16Buffer);
        activeChunksEmitted++;

        if (options.onPcmChunk) {
          options.onPcmChunk({
            streamIndex,
            pcmBuffer: int16Buffer,
            timestamp: Date.now(),
          });
        }

        if (activeChunksEmitted === 1 || activeChunksEmitted % 50 === 0) {
          console.log(
            `[AudioCapture] Stream #${streamIndex} active speech (RMS: ${rms.toFixed(4)}), recorded: ${(wavWriter.getTotalBytes() / (16000 * 2)).toFixed(1)}s`
          );
        }
      } catch (err) {
        console.error(`[AudioCapture] Error processing audio chunk:`, err);
      }
    }
  );

  // 2. Inject the AudioWorklet runner into the page context as clean self-contained JS
  // (Prevents tsx/esbuild bundler __name helper injection inside browser context)
  const injectionScript = `
    (async function(opts) {
      const g = window;
      g.__spectraCaptureRunning = true;
      g.__spectraConnectedStreams = new Set();
      g.__spectraContexts = [];

      const blob = new Blob([opts.workletCode], { type: 'application/javascript' });
      const workletBlobUrl = URL.createObjectURL(blob);

      function findMediaElements() {
        return Array.from(document.querySelectorAll('audio, video')).filter(function(el) {
          return (
            el.srcObject instanceof MediaStream &&
            el.srcObject.getAudioTracks().length > 0
          );
        });
      }

      async function connectStreamElement(el, index) {
        try {
          const stream = el.srcObject;
          if (!stream || stream.getAudioTracks().length === 0) return false;

          const streamId = stream.id;
          if (g.__spectraConnectedStreams.has(streamId)) return false;

          const ctx = new AudioContext({ sampleRate: opts.sampleRate });
          if (ctx.state === 'suspended') {
            await ctx.resume().catch(function() {});
          }

          await ctx.audioWorklet.addModule(workletBlobUrl);

          const source = ctx.createMediaStreamSource(stream);
          const workletNode = new AudioWorkletNode(ctx, opts.workletName, {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            channelCount: 1,
          });

          workletNode.port.onmessage = function(e) {
            if (!g.__spectraCaptureRunning) return;
            const pcmFloat32 = e.data;

            let sum = 0;
            for (let i = 0; i < pcmFloat32.length; i++) {
              sum += pcmFloat32[i] * pcmFloat32[i];
            }
            const rms = Math.sqrt(sum / pcmFloat32.length);

            if (rms > opts.silenceCutoff) {
              const bytes = new Uint8Array(
                pcmFloat32.buffer,
                pcmFloat32.byteOffset,
                pcmFloat32.byteLength
              );
              let binary = '';
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64 = btoa(binary);

              if (typeof g[opts.bridgeName] === 'function') {
                g[opts.bridgeName](index, base64, rms);
              }
            }
          };

          source.connect(workletNode);
          workletNode.connect(ctx.destination);

          g.__spectraConnectedStreams.add(streamId);
          g.__spectraContexts.push(ctx);

          console.log('[SpectraWebAudio] Connected audio stream #' + index + ' (' + streamId + ')');
          return true;
        } catch (err) {
          console.error('[SpectraWebAudio] Error connecting stream element:', err);
          return false;
        }
      }

      let streamIndex = 0;

      async function scanAndConnect() {
        if (!g.__spectraCaptureRunning) return;
        const elements = findMediaElements();
        for (let i = 0; i < elements.length; i++) {
          const connected = await connectStreamElement(elements[i], streamIndex);
          if (connected) streamIndex++;
        }
      }

      await scanAndConnect();
      g.__spectraScanInterval = setInterval(scanAndConnect, 8000);
    })(${JSON.stringify({
      workletCode: WORKLET_SOURCE_CODE,
      workletName: PCM_WORKLET_NAME,
      bridgeName: bridgeFunctionName,
      sampleRate: TARGET_SAMPLE_RATE,
      silenceCutoff: silenceThreshold,
    })});
  `;

  await page.evaluate(injectionScript);

  return {
    async stop(): Promise<string> {
      if (!isRunning) return filePath;
      isRunning = false;

      console.log(`[AudioCapture] Stopping audio capture session for ${meetingId}...`);

      // Teardown browser side AudioContexts cleanly
      try {
        await page.evaluate(`
          (function() {
            const g = window;
            g.__spectraCaptureRunning = false;
            if (g.__spectraScanInterval) clearInterval(g.__spectraScanInterval);
            if (Array.isArray(g.__spectraContexts)) {
              for (let i = 0; i < g.__spectraContexts.length; i++) {
                try {
                  g.__spectraContexts[i].close();
                } catch (e) {}
              }
            }
          })()
        `);
      } catch {
        // Page may already be navigating or closed
      }

      await wavWriter.close();
      const recordedSeconds = wavWriter.getTotalBytes() / (TARGET_SAMPLE_RATE * 2);
      console.log(
        `[AudioCapture] Recording finalized: ${filePath} (${recordedSeconds.toFixed(1)}s, ${wavWriter.getTotalBytes()} bytes)`
      );

      return filePath;
    },

    getRecordedSeconds(): number {
      return wavWriter.getTotalBytes() / (TARGET_SAMPLE_RATE * 2);
    },

    getTrackCount(): number {
      return streamCount;
    },
  };
}
