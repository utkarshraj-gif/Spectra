# Spectra

Spectra joins meetings, records incoming audio, and transcribes speech with a
local Faster-Whisper service. The web app shows meeting status and transcripts.

## Services

| Directory | Service | Default port |
| --- | --- | --- |
| `frontend/` | SvelteKit web app | 3000 |
| `backend/` | Go API | 8080 |
| `meeting-worker/` | Playwright meeting bot | 5001 |
| `ai-service/` | FastAPI transcription service | 8000 |
| `infra/` | Docker Compose and PostgreSQL | 5432 for PostgreSQL |

See [architecture](docs/ARCHITECTURE.md) and [API routes](docs/API_CONTRACT.md).

## Run with Docker Compose

```sh
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build -d
```

Review `infra/docker-compose.yml` for the environment variables each container
receives. Copying `.env.example` does not load variables into local processes.

Open the app at `http://localhost:3000`. The backend, worker, and transcription
service expose `/health` on their respective ports.

## Run services locally

Start PostgreSQL and configure each service's environment before starting it.
Use a separate terminal for each service. Set `RECORDINGS_PATH` to the same
absolute directory for the backend, worker, and transcription service.

Backend, using the Go version specified in `backend/go.mod`:

```sh
cd backend
go run ./cmd/api
```

Meeting worker, using Node.js and installed Google Chrome:

```sh
cd meeting-worker
npm ci
npm run build
npm start
```

Transcription service, using Python 3.10 or later:

```sh
cd ai-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

On Windows, activate the virtual environment with `.venv\Scripts\Activate.ps1`.

Frontend, using Node.js:

```sh
cd frontend
npm ci
npm run dev
```

## Google Meet access

The Windows worker defaults to visible Chrome. In a live test, headless Chrome
received HTTP 403 while visible Chrome joined the same Open meeting as a guest.
`HEADLESS=true` enables headless mode. `HEADLESS=false` uses visible Chrome.
Linux containers default to headless mode.

For guest joins, the host must allow anonymous access. Open meeting access worked
in the verified meeting. Account and organization policies can still deny entry.
See [Google Meet access controls](https://support.google.com/meet/answer/9302870?hl=en).

If a meeting requires a Google account, run this command from the repository root:

```sh
npm --prefix meeting-worker run login
```

Sign in in the Chrome window and leave it open on Google Meet. The provisioner
saves the session automatically, then closes its window. Use an account the host
can invite. Meet displays that account's name for authenticated participants.
On Windows, set `CHROME_PATH` if Chrome is installed outside the standard paths.
Use `npm.cmd` if PowerShell blocks the `npm` script.

Login and worker sessions share `meeting-worker/bot-profile/storage.json`.
`BOT_PROFILE_DIR` overrides the directory. Relative values resolve from
`meeting-worker/`. Docker Compose mounts this directory into the worker.
New meetings load the latest saved state. Run login again if the session expires.
Keep the session file private because it contains account credentials.

To check admission to an active meeting:

```sh
npm --prefix meeting-worker run test:meet -- https://meet.google.com/xxx-xxxx-xxx
```

The check joins as Spectra, waits up to two minutes for admission, verifies the
in-call Leave control, and leaves. Access rejection or an admission timeout fails
the check. The worker's `/health` response reports its current `browser_mode`.

## Checks

Run these commands from the repository root:

```sh
npm --prefix meeting-worker run build
npm --prefix meeting-worker test
npm --prefix meeting-worker run test:audio
npm --prefix frontend run check
npm --prefix frontend run build
```

Run `go test ./...` and `go vet ./...` in `backend/`. Run `pytest` in
`ai-service/` with its development dependencies installed. Browser tests require
Chrome. Some service tests also require local services or test configuration.

Generated frontend files, browser profiles, recordings, and local environment
files do not belong in Git. Transcription runs through the configured AI service;
meeting audio still passes through the meeting provider.
