# RBAC Implementation Review

## Executive Summary
**Status: BLOCKER (Do Not Ship)**

The RBAC implementation successfully establishes the foundational architecture (JWT generation, Argon2id hashing, React Context state, and mutation UI gating). The codebase generally adheres to Python and TypeScript conventions.

However, a critical security vulnerability exists in the backend routing configuration. The implementation blindly followed a flawed recommendation from `research.md` instead of the explicit requirements in the source-of-truth `goal.md`, leaving all `GET` endpoints entirely public to the internet. Additionally, there is a major configuration risk regarding the JWT secret.

These issues must be resolved before this code can be merged and shipped to production.

---

## Issues

### 1. [BLOCKER] All `GET` routes are completely public and unauthenticated
- **File:** `server/routers/*.py` (e.g., `server/routers/problems.py:36` and `server/routers/problems.py:55`)
- **Description:** All `GET` list and `GET` detail routes lack the `get_current_user` or `require_role(Role.READER)` dependencies. 
- **Why it matters:** The objective explicitly states that Read actions require the `Reader` role or above, and that unauthenticated requests must return `401`. Currently, any unauthenticated visitor can bypass the frontend UI and scrape the entire API for problems, solutions, and infrastructure data without a token. `research.md` erroneously suggested keeping `GET` routes "unguarded" and the author failed to recognize that this contradicts the core security requirement in `goal.md`.
- **Suggested fix:** Add `dependencies=[Depends(require_role(Role.READER))]` or `Depends(get_current_user)` to all `GET` routes across all entity routers. Update the tests in `server/tests/test_rbac_guards.py` to ensure that unauthenticated requests to `GET` routes return `401`, rather than asserting they "remain open without auth".

### 2. [MAJOR] Hardcoded JWT Secret allows silent failure in production
- **File:** `server/config.py:9`
- **Description:** The `jwt_secret` defaults to `"CHANGE_ME_IN_PROD"`. There is no validation to ensure this placeholder is overridden in production environments.
- **Why it matters:** The objective dictates: "secret from env not hardcoded (placeholder default acceptable but prod must fail)". If the deployment pipeline fails to inject `JWT_SECRET`, the application will start silently with a well-known secret, allowing attackers to forge `SuperAdmin` tokens instantly.
- **Suggested fix:** Add a Pydantic `@model_validator` in `config.py` that checks the current environment. If `environment == 'production'` and `jwt_secret == 'CHANGE_ME_IN_PROD'`, raise a `ValueError` so the application crashes at startup.

---

## Positives
Despite the blockers, the following requirements were implemented excellently:
- **Role Matrix Future-Proofing:** `Admin` and `SuperAdmin` are distinct enum values in `server/schemas/models.py:27`, allowing future divergence in permissions without data migration.
- **Client-Side Validation:** The frontend efficiently parses the JWT payload client-side (`client/src/auth/jwt.ts`) using native `atob`, avoiding unnecessary DB hits or `/me` round-trips on every page load.
- **Modern Crypto:** `Argon2id` is properly utilized via `pwdlib` (`server/security/passwords.py`), providing robust defense against password cracking.
- **Algorithm Pinning:** `jwt.decode` strictly pins the expected algorithm (`server/security/jwt.py:68`), mitigating the infamous `alg: none` JWT vulnerability.
- **Clean Frontend Guard Integration:** `RequireRole` and `Can` components gracefully handle UI gating and unauthorized redirects without introducing heavy third-party routing dependencies.

---

## Must-Fix Before Merge Checklist
- [ ] Add `require_role(Role.READER)` dependencies to all `GET` endpoints in the backend.
- [ ] Update `test_rbac_guards.py` to ensure unauthenticated `GET` requests correctly return `401`.
- [ ] Add startup validation in `config.py` to fail hard if `jwt_secret` is set to the default value in production.
