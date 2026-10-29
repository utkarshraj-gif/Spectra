# API Contract

Base URL: `http://localhost:8080/api/v1`

## Health Check
- `GET /health` -> `{"status": "ok", "service": "spectrum-backend"}`

## Auth
- `POST /api/v1/auth/register` -> `{"status": "registered"}`
- `POST /api/v1/auth/login` -> `{"token": "jwt-token", "user": {"id": "1", "email": "user@spectrum.ai"}}`

## Users
- `GET /api/v1/users/me` -> Current user profile

## Meetings
- `GET /api/v1/meetings` -> List meetings
- `POST /api/v1/meetings` -> Schedule or join meeting
- `GET /api/v1/meetings/:id` -> Get meeting details, transcript, and summary

## Participants
- `GET /api/v1/participants?meeting_id=:id` -> List meeting participants

## Calendar
- `GET /api/v1/calendar/events` -> List upcoming synced calendar events
