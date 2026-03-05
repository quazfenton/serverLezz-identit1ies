// Jest Setup File
import { jest } from '@jest/globals';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-min-32-chars';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-min-32';

// Mock crypto.randomBytes for deterministic tests
jest.mock('crypto', () => ({
  randomBytes: (length: number) => Buffer.from('a'.repeat(length * 2)),
  createHash: (algo: string) => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mocked-hash'),
  }),
}));

// Global test timeout
jest.setTimeout(10000);

// Helper function to create mock request
export function createMockRequest(overrides: any = {}) {
  return {
    headers: {},
    body: {},
    query: {},
    params: {},
    ip: '127.0.0.1',
    get: jest.fn(),
    ...overrides,
  };
}

// Helper function to create mock response
export function createMockResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
}

// Helper function to create mock next function
export function createMockNext() {
  return jest.fn();
}
