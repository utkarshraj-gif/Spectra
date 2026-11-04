import http from 'http';
import { URL } from 'url';
import { config } from './config.js';
import { GoogleMeetSession } from './meet.js';
import { prewarmBrowserContext } from './browser.js';
import { SessionStatusEvent, StartSessionPayload, StopSessionPayload } from './types.js';

const sessions = new Map<string, GoogleMeetSession>();
const eventListeners = new Map<string, Set<(event: SessionStatusEvent) => void>>();

function broadcastEvent(meetingId: string, event: SessionStatusEvent) {
  console.log(`[MeetingWorker][${event.state}] ${meetingId}: ${event.message || ''}`);
  if (event.state === 'CALL_ENDED' || event.state === 'FAILED') {
    sessions.delete(meetingId);
  }
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

  // Enhanced Health Check reporting active capacity, session slots, and memory usage (Task G-4)
  if (method === 'GET' && pathname === '/health') {
    const mem = process.memoryUsage();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'meeting-worker',
        active_sessions: sessions.size,
        max_capacity: config.maxConcurrentSessions,
        available_slots: Math.max(0, config.maxConcurrentSessions - sessions.size),
        memory: {
          rss_mb: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
          heap_used_mb: Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10,
          heap_total_mb: Math.round((mem.heapTotal / (1024 * 1024)) * 10) / 10,
        },
        uptime_seconds: Math.round(process.uptime()),
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

  // Diagnostic screenshot for active session
  if (method === 'GET' && pathname.startsWith('/sessions/') && pathname.endsWith('/screenshot')) {
    const parts = pathname.split('/');
    const meetingId = parts[2];
    const session = sessions.get(meetingId);
    const page = session?.getPage();
    if (!page || page.isClosed()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session page not available' }));
      return;
    }
    try {
      const buffer = await page.screenshot({ type: 'png' });
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(buffer);
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Diagnostic info for active session
  if (method === 'GET' && pathname.startsWith('/sessions/') && pathname.endsWith('/info')) {
    const parts = pathname.split('/');
    const meetingId = parts[2];
    const session = sessions.get(meetingId);
    const page = session?.getPage();
    if (!page || page.isClosed()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session page not available' }));
      return;
    }
    try {
      const info = await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        bodyText: document.body ? document.body.innerText.replace(/\s+/g, ' ').slice(0, 300) : '',
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText || b.getAttribute('aria-label') || b.getAttribute('data-tid')),
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(info));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Start Meeting Session (/sessions/start or /join for REST API client compatibility)
  if (method === 'POST' && (pathname === '/sessions/start' || pathname === '/join')) {
    try {
      // 1. Enforce multi-session capacity limit (Task G-4)
      if (sessions.size >= config.maxConcurrentSessions) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Worker capacity reached',
            active_sessions: sessions.size,
            max_capacity: config.maxConcurrentSessions,
            message: `Worker is currently running at maximum capacity (${config.maxConcurrentSessions} concurrent sessions). Please retry shortly.`,
          })
        );
        return;
      }

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
        payload.passcode,
        (event) => broadcastEvent(payload.meeting_id, event)
      );

      sessions.set(payload.meeting_id, session);

      // Start session async in background
      session.start().catch((err) => {
        console.error(`Failed to execute session ${payload.meeting_id}:`, err);
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'dispatched',
          message: 'Worker successfully dispatched to meeting',
          meeting_id: payload.meeting_id,
          active_sessions: sessions.size,
          max_capacity: config.maxConcurrentSessions,
        })
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // Stop Meeting Session via REST path (/meetings/:id/stop)
  if (method === 'POST' && pathname.startsWith('/meetings/') && pathname.endsWith('/stop')) {
    const parts = pathname.split('/');
    const meetingId = parts[2];
    const session = sessions.get(meetingId);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No active session found for meeting_id' }));
      return;
    }

    sessions.delete(meetingId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'stopped', meeting_id: meetingId }));

    session.leave('Requested by REST API').catch((err) => {
      console.error(`[MeetingWorker] Error stopping session ${meetingId}:`, err);
    });
    return;
  }

  // Stop Meeting Session via RPC path (/sessions/stop)
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

      sessions.delete(payload.meeting_id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'stopped', meeting_id: payload.meeting_id }));

      session.leave(payload.reason || 'Requested by Go supervisor').catch((err) => {
        console.error(`[MeetingWorker] Error stopping session ${payload.meeting_id}:`, err);
      });
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
  console.log(`[MeetingWorker] Service listening on port ${config.port} (Max capacity: ${config.maxConcurrentSessions})`);
  prewarmBrowserContext().catch((err) => {
    console.warn('[MeetingWorker] Browser pre-warm warning:', err);
  });
});

// Memory watchdog (checks every 30 seconds to prevent silent memory bloat)
setInterval(() => {
  const mem = process.memoryUsage();
  const rssMb = Math.round(mem.rss / (1024 * 1024));
  if (rssMb > 1800) {
    console.warn(`[MeetingWorker][MemoryWatchdog] Elevated RSS memory: ${rssMb} MB across ${sessions.size} sessions.`);
  }
}, 30000).unref();

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
