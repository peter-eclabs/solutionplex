# Solutionplex

Solutionplex is an internal knowledge base and collaborative solution-mapping
application. It documents business/technical problems and links them directly to
proposed solutions, architectural designs, infrastructure requirements, and
functional app prototypes.

The core value is the **"Plex"** — the interconnected relationships between
entities:

- **Problem → Solution:** 1-to-Many. A problem can have multiple solutions.
- **Solution → Problem:** 1-to-1. A solution is tied to exactly one problem.
- **Solution → Architecture / Infrastructure:** 1-to-Many. A solution can
  reference multiple architectural patterns and infrastructure stacks.

## Features

The UI is organized into five tabs, each backed by a REST resource:

| Tab | Purpose |
|-----|---------|
| **Problems** | Define problem statements; surface linked solutions. |
| **Solutions** | Propose solutions tied to a problem, with multi-select Architecture & Infrastructure. |
| **Architecture** | Repository of architectural patterns; populates the Solutions dropdown. |
| **Infrastructure** | Repository of infrastructure stacks; populates the Solutions dropdown. |
| **Apps** | Functional prototypes tied to a problem, with GitHub `README.md` rendering and an optional live link. |

**Search (MVP):** simple keyword/word-match, scoped to the active tab.

## Tech Stack

- **Frontend:** React 19 + TypeScript, built with Vite
- **Backend:** FastAPI (Python 3.13), served by Uvicorn
- **Database:** MongoDB (via the Motor async driver)
- **Package managers:** `uv` (backend), `npm` (frontend)
- **Type checking:** `pyright` (backend), `tsc` (frontend)

## Repo Layout

```
solutionplex/
├── server/            FastAPI backend (managed with uv)
│   ├── main.py        Application entrypoint
│   ├── routers/       REST API endpoints
│   ├── schemas/       Pydantic v2 domain models
│   ├── services/      Business logic & relationship management
│   ├── database/      MongoDB persistence layer (Motor)
│   └── tests/         pytest suite
├── client/            React + TypeScript frontend (Vite)
│   └── src/           Application source
├── docs/foundation/   Product specs (goal.md is the source of truth)
├── setup.bat          First-time setup / dependency update
├── start-mongo.bat    Start the bundled local MongoDB
└── run.bat            Launch backend + frontend dev servers
```

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (installs Python 3.13 automatically)
- [Node.js](https://nodejs.org/) (includes `npm`)
- MongoDB — a local instance can be started with `start-mongo.bat`

## Getting Started (Windows)

```bat
REM 1. Install/update all dependencies and create server\.env
setup.bat

REM 2. Start MongoDB
start-mongo.bat

REM 3. Launch backend (port 8080) and frontend (port 5174)
run.bat
```

- Backend: http://localhost:8080 (interactive docs at `/docs`)
- Frontend: http://localhost:5174

`setup.bat` is safe to run repeatedly — re-running it refreshes dependencies
without overwriting an existing `server\.env`.

### Manual Setup

Backend:

```bash
cd server
uv sync                                        # install deps + create .venv
uv run uvicorn main:app --reload --port 8080   # dev server
```

Frontend:

```bash
cd client
npm install
npm run dev          # dev server
```

## Configuration

Backend settings are read from `server/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB` | `solutionplex` | Database name |

The frontend reads `VITE_API_URL` (defaults to `http://localhost:8000`; `run.bat`
sets it to `http://localhost:8080`).

## Development

Backend (`server/`):

```bash
uv run pytest        # run tests
uv run pyright       # type check
```

Frontend (`client/`):

```bash
npm run build        # tsc + vite production build
npm run lint         # oxlint
```

See [`AGENTS.md`](AGENTS.md) for coding conventions and the spec-driven workflow,
and [`docs/foundation/goal.md`](docs/foundation/goal.md) for the full product
requirements.
