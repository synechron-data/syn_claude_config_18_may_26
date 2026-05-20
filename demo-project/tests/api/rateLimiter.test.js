/**
 * Tests for src/api/rateLimiter.js
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 100;

let rateLimiter;

// Fake timers control Date.now() inside the module and prevent setInterval firing
beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

// Fresh module = fresh in-memory store and a known clock for every test
beforeEach(() => {
  jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  jest.resetModules();
  ({ rateLimiter } = require('../../src/api/rateLimiter'));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq({ ip = '127.0.0.1', forwarded } = {}) {
  return {
    headers: forwarded !== undefined ? { 'x-forwarded-for': forwarded } : {},
    socket: { remoteAddress: ip }
  };
}

function makeRes() {
  const headers = {};
  return {
    headers,
    setHeader: jest.fn((key, val) => { headers[key] = val; }),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

function sendRequests(req, count) {
  const next = jest.fn();
  for (let i = 0; i < count; i++) {
    rateLimiter(req, makeRes(), next);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Response headers
// ---------------------------------------------------------------------------

describe('response headers', () => {
  test('sets X-RateLimit-Limit to 100', () => {
    const res = makeRes();
    rateLimiter(makeReq(), res, jest.fn());
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', MAX_REQUESTS);
  });

  test('sets X-RateLimit-Remaining to 99 after the first request', () => {
    const res = makeRes();
    rateLimiter(makeReq(), res, jest.fn());
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 99);
  });

  test('sets X-RateLimit-Reset to epoch seconds matching the window end', () => {
    const res = makeRes();
    rateLimiter(makeReq(), res, jest.fn());
    const expectedReset = Math.ceil((Date.now() + WINDOW_MS) / 1000);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expectedReset);
  });

  test('decrements X-RateLimit-Remaining with each successive request', () => {
    const req = makeReq({ ip: '10.0.0.1' });
    for (let i = 1; i <= 5; i++) {
      const res = makeRes();
      rateLimiter(req, res, jest.fn());
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', MAX_REQUESTS - i);
    }
  });

  test('clamps X-RateLimit-Remaining to 0 when limit is exceeded', () => {
    const req = makeReq({ ip: '10.0.0.2' });
    sendRequests(req, MAX_REQUESTS + 1); // exhaust + 1 over

    const res = makeRes();
    rateLimiter(req, res, jest.fn());
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
  });
});

// ---------------------------------------------------------------------------
// Request counting and 429 enforcement
// ---------------------------------------------------------------------------

describe('request counting and limiting', () => {
  test('calls next() for a single request well within the limit', () => {
    const next = jest.fn();
    rateLimiter(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('allows exactly 100 requests — each calls next()', () => {
    const next = sendRequests(makeReq({ ip: '10.1.1.1' }), MAX_REQUESTS);
    expect(next).toHaveBeenCalledTimes(MAX_REQUESTS);
  });

  test('the 101st request returns 429', () => {
    const req = makeReq({ ip: '10.1.1.2' });
    sendRequests(req, MAX_REQUESTS);

    const res = makeRes();
    rateLimiter(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('429 response body contains the expected error message', () => {
    const req = makeReq({ ip: '10.1.1.3' });
    sendRequests(req, MAX_REQUESTS);

    const res = makeRes();
    rateLimiter(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({
      error: 'Too many requests, please try again later'
    });
  });

  test('does not call next() when the limit is exceeded', () => {
    const req = makeReq({ ip: '10.1.1.4' });
    const next = sendRequests(req, MAX_REQUESTS); // all 100 pass
    next.mockClear();

    rateLimiter(req, makeRes(), next); // 101st — must not call next
    expect(next).not.toHaveBeenCalled();
  });

  test('sets a positive Retry-After header on 429 responses', () => {
    const req = makeReq({ ip: '10.1.1.5' });
    sendRequests(req, MAX_REQUESTS);

    const res = makeRes();
    rateLimiter(req, res, jest.fn());

    const retryAfterCall = res.setHeader.mock.calls.find(([key]) => key === 'Retry-After');
    expect(retryAfterCall).toBeDefined();
    expect(Number(retryAfterCall[1])).toBeGreaterThan(0);
  });

  test('Retry-After does not exceed WINDOW_MS in seconds', () => {
    const req = makeReq({ ip: '10.1.1.6' });
    sendRequests(req, MAX_REQUESTS);

    const res = makeRes();
    rateLimiter(req, res, jest.fn());

    const retryAfterCall = res.setHeader.mock.calls.find(([key]) => key === 'Retry-After');
    expect(Number(retryAfterCall[1])).toBeLessThanOrEqual(WINDOW_MS / 1000);
  });

  test('continues to block requests beyond the 101st', () => {
    const req = makeReq({ ip: '10.1.1.7' });
    sendRequests(req, MAX_REQUESTS);

    for (let i = 0; i < 5; i++) {
      const res = makeRes();
      rateLimiter(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(429);
    }
  });
});

// ---------------------------------------------------------------------------
// Window reset
// ---------------------------------------------------------------------------

describe('window reset', () => {
  test('resets the counter after WINDOW_MS elapses', () => {
    const req = makeReq({ ip: '10.2.0.1' });
    sendRequests(req, MAX_REQUESTS + 1); // exhaust + trigger 429

    jest.setSystemTime(Date.now() + WINDOW_MS + 1);

    const next = jest.fn();
    const res = makeRes();
    rateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(429);
  });

  test('X-RateLimit-Remaining returns to 99 after the window resets', () => {
    const req = makeReq({ ip: '10.2.0.2' });
    sendRequests(req, MAX_REQUESTS);

    jest.setSystemTime(Date.now() + WINDOW_MS + 1);

    const res = makeRes();
    rateLimiter(req, res, jest.fn());
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 99);
  });

  test('request 1ms before window expiry is still blocked', () => {
    const req = makeReq({ ip: '10.2.0.3' });
    sendRequests(req, MAX_REQUESTS); // count = 100, resetAt = startTime + WINDOW_MS
    const startTime = Date.now();

    // 1ms before resetAt: now < resetAt so window does NOT reset
    jest.setSystemTime(startTime + WINDOW_MS - 1);

    const next = jest.fn();
    sendRequests(req, 1); // count becomes 101
    const res = makeRes();
    rateLimiter(req, res, next); // count = 102, still over limit
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

// ---------------------------------------------------------------------------
// IP isolation
// ---------------------------------------------------------------------------

describe('IP isolation', () => {
  test('tracks different IPs independently', () => {
    const reqA = makeReq({ ip: '192.168.1.1' });
    const reqB = makeReq({ ip: '192.168.1.2' });

    sendRequests(reqA, MAX_REQUESTS + 1); // exhaust A

    const next = jest.fn();
    const res = makeRes();
    rateLimiter(reqB, res, next); // B should be unaffected

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(429);
  });

  test('exhausting one IP does not reduce remaining count for another', () => {
    const reqA = makeReq({ ip: '192.168.2.1' });
    const reqB = makeReq({ ip: '192.168.2.2' });

    sendRequests(reqA, MAX_REQUESTS);

    const res = makeRes();
    rateLimiter(reqB, res, jest.fn());
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 99);
  });

  test('two different IPs can independently exhaust their own windows', () => {
    const reqA = makeReq({ ip: '192.168.3.1' });
    const reqB = makeReq({ ip: '192.168.3.2' });

    sendRequests(reqA, MAX_REQUESTS + 1);
    sendRequests(reqB, MAX_REQUESTS + 1);

    // Both should now be blocked
    const resA = makeRes();
    rateLimiter(reqA, resA, jest.fn());
    expect(resA.status).toHaveBeenCalledWith(429);

    const resB = makeRes();
    rateLimiter(reqB, resB, jest.fn());
    expect(resB.status).toHaveBeenCalledWith(429);
  });
});

// ---------------------------------------------------------------------------
// IP resolution (getClientIp, tested indirectly through rateLimiter)
// ---------------------------------------------------------------------------

describe('IP resolution', () => {
  test('uses X-Forwarded-For over socket.remoteAddress', () => {
    const forwardedIp = '203.0.113.1';
    const socketIp = '10.10.10.10';

    // Exhaust the forwarded IP
    sendRequests(makeReq({ ip: socketIp, forwarded: forwardedIp }), MAX_REQUESTS + 1);

    // The socket IP alone (no X-Forwarded-For) should be a fresh counter
    const next = jest.fn();
    const res = makeRes();
    rateLimiter(makeReq({ ip: socketIp }), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(429);
  });

  test('uses the leftmost IP from a comma-separated X-Forwarded-For value', () => {
    const firstIp = '203.0.113.10';

    sendRequests(
      makeReq({ forwarded: `${firstIp}, 10.0.0.1, 10.0.0.2` }),
      MAX_REQUESTS + 1
    );

    // A different proxy chain that shares the same leftmost IP must also be blocked
    const res = makeRes();
    rateLimiter(makeReq({ forwarded: `${firstIp}, 172.16.0.1` }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('trims whitespace from X-Forwarded-For entries', () => {
    const firstIp = '203.0.113.20';

    // Exhaust with padded header
    sendRequests(makeReq({ forwarded: `  ${firstIp}  , 10.0.0.1` }), MAX_REQUESTS + 1);

    // Un-padded same IP should be blocked (same key after trimming)
    const res = makeRes();
    rateLimiter(makeReq({ forwarded: `${firstIp}, 10.0.0.1` }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('falls back to socket.remoteAddress when X-Forwarded-For is absent', () => {
    const socketIp = '198.51.100.1';
    sendRequests(makeReq({ ip: socketIp }), MAX_REQUESTS + 1);

    const res = makeRes();
    rateLimiter(makeReq({ ip: socketIp }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('uses "unknown" when no IP source is available and tracks those requests together', () => {
    const req = { headers: {}, socket: { remoteAddress: undefined } };

    // Send 3 requests — all should share the same "unknown" key
    rateLimiter(req, makeRes(), jest.fn());
    rateLimiter(req, makeRes(), jest.fn());

    const res = makeRes();
    rateLimiter(req, res, jest.fn());
    // 3rd request → count=3, remaining = 100-3 = 97
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 97);
  });

  test('"unknown" IP can also hit the rate limit', () => {
    const req = { headers: {}, socket: { remoteAddress: undefined } };
    sendRequests(req, MAX_REQUESTS + 1);

    const res = makeRes();
    rateLimiter(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
