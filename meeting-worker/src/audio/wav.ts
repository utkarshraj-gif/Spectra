/**
 * wav.ts — Audio conversion utilities for 16kHz 16-bit Linear PCM & WAV file formatting.
 */

import fs from 'fs';
import path from 'path';

/**
 * Calculates Root Mean Square (RMS) energy level of a Float32 audio chunk.
 * Used for enterprise silence gating.
 */
export function calculateRms(floatPcm: Float32Array): number {
  if (floatPcm.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < floatPcm.length; i++) {
    sum += floatPcm[i] * floatPcm[i];
  }
  return Math.sqrt(sum / floatPcm.length);
}

/**
 * Converts Float32 audio samples [-1.0, 1.0] to 16-bit signed integer Linear PCM Buffer (Little-Endian).
 */
export function float32ToInt16Pcm(floatPcm: Float32Array): Buffer {
  const int16Buf = Buffer.alloc(floatPcm.length * 2);
  for (let i = 0; i < floatPcm.length; i++) {
    // Clamping to [-1.0, 1.0]
    const s = Math.max(-1, Math.min(1, floatPcm[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    int16Buf.writeInt16LE(Math.floor(val), i * 2);
  }
  return int16Buf;
}

/**
 * Creates standard 44-byte RIFF/WAVE header for Linear PCM.
 */
export function createWavHeader(
  dataLength: number,
  sampleRate = 16000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4); // File size - 8
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(byteRate, 28); // ByteRate
  header.writeUInt16LE(blockAlign, 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40); // Subchunk2Size (data length)

  return header;
}

/**
 * AudioFileWriter handles writing live incoming PCM chunks to a durable .wav file.
 */
export class WavFileWriter {
  public readonly filePath: string;
  private writeStream: fs.WriteStream | null = null;
  private totalDataBytes = 0;
  private isClosed = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.writeStream = fs.createWriteStream(this.filePath);
    // Write placeholder 44-byte header; will update with exact byte size on close
    this.writeStream.write(createWavHeader(0));
  }

  public writePcmChunk(int16Buffer: Buffer): void {
    if (this.isClosed || !this.writeStream) return;
    this.totalDataBytes += int16Buffer.length;
    this.writeStream.write(int16Buffer);
  }

  public async close(): Promise<void> {
    if (this.isClosed || !this.writeStream) return;
    this.isClosed = true;

    await new Promise<void>((resolve) => {
      this.writeStream?.end(() => resolve());
    });

    // Re-open and rewrite valid WAV header with final data byte count
    try {
      const fd = fs.openSync(this.filePath, 'r+');
      const finalHeader = createWavHeader(this.totalDataBytes);
      fs.writeSync(fd, finalHeader, 0, 44, 0);
      fs.closeSync(fd);
    } catch (err) {
      console.error(`[WavFileWriter] Error updating final WAV header:`, err);
    }
  }

  public getTotalBytes(): number {
    return this.totalDataBytes;
  }
}

