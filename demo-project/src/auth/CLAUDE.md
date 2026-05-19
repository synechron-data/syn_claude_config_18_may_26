# src/auth — Folder Guide

Business logic for authentication. These two files form a deliberate two-layer design: `authService.js` owns lifecycle and state; `tokenHelper.js` is stateless JWT plumbing. Keep that separation — do not add state to `tokenHelper.js` or JWT calls to `authService.js` directly.

## Files

### `authService.js`
Exports: `loginUser`, `refreshToken`, `revokeToken`, `isTokenExpired`, `generateAccessToken`, `generateRefreshToken`.

- **Refresh token store** — `refreshTokenStore` is an in-memory `Map` keyed by UUID token, valued `{ userId, createdAt }`. It does not survive process restarts. Replacing it with a database-backed store is the expected production step.
- **`loginUser`** — accepts a pre-fetched `userRecord` (with `passwordHash`); it does not query the DB itself. The caller (route handler) is responsible for the lookup.
- **`isTokenExpired`** — uses `jwt.decode` (no signature check), so it works on untrusted tokens for expiry-only checks. Do not use it as an authorization gate.
- **`generateRefreshToken`** — issues a UUID v4, not a JWT. Stored in the Map; validated by presence, not by signature.
- **`getUserById`** — stub placeholder; replace with a real Prisma query before shipping.
- All exported functions must remain `async`-compatible; `loginUser` and `getUserById` are async, others are sync.

### `tokenHelper.js`
Exports: `verifyToken`, `decodeToken`, `extractBearerToken`, `getTokenTTL`.

- **`verifyToken`** — the only function that checks the JWT signature. Use this on every protected route. Throws with normalized messages (`'Token has expired'`, `'Invalid token'`) — do not change these strings; middleware matches on them.
- **`decodeToken`** — no signature verification. Safe only for reading non-security-sensitive claims (e.g. inspecting expiry client-side). Never use to authorize a request.
- **`extractBearerToken`** — expects the raw `Authorization` header value; returns `null` if the prefix is missing or malformed.
- **`getTokenTTL`** — returns remaining seconds; returns `0` for expired or unparseable tokens, never negative.
- No side effects, no state, no imports beyond `jsonwebtoken`.

## Key Invariants

- `JWT_SECRET` must come from `process.env.JWT_SECRET` in production. The `'dev-secret-key'` fallback is intentional for local development only — never harden it.
- Expiry strings (`JWT_EXPIRES_IN`, `REFRESH_EXPIRES_IN`) follow the `jsonwebtoken` duration format (e.g. `'1h'`, `'7d'`).
- Never log passwords, raw tokens, or JWT payloads — log only `userId` / `email` at `info`/`warn` level.
- Always use `async/await`; never raw Promises.
- JSDoc required on every exported function.
