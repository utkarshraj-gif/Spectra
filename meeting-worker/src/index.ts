import http from 'http';
import { URL } from 'url';
import { config } from './config.js';
import { GoogleMeetSession } from './meet.js';
import { SessionStatusEvent, StartSessionPayload, StopSessionPayload } from './types.js';

const sessions = new Map<string, GoogleMeetSession>();
const eventListeners = new Map<string, Set<(event: SessionStatusEvent) => void>>();

function broadcastEvent(meetingId: string, event: SessionStatusEvent) {
  console.log(`[MeetingWorker][${event.state}] ${meetingId}: ${event.message || ''}`);
  const listeners = eventListeners.get(meetingId);
  if (listeners) {
    for (const listener of listeners) {
      listener(event);
    }
  }
}

function parseJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS Headers for internal calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'meeting-worker',
        active_sessions: sessions.size,
      })
    );
    return;
  }

  // List active sessions
  if (method === 'GET' && pathname === '/sessions') {
    const list = Array.from(sessions.entries()).map(([id, session]) => ({
      meeting_id: id,
      meeting_url: session.meetingUrl,
      state: session.getState(),
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
    return;
  }

  // Start Meeting Session
  if (method === 'POST' && pathname === '/sessions/start') {
    try {
      const payload = await parseJsonBody<StartSessionPayload>(req);
      if (!payload.meeting_id || !payload.meeting_url) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'meeting_id and meeting_url are required' }));
        return;
      }

      if (sessions.has(payload.meeting_id)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session for this meeting_id is already running' }));
        return;
      }

      const session = new GoogleMeetSession(
        payload.meeting_id,
        payload.meeting_url,
        payload.bot_name,
        (event) => broadcastEvent(payload.meeting_id, event)
      );

      sessions.set(payload.meeting_id, session);

      // Start session async in background
      session.start().catch((err) => {
        console.error(`Failed to execute session ${payload.meeting_id}:`, err);
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'initiated', meeting_id: payload.meeting_id }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // Stop Meeting Session
  if (method === 'POST' && pathname === '/sessions/stop') {
    try {
      const payload = await parseJsonBody<StopSessionPayload>(req);
      if (!payload.meeting_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'meeting_id is required' }));
        return;
      }

      const session = sessions.get(payload.meeting_id);
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No active session found for meeting_id' }));
        return;
      }

      await session.leave(payload.reason || 'Requested by Go supervisor');
      sessions.delete(payload.meeting_id);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'stopped', meeting_id: payload.meeting_id }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // Real-time Server-Sent Events (SSE) Stream
  if (method === 'GET' && pathname.startsWith('/sessions/') && pathname.endsWith('/events')) {
    const meetingId = pathname.split('/')[2];
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    res.write(`data: ${JSON.stringify({ event: 'CONNECTED', meeting_id: meetingId })}\n\n`);

    const listener = (event: SessionStatusEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    if (!eventListeners.has(meetingId)) {
      eventListeners.set(meetingId, new Set());
    }
    eventListeners.get(meetingId)!.add(listener);

    req.on('close', () => {
      eventListeners.get(meetingId)?.delete(listener);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(config.port, () => {
  console.log(`[MeetingWorker] Service listening on port ${config.port}`);
});

// Graceful process shutdown
async function gracefulShutdown(signal: string) {
  console.log(`[MeetingWorker] Received ${signal}. Shutting down sessions...`);
  server.close();

  for (const [id, session] of sessions.entries()) {
    try {
      await session.leave(`Worker shutdown (${signal})`);
    } catch (err) {
      console.error(`Error closing session ${id}:`, err);
    }
  }
  sessions.clear();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
