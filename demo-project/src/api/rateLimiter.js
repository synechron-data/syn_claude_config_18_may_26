/**
 * Rate Limiting Middleware
 * Limits each IP to 100 requests per 15 minutes using an in-memory store.
 */

const { logger } = require('../utils/logger');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 100;

/** @type {Map<string, { count: number, resetAt: number }>} */
const store = new Map();

// Purge expired entries each window to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of store) {
    if (now >= record.resetAt) {
      store.delete(ip);
    }
  }
}, WINDOW_MS).unref();

/**
 * Resolves the client IP, preferring the leftmost value of X-Forwarded-For.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (forwarded ? forwarded.split(',')[0].trim() : null)
    || req.socket.remoteAddress
    || 'unknown';
}

/**
 * Rate limiter middleware — allows at most 100 requests per 15 minutes per IP.
 * Sets X-RateLimit-* headers on every response and returns 429 with a
 * Retry-After header once the limit is exceeded.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function rateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();

  let record = store.get(ip);
  if (!record || now >= record.resetAt) {
    record = { count: 1, resetAt: now + WINDOW_MS };
    store.set(ip, record);
  } else {
    record.count += 1;
  }

  const remaining = Math.max(0, MAX_REQUESTS - record.count);
  const resetSecs = Math.ceil((record.resetAt - now) / 1000);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

  if (record.count > MAX_REQUESTS) {
    logger.warn(`Rate limit exceeded for IP: ${ip}`);
    res.setHeader('Retry-After', resetSecs);
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }

  next();
}

module.exports = { rateLimiter };
