# Spectrum AI

Next-generation meeting intelligence and automated workspace platform.

---

## 📁 Repository Structure

```
spectrum-ai/
│
├── frontend/                       # SvelteKit + Vite + TypeScript
│   ├── src/
│   │   ├── routes/                 # Login, Register, Dashboard, Meetings, Settings
│   │   ├── lib/                    # API client, components, stores, types
│   │   └── app.html
│   ├── package.json
│   └── Dockerfile
│
├── backend/                        # Golang API
│   ├── cmd/api/main.go             # Entrypoint
│   ├── internal/                   # Modular domain logic (auth, users, meetings, etc.)
│   ├── migrations/                 # PostgreSQL schema migrations
│   ├── tests/                      # Unit and integration tests
│   ├── go.mod
│   └── Dockerfile
│
├── infra/
│   └── docker-compose.yml          # Local containerized infrastructure
│
├── docs/
│   ├── ARCHITECTURE.md             # System architecture & data flow
│   ├── API_CONTRACT.md             # REST API specifications
│   ├── PHASE1_PLAN.md              # Milestones & roadmap
│   └── INTERN_TASKS.md             # Starter contributor issues
│
├── .github/workflows/
│   └── ci.yml                      # CI pipeline (Go & SvelteKit checks)
├── .gitignore
├── .env.example
└── README.md
```

---

## 🛠️ Tech Stack & Tooling

- **Frontend**: SvelteKit, TypeScript, Vite
- **Backend**: Go (1.22+)
- **AI & Worker Services**: Python 3.12+ managed using [`uv`](https://github.com/astral-sh/uv) (for ultra-fast dependency resolution and virtualenv management)
- **Database**: PostgreSQL 16
- **Containers**: Docker & Docker Compose

---

## 🚀 Quick Start

### 1. Backend (Go)
```bash
cd backend
go run ./cmd/api
```
Health endpoint: `http://localhost:8080/health`

### 2. Frontend (SvelteKit)
```bash
cd frontend
npm install
npm run dev
```
UI available at: `http://localhost:3000`

### 3. Python & AI Worker Tooling
All Python services and scripts in Spectrum AI use [`uv`](https://docs.astral.sh/uv/):
```bash
# Install uv (if not installed)
# pip install uv  OR  curl -LsSf https://astral.sh/uv/install.sh | sh

# Initialize or run in virtual environment
uv sync
uv run <script.py>
```

### 4. Docker Compose
```bash
cd infra
docker compose up -d
```
