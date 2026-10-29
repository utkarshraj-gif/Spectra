# Intern & Contributor Tasks

Welcome to Spectrum AI! Here is a list of initial starter tasks:

## Backend (Go)
- [ ] **BE-1**: Connect `database.Connect()` to PostgreSQL using `pgx` driver.
- [ ] **BE-2**: Implement JWT verification middleware in `internal/middleware/`.
- [ ] **BE-3**: Implement password hashing (bcrypt) in `internal/auth/`.
- [ ] **BE-4**: Write unit tests for meetings and auth handlers in `tests/`.

## Frontend (SvelteKit)
- [ ] **FE-1**: Connect auth store to local storage in `src/lib/stores/auth.ts`.
- [ ] **FE-2**: Hook up login and register forms to `POST /api/v1/auth/login` using `$lib/api/client.ts`.
- [ ] **FE-3**: Add loading spinners and error banners to form submissions.
- [ ] **FE-4**: Build responsive transcript auto-scroll in `/meetings/[id]`.

## AI & Workers (Python + uv)
- [ ] **AI-1**: Initialize Python service workspace using `uv init` and `uv add fastapi uvicorn whisper`.
- [ ] **AI-2**: Build headless browser worker stub to join meeting URLs.
