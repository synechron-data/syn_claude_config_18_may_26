/**
 * Tests for src/auth/authService.js — loginUser
 */

jest.mock('bcryptjs');
const bcrypt = require('bcryptjs');
const { loginUser } = require('../../src/auth/authService');

const mockUserRecord = {
  id: 'user-001',
  email: 'test@example.com',
  passwordHash: '$2a$10$hashedpassword',
  role: 'user'
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loginUser', () => {
  test('throws Invalid credentials when userRecord is null', async () => {
    await expect(loginUser('test@example.com', 'anypass', null))
      .rejects.toThrow('Invalid credentials');
  });

  test('throws Invalid credentials when bcrypt.compare resolves to false', async () => {
    bcrypt.compare.mockResolvedValue(false);
    await expect(loginUser('test@example.com', 'wrongpass', mockUserRecord))
      .rejects.toThrow('Invalid credentials');
  });

  test('returns accessToken, refreshToken, and user when credentials are valid', async () => {
    bcrypt.compare.mockResolvedValue(true);
    const result = await loginUser('test@example.com', 'correctpass', mockUserRecord);
    expect(result).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: { id: 'user-001', email: 'test@example.com', role: 'user' }
    });
  });

  test('does not expose passwordHash in the returned user object', async () => {
    bcrypt.compare.mockResolvedValue(true);
    const { user } = await loginUser('test@example.com', 'correctpass', mockUserRecord);
    expect(user).not.toHaveProperty('passwordHash');
  });
});
