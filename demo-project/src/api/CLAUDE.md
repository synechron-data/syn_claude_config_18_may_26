# src/api — Folder Guide

The HTTP surface of the application. All routes mount under `/api/auth` (wired in `src/index.js`). This folder owns request/response shaping only — no business logic belongs here; delegate to `src/auth/` for that.

## Files

### `routes.js`
Defines the four auth endpoints on an Express `Router`.

| Method | Path | Middleware | Description |
|--------|------|------------|-------------|
| `POST` | `/login` | `validateBody(['email', 'password'])` | Validates credentials, returns access + refresh tokens |
| `POST` | `/refresh` | `validateBody(['refreshToken'])` | Exchanges a refresh token for a new access token |
| `POST` | `/logout` | `authenticate` | Revokes the refresh token; access token is not blocklisted |
| `GET`  | `/me` | `authenticate` | Returns `req.user` (decoded JWT payload) |

**Mock user record** — `POST /login` contains a hardcoded `mockUserRecord` with a bcrypt hash. This is a demo stub; replace with a real Prisma DB lookup before production use. Do not add more mock data here.

**Error handling convention:**
- Known domain errors (`'Invalid credentials'`, `'Invalid ...'`, `'... expired'`) → explicit `4xx` response in the route.
- Unknown errors → `next(err)` so `errorHandler` in middleware catches them.
- Never swallow errors silently or return `500` directly from a route.

### `middleware.js`
Exports: `requestLogger`, `authenticate`, `validateBody`, `errorHandler`.

- **`requestLogger`** — logs method, path, status code, and duration on `res.finish`. Mounted globally in `index.js`; do not call per-route.
- **`authenticate`** — calls `extractBearerToken` → `verifyToken`; attaches decoded payload to `req.user`. The 401 error message is passed through directly from `tokenHelper.verifyToken` — do not change those strings without updating this middleware.
- **`validateBody(fields)`** — returns a middleware factory. Rejects with `400` if any listed field is `undefined` or `''`. Run it before `authenticate` on routes that need both.
- **`errorHandler`** — must be the last middleware registered in `index.js` (Express requires 4-argument signature `(err, req, res, next)`). Always returns `500` with a generic message; specifics are logged only.

## Rules for This Folder

- Route handlers must use `async/await`; pass errors to `next(err)`, never `throw` from a route directly.
- Input validation (email format, password length) stays in the route using `src/utils/validators`; do not duplicate logic in middleware.
- `req.user` is the decoded JWT payload — it contains `sub`, `email`, and `role`. Do not mutate it after `authenticate` sets it.
- No direct `jwt` or `bcrypt` calls here — those belong in `src/auth/`.
- JSDoc required on every middleware function; route handlers use block comments (`/** ... */`) above each `router.*` call.
