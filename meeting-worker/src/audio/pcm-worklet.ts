/**
 * pcm-worklet.ts — Dedicated AudioWorklet processor for enterprise 16kHz PCM audio capture.
 * Runs on the browser's dedicated audio render thread (immune to main-thread UI/DOM load).
 */

export const PCM_BLOCK_SIZE = 4096;
export const TARGET_SAMPLE_RATE = 16000;
export const PCM_WORKLET_NAME = 'spectra-pcm-capture';

/**
 * AudioWorkletProcessor script executed in the AudioWorkletGlobalScope.
 * Authoritative source: downmixes channel 0 to fixed 4096-sample Float32 blocks at 16 kHz.
 */
export const WORKLET_SOURCE_CODE = `
class SpectraPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(${PCM_BLOCK_SIZE});
    this._index = 0;
  }

  process(inputs) {
    const channelData = inputs[0] && inputs[0][0];
    if (!channelData) return true;

    for (let i = 0; i < channelData.length; i++) {
      this._buffer[this._index++] = channelData[i];
      if (this._index === ${PCM_BLOCK_SIZE}) {
        // Send block to main thread
        this.port.postMessage(this._buffer);
        this._buffer = new Float32Array(${PCM_BLOCK_SIZE});
        this._index = 0;
      }
    }
    return true;
  }
}
registerProcessor('${PCM_WORKLET_NAME}', SpectraPcmCaptureProcessor);
`;

