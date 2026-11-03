/**
 * streamer.ts — Resilient bi-directional audio streaming client to Spectra AI Service.
 * Includes auto-reconnect with exponential backoff and active ping keepalive.
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
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(options: AudioStreamerOptions) {
    this.options = options;
  }

  public connect(): void {
    if (this.isClosed) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      this.ws = new WebSocket(this.options.aiServiceWsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log(`[LiveAudioStreamer] Connected to AI transcription stream: ${this.options.aiServiceWsUrl}`);

        // Start active 10s ping keepalive to prevent idle timeout during long silences/breaks
        this.startPingKeepalive();

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
          // ignore non-JSON messages (e.g. pong)
        }
      };

      this.ws.onerror = (err) => {
        console.warn(`[LiveAudioStreamer] WebSocket warning for meeting ${this.options.meetingId}:`, err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopPingKeepalive();
        if (!this.isClosed) {
          console.log(`[LiveAudioStreamer] Stream dropped for meeting ${this.options.meetingId}. Auto-reconnecting...`);
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.warn(`[LiveAudioStreamer] Could not open WebSocket connection:`, err);
      if (!this.isClosed) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.isClosed || this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isClosed) {
        this.connect();
      }
    }, delay);
  }

  private startPingKeepalive(): void {
    this.stopPingKeepalive();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch {}
      }
    }, 10000);
  }

  private stopPingKeepalive(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
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
    } else if (this.pendingChunks.length < 100) {
      // Buffer up to ~25 seconds of audio while reconnecting
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
    this.stopPingKeepalive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
