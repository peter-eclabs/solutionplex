# Phase 5: Verification Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perform automated quality checks on the server and client codebase, and run a manual end-to-end smoke test script to verify application behaviors and reference linkage.

**Architecture:** Validation testing spans Python pytest for core FastAPI units/integration, typecheck rules validation (pyright and typescript compiling), linting conformity checks, and client E2E navigation sequences.

**Tech Stack:** pytest, pyright, npm run build (tsc + Vite build), ESLint, curl.

---

### Task 1: Backend Automated Validation
**Files:**
- `server/` (No new code files, verify only)

- [ ] Execute Pytest to verify mocked unit and integration assertions:
  ```bash
  cd server
  uv run pytest
  ```
  *Expected Output:* All test assertions pass cleanly with `100%` pass rate.
- [ ] Run Pyright static type check diagnostics:
  ```bash
  cd server
  uv run pyright
  ```
  *Expected Output:* `0 errors` found in codebase modules.
- [ ] Spin up the development server temporarily:
  ```bash
  cd server
  uv run uvicorn main:app --port 8000
  ```
- [ ] In a separate shell, execute a health query using curl:
  ```bash
  curl http://localhost:8000/
  ```
  *Expected Output:* `{"status": "healthy", "service": "solutionplex-server"}`
- [ ] Stop the server.
- [ ] Confirm everything is clean.

---

### Task 2: Frontend Automated Validation
**Files:**
- `client/` (No new code files, verify only)

- [ ] Install latest packages and configure eslint rules if necessary:
  ```bash
  cd client
  npm install
  ```
- [ ] Run typescript diagnostics compile and production bundle build:
  ```bash
  cd client
  npm run build
  ```
  *Expected Output:* Successful compile and export of static single-page resources under `client/dist/`.
- [ ] Perform static lint checks:
  ```bash
  cd client
  npm run lint
  ```
  *Expected Output:* Compile finishes with zero warnings or errors.

---

### Task 3: Manual End-to-End Smoke Test Script
**Files:**
- None (User interface testing checklist)

- [ ] Perform the following E2E checklist in a browser:
  1. Boot the MongoDB local engine (or connect to a test database instance).
  2. Start the Backend:
     ```bash
     cd server
     uv run uvicorn main:app --reload --port 8000
     ```
  3. Start the Frontend Client:
     ```bash
     cd client
     npm run dev
     ```
  4. Open the browser and visit `http://localhost:5173`.
  5. **Problems Tab**:
     - Complete form: Title: `"Slow Transaction Writes"`, Description: `"DB updates blocked by locking"`.
     - Click **Create Problem Card**.
     - Verify card mounts to the grid listing.
  6. **Architecture Tab**:
     - Complete form: Title: `"Write-Through Session Cache"`, Description: `"Key value cache layer bypassing main transactions"`.
     - Click **Create Architecture Card**.
  7. **Infrastructure Tab**:
     - Complete form: Title: `"AWS ElastiCache Redis Cluster"`, Description: `"Redis backend caching cluster"`.
     - Click **Create Infrastructure Card**.
  8. **Solutions Tab**:
     - Verify relations dropdown lists the elements created in steps 5, 6, and 7.
     - Select target Problem `"Slow Transaction Writes"`.
     - Click checkbox/select Architecture `"Write-Through Session Cache"`.
     - Click checkbox/select Infrastructure `"AWS ElastiCache Redis Cluster"`.
     - Complete Title: `"Distributed Session Redis Caching"`, Description: `"Cache session reads/writes before database commits"`.
     - Click **Propose Solution Card**.
     - Verify the newly created solution card renders correctly displaying associations to:
       - Problem `"Slow Transaction Writes"`
       - Architecture `"Write-Through Session Cache"`
       - Infrastructure `"AWS ElastiCache Redis Cluster"`
  9. **Cross-Reference Checking**:
     - Click the **Problems** tab.
     - Locate the card `"Slow Transaction Writes"`.
     - Verify the card now renders a relation tag showing its associated solution: `"Distributed Session Redis Caching"`.
  10. **Tab Scoped Search MVP Checking**:
      - Navigate to **Solutions** tab.
      - Type `"Distributed"` in search bar. Solution card is visible.
      - Type `"AWS"` in search bar. Solution card is visible.
      - Type `"Transaction"` in search bar. Solution card is NOT visible (since "Transaction" is only in the problem description, not the solution).
      - Clear search query.
      - Navigate to **Problems** tab.
      - Type `"Transaction"` in search bar. Problem card is visible.
      - Type `"Redis"` in search bar. Problem card is NOT visible.
      - Clear search query.
  11. **Apps Tab Checking**:
      - Navigate to **Apps** tab.
      - Select Problem `"Slow Transaction Writes"`.
      - Fill Title: `"Hello World App"`.
      - Fill Description: `"Octocat Hello World repository verification"`.
      - Fill GitHub Repo URL: `"https://github.com/octocat/Hello-World"`.
      - Fill Live URL: `"https://github.com"`.
      - Click **Create App Card**.
      - In the created card grid, click **Show README**.
      - Verify that the card displays the repository README file contents inside the preformatted block (decoded from base64).
      - Click **Launch App ↗** and verify a new tab opens to `"https://github.com"`.
