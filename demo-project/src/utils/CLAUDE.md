# src/utils — Folder Guide

Pure utility modules with no dependencies on business logic or Express internals. Both files are imported widely across the codebase, so changes here have broad impact.

## Files

### `validators.js`
Exported functions: `validateEmail`, `validatePassword`, `validateUUID`, `validatePhoneNumber`, `sanitizeString`.

- All functions are pure: no side effects, no I/O, no imports.
- Each returns a `boolean` (validators) or `string` (sanitizer).
- Guard clause pattern: check `!input || typeof input !== 'string'` first, then test the regex.
- Every new validator must have at least one unit test in `tests/validators.test.js`.

### `logger.js`
Exports a single `logger` object with `.error()`, `.warn()`, `.info()`, `.debug()` methods.

- Writes structured JSON (`{ timestamp, level, message }`) — do not change this shape; downstream log aggregators depend on it.
- `error` goes to `stderr`; all other levels go to `stdout`.
- Level is controlled by the `LOG_LEVEL` env var (default `info`). Valid values: `error`, `warn`, `info`, `debug`.
- Never use `console.log` anywhere in `src/` — always import and use this logger.

## Rules for This Folder

- No Express, Prisma, JWT, or bcrypt imports — keep these modules dependency-free.
- No async functions — all utilities must be synchronous.
- JSDoc required on every exported function.
