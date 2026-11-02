import fs from 'fs';

export interface AudioValidationResult {
  valid: boolean;
  filePath: string;
  fileSizeBytes: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  error?: string;
}

/**
 * Validates a recorded WAV file to ensure header conformity, PCM integrity,
 * and valid non-corrupted audio payloads.
 */
export async function validateWavFile(
  filePath: string,
  minDurationSeconds = 0.5
): Promise<AudioValidationResult> {
  const result: AudioValidationResult = {
    valid: false,
    filePath,
    fileSizeBytes: 0,
    durationSeconds: 0,
    sampleRate: 0,
    channels: 0,
    bitsPerSample: 0,
  };

  try {
    if (!fs.existsSync(filePath)) {
      result.error = `File does not exist: ${filePath}`;
      return result;
    }

    const stat = await fs.promises.stat(filePath);
    result.fileSizeBytes = stat.size;

    if (stat.size < 44) {
      result.error = `File size (${stat.size} bytes) is too small to contain a valid 44-byte RIFF/WAVE header`;
      return result;
    }

    const header = Buffer.alloc(44);
    const fd = await fs.promises.open(filePath, 'r');
    try {
      await fd.read(header, 0, 44, 0);
    } finally {
      await fd.close();
    }

    // 1. Verify RIFF Magic
    const riff = header.toString('ascii', 0, 4);
    if (riff !== 'RIFF') {
      result.error = `Invalid RIFF identifier: '${riff}'`;
      return result;
    }

    // 2. Verify WAVE format
    const wave = header.toString('ascii', 8, 12);
    if (wave !== 'WAVE') {
      result.error = `Invalid WAVE format: '${wave}'`;
      return result;
    }

    // 3. Verify fmt subchunk
    const fmt = header.toString('ascii', 12, 16);
    if (fmt !== 'fmt ') {
      result.error = `Invalid fmt subchunk identifier: '${fmt}'`;
      return result;
    }

    // 4. Verify Audio Format (1 = PCM)
    const audioFormat = header.readUInt16LE(20);
    if (audioFormat !== 1) {
      result.error = `Unsupported audio format: ${audioFormat} (expected 1 for Linear PCM)`;
      return result;
    }

    // 5. Read Audio Properties
    result.channels = header.readUInt16LE(22);
    result.sampleRate = header.readUInt32LE(24);
    const byteRate = header.readUInt32LE(28);
    const blockAlign = header.readUInt16LE(32);
    result.bitsPerSample = header.readUInt16LE(34);

    // 6. Verify data subchunk
    const dataMagic = header.toString('ascii', 36, 40);
    if (dataMagic !== 'data') {
      result.error = `Invalid data subchunk identifier: '${dataMagic}'`;
      return result;
    }

    const dataSize = header.readUInt32LE(40);
    if (dataSize <= 0) {
      result.error = `WAV data chunk contains 0 bytes of audio payload`;
      return result;
    }

    // Check expected byte rates
    const expectedByteRate = result.sampleRate * result.channels * (result.bitsPerSample / 8);
    if (byteRate !== expectedByteRate) {
      result.error = `Mismatched byte rate: ${byteRate} (expected ${expectedByteRate})`;
      return result;
    }

    result.durationSeconds = dataSize / expectedByteRate;

    if (result.durationSeconds < minDurationSeconds) {
      result.error = `Audio duration (${result.durationSeconds.toFixed(2)}s) is below required minimum threshold (${minDurationSeconds}s)`;
      return result;
    }

    result.valid = true;
    return result;
  } catch (err: unknown) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

