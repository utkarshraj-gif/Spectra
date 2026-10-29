# Phase 1 Plan: Foundation & Core Platform

## Objectives
1. Set up backend REST API in Go with auth, meeting management, and migrations.
2. Build responsive SvelteKit frontend for authentication, meeting overview, and live transcripts.
3. Establish Docker Compose infrastructure for local development.
4. Prepare Python transcription & worker pipelines managed by `uv`.

## Milestones
- **M1: Architecture & Project Scaffolding** (Completed)
- **M2: Database & Auth Service**
  - PostgreSQL migrations setup
  - User registration & JWT authentication
- **M3: Meeting Management API**
  - CRUD operations for meetings and participants
  - Calendar provider webhook/poll stubs
- **M4: Frontend Core Views**
  - Auth flows (Login / Register)
  - Dashboard & Meeting Detail interfaces
- **M5: AI Worker Integration (uv)**
  - Audio extraction worker
  - Whisper/STT integration via Python (`uv`)
