# API routes

The Go API listens on port 8080 by default. Routes below use `/api`; the router
also mounts them under `/api/v1`. `GET /health` is outside those prefixes and
returns the service name `spectra-backend`.

## Meetings

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/meetings` | Create a meeting and dispatch the bot |
| GET | `/api/meetings` | List meetings |
| GET | `/api/meetings/:id` | Read a meeting |
| POST | `/api/meetings/:id/stop` | Stop the bot |
| GET | `/api/meetings/:id/transcript` | Read transcript segments |
| GET | `/api/meetings/:id/live` | Stream meeting updates |
| POST | `/api/meetings/:id/segments` | Receive transcript segments |
| POST or PATCH | `/api/meetings/:id/status` | Update meeting status |

## Google integration

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/auth/google/login` | Start Google OAuth |
| GET | `/api/auth/google/callback` | Handle the OAuth callback |
| GET | `/api/calendar/events` | List Calendar events |
| POST | `/api/calendar/events/:id/join` | Dispatch a bot for an event |

Google routes require the corresponding configuration and dependencies.
`POST /api/meetings/:id/graph` is registered but returns a not-configured response.
Password-authentication and user-profile routes are not registered.

## Internal services

The worker listens on port 5001 and exposes `/health`, `/sessions`,
`POST /sessions/start`, and `POST /meetings/:id/stop`. Session diagnostics are
available at `/sessions/:id/info` and `/sessions/:id/screenshot`.

The AI service listens on port 8000. It exposes `GET /health`,
`POST /v1/transcriptions`, and the WebSocket `/ws/transcribe/:meeting_id`.
See the route handlers for request schemas and error responses.
