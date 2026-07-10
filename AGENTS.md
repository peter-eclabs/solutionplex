# Solutionplex Agent Guide

Orients agentic coding assistants. Follow commands, style rules below; match local patterns.

## Spec-Based Development

**ALL work must reference these specification documents:**

| Document | Purpose |
|----------|---------|
| `docs/foundation/goal.md` | Product Requirements Document (PRD): vision, data model, feature requirements, tech stack |

**Rule**: Read `docs/foundation/goal.md` before implementing any feature.

## Product Overview

Solutionplex is an internal knowledge base and collaborative solution-mapping application. It documents business/technical problems and links them to proposed solutions, architectural designs, and infrastructure requirements.

- **Problem → Solution**: 1-to-Many. A problem can have multiple solutions.
- **Solution → Problem**: 1-to-1. A solution must be tied to exactly one problem.
- **Solution → Architecture / Infrastructure**: 1-to-Many. A solution can reference multiple architectural patterns and infrastructure stacks.

The UI is organized into four tabs: **Problems**, **Solutions**, **Architecture**, **Infrastructure**. MVP search is simple keyword/word-match, scoped to the active tab.

## Repo Layout

- `server/`: FastAPI backend (Python) managed with `uv`
  - `.venv/`: Python virtual environment (created via `uv venv`)
  - `main.py`: Application entrypoint
  - `routers/`: REST API endpoints (problems, solutions, architecture, infrastructure)
  - `schemas/`: Pydantic v2 domain models
  - `services/`: Business logic and relationship management
  - `database/`: MongoDB persistence layer (Motor async client)
  - `tests/`: Python tests (pytest)
- `client/`: React + TypeScript frontend (to be initialized)
  - `src/`: Application source
- `docs/foundation/`: Product specs and planning docs

## Technology Versions

- **Frontend**: React (dynamic, tab-based UI)
- **Backend Framework**: FastAPI (Python, high-performance ASGI)
- **Backend Language**: Python (3.13 via `uv`, defined in `server/.python-version`)
- **Server**: `uvicorn[standard]` ASGI server (run via `uv run`)
- **Database**: MongoDB (document store, via Motor async driver)
- **Package Manager**: `uv`
- **Type Checking**: `pyright`

## Dependencies

### Server (managed by `uv` in `server/`)
Web Framework: `fastapi`, `uvicorn[standard]`
Data Validation: `pydantic` (v2)
Database: `motor` (async MongoDB driver), `pymongo`
Config: `python-dotenv`
Type Checking (dev): `pyright`

### Client (to be added)
- React, React-DOM, TypeScript, Vite
- Routing, state, and UI libraries added during client initialization

## Build, Lint, and Test

### Server (`server/`)
```bash
cd server
uv run uvicorn main:app --reload --port 8000   # Dev server
uv run pytest                                 # All tests
uv run pyright                                # Type check
```

### Client (`client/`, once initialized)
```bash
cd client
npm install          # Install deps
npm run dev          # Dev server
npm run build        # Production build (tsc + bundler)
npm run lint         # ESLint
```

### Env Configuration
- Backend: `.env` in `server/` (e.g. `MONGODB_URL`, `MONGODB_DB`)
- Client: `VITE_API_URL` (defaults to `http://localhost:8000`)

## Application Behavior Notes

- **Problems Tab**: Problem Cards (Title, Description). If a problem has solutions, show a link/mention of the associated Solution(s).
- **Solutions Tab**: Solution Cards (Title, Description). Creating a solution mandates selecting an existing Problem from a dropdown, plus multi-select dropdowns for Architecture and Infrastructure.
- **Architecture Tab**: Architecture pattern cards (Title, Description). Populate the Architecture dropdown in Solutions.
- **Infrastructure Tab**: Infrastructure stack cards (Title, Description). Populate the Infrastructure dropdown in Solutions.
- **Search (MVP)**: Keyword/word-match, scoped to the active tab only.

## Quick Reference: Code Style

### Python / FastAPI
- 4-space indentation, PEP 8 line limits
- Import grouping: stdlib → third-party → local (`server.*`)
- `snake_case` for functions/vars, `PascalCase` for classes
- Type hints for public APIs; `Optional[T]` for nullable
- Docstrings with summary + Args/Returns/Raises
- F-strings preferred; no bare `except:`
- Pydantic v2: `Field` constraints, `ConfigDict(from_attributes=True)`
- Routers: `APIRouter` with `summary`/`description` metadata
- Use `uv run` so the `.venv` interpreter and dependencies are used

### TypeScript / React (once client exists)
- Strict mode enabled
- `const` by default; no `var`
- Named exports preferred
- Single quotes; explicit semicolons
- Avoid `any`, `as`, non-null assertions where possible
- `UpperCamelCase` for components/types
- Type-only imports: `import type { Foo } from ...`

### Error Handling and Logging
- API routers: try/except → log → `HTTPException` with status codes
- Re-raise `HTTPException` untouched; wrap only unexpected exceptions
- Module-level: `logger = logging.getLogger(__name__)`

### Import Ordering
```python
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status

from server.database.client import db
```

## Testing Notes
- **Server**: `pytest` in `server/tests`
  - File naming: `test_*.py`
  - Mock external dependencies (MongoDB client) for deterministic tests
- Keep tests small, deterministic, and focused on relationships (1:N, 1:1) and CRUD behavior.

## AGENT BEHAVIOUR (Spec-Driven)

### Research-First Principle
- **ALWAYS web-search / consult docs before implementing** unfamiliar libraries, APIs, or patterns.
- **NEVER assume** library behavior — verify with official documentation (FastAPI, Motor, Pydantic, React).

### SWE Best Practices
- **Write tests with code**, not after.
- **Verify with diagnostics**: Run `uv run pyright` after edits before marking tasks complete.
- **Build & test**: Run build/test commands after implementation.
- **Type safety first**: No `as any` / `@ts-ignore`.
- **No empty catch blocks** (`catch(e) {}`).
- **Minimal changes**: Fix bugs without refactoring unrelated code.
- **Running Python files**: Use `uv run` from `server/` for correct interpreter and imports.

### Task Workflow
1. **Read specs**: `docs/foundation/goal.md`
2. **Select task**: Choose next work item
3. **Implement**: Write code + tests together
4. **Verify**: `uv run pyright` and `uv run pytest`
5. **Document deviations**: If implementation differs from the PRD stack, note it in `docs/foundation/goal.md`
6. **Commit**: Clear, descriptive message

### Use Sub-Agents to Extend Sessions
- Launch sub-agents for long-running tasks, multi-file changes, complex exploration.
- Benefits: fresh context per subtask, parallel execution, domain focus.

### Git Workflow
- Commit small, atomic changes with clear messages.
- Stage only intended files; never commit secrets or `.env`.

## References
- `docs/foundation/goal.md` - Product Requirements Document (source of truth)
- `opencode.json` - LSP configuration for Python (pyright via `.venv`) and TypeScript
