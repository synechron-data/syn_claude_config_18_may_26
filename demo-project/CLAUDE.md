# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack
- Runtime: Node.js 20
- Framework: Express.js
- Database: PostgreSQL with Prisma ORM
- Testing: Jest
- Language: JavaScript (ECMAScript 2022)

## Commands

```bash
npm start          # Production server (node src/index.js)
npm run dev        # Dev server with auto-reload (nodemon)
npm test           # Run tests with coverage
npm run test:watch # Watch mode
npm run lint       # Lint src/ and tests/
npm run lint:fix   # Auto-fix lint issues
```

Tests run against Node environment; coverage collected from `src/**/*.js`, output to `coverage/`.

## Architecture

Express.js authentication API. All routes mount at `/api/auth`; health check at `/health`. Default port 3000, configurable via `PORT` env var.

**Request flow:**

```
Request → JSON parser + requestLogger (middleware.js)
        → Route (routes.js)
        → validateBody() → authService.js → tokenHelper.js
        → Response
```

Protected routes (`GET /api/auth/me`) run the `authenticate` middleware first: it calls `extractBearerToken()` → `verifyToken()` and attaches the decoded payload to `req.user`.

**Layer responsibilities:**

- `src/api/routes.js` — HTTP surface: login, refresh, logout, me endpoints. Contains a hardcoded mock user (demo only).
- `src/api/middleware.js` — `requestLogger`, `authenticate`, `validateBody`, `errorHandler`.
- `src/auth/authService.js` — Business logic: password validation (bcrypt), JWT issuance, refresh token lifecycle. Refresh tokens are stored in an in-memory `Map` (no persistence).
- `src/auth/tokenHelper.js` — Low-level JWT utilities: `verifyToken`, `decodeToken`, `extractBearerToken`, `getTokenTTL`.
- `src/utils/validators.js` — `validateEmail`, `validatePassword` (min 8 chars), `validateUUID`, `sanitizeString`.
- `src/utils/logger.js` — Structured JSON logger; level controlled by `LOG_LEVEL` env var; errors go to stderr.

## Coding Standards
- Always use async/await, never raw Promises
- All functions must have JSDoc comments
- No console.log in production code — use the logger utility
- Every new function must have at least one unit test

## What Claude Must Never Do
- Never modify .env or .env.* files
- Never push directly to main branch
- Never remove existing tests
- Never install packages without confirming with the developer

## PR and Git Standards
- Commit messages follow Conventional Commits: feat:, fix:, docs:, test:
- PR descriptions must include: what changed, why it changed, how to test

## Environment

Copy `.env.example` to `.env`. Required variables: `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_EXPIRES_IN`. `NODE_ENV` and `LOG_LEVEL` are optional.
