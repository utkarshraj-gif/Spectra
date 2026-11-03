/**
 * streamer.ts — Real-time bi-directional audio streaming client to Spectra AI Service.
 */

export interface LiveTranscriptEvent {
  event: 'TRANSCRIPT_SEGMENT';
  meeting_id: string;
  speaker: string;
  text: string;
  start_time_ms: number;
  end_time_ms: number;
  is_final: boolean;
}

export interface AudioStreamerOptions {
  aiServiceWsUrl: string;
  meetingId: string;
  onTranscriptSegment: (segment: LiveTranscriptEvent) => void;
  onError?: (error: Error) => void;
}

export class LiveAudioStreamer {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isClosed = false;
  private pendingChunks: Buffer[] = [];
  private lastSpeaker: string | null = null;
  private options: AudioStreamerOptions;

  constructor(options: AudioStreamerOptions) {
    this.options = options;
  }

  public connect(): void {
    if (this.isClosed) return;

    try {
      this.ws = new WebSocket(this.options.aiServiceWsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log(`[LiveAudioStreamer] Connected to AI transcription stream: ${this.options.aiServiceWsUrl}`);

        // Immediately transmit active speaker identity if observed before websocket connected
        if (this.lastSpeaker && this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(JSON.stringify({ type: 'SPEAKER_ACTIVE', speaker: this.lastSpeaker }));
          } catch {}
        }

        // Flush any buffered chunks
        while (this.pendingChunks.length > 0 && this.isConnected) {
          const chunk = this.pendingChunks.shift();
          if (chunk && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(chunk);
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data && data.event === 'TRANSCRIPT_SEGMENT') {
            this.options.onTranscriptSegment(data as LiveTranscriptEvent);
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      this.ws.onerror = (err) => {
        console.warn(`[LiveAudioStreamer] WebSocket warning for meeting ${this.options.meetingId}:`, err);
        if (this.options.onError) {
          this.options.onError(new Error('AI Service WebSocket error'));
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log(`[LiveAudioStreamer] Stream closed for meeting ${this.options.meetingId}`);
      };
    } catch (err) {
      console.warn(`[LiveAudioStreamer] Could not open WebSocket connection:`, err);
    }
  }

  public sendPcmChunk(pcmBuffer: Buffer): void {
    if (this.isClosed) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(pcmBuffer);
      } catch (err) {
        console.error(`[LiveAudioStreamer] Error sending chunk:`, err);
      }
    } else if (this.pendingChunks.length < 50) {
      // Buffer up to ~12.5 seconds of audio while reconnecting
      this.pendingChunks.push(pcmBuffer);
    }
  }

  public notifyActiveSpeaker(speaker: string): void {
    if (!speaker) return;
    this.lastSpeaker = speaker;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'SPEAKER_ACTIVE', speaker }));
      } catch {
        // non-critical
      }
    }
  }

  public close(): void {
    this.isClosed = true;
    this.isConnected = false;
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'FLUSH' }));
        }
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.pendingChunks = [];
  }
}
