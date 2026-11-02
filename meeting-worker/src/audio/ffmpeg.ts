import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface FFprobeMetadata {
  format?: string;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  bitRate?: number;
}

/**
 * Checks if FFmpeg is available on system PATH
 */
export async function isFFmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Probes audio metadata using ffprobe if available
 */
export async function probeAudioFile(filePath: string): Promise<FFprobeMetadata | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);
    const parsed = JSON.parse(stdout);
    const stream = parsed.streams?.find((s: { codec_type: string }) => s.codec_type === 'audio');
    const format = parsed.format;

    return {
      format: format?.format_name,
      durationSeconds: format?.duration ? parseFloat(format.duration) : undefined,
      sampleRate: stream?.sample_rate ? parseInt(stream.sample_rate, 10) : undefined,
      channels: stream?.channels ? parseInt(stream.channels, 10) : undefined,
      bitRate: format?.bit_rate ? parseInt(format.bit_rate, 10) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Normalizes or converts an audio file to 16kHz Mono 16-bit PCM WAV using FFmpeg
 */
export async function convertTo16kMonoWav(inputPath: string, outputPath: string): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-acodec',
      'pcm_s16le',
      '-ac',
      '1',
      '-ar',
      '16000',
      outputPath,
    ]);
    return true;
  } catch {
    return false;
  }
}

