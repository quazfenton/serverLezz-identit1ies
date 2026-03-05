/**
 * Auth Routes Unit Tests
 * Tests for registration, login, token refresh, and session management
 */

import request from 'supertest';
import express, { Express } from 'express';
import { ProfileService } from '../../services/ProfileService';
import { IProfilesRepo, Profile } from '../../../shared/types';
import { hashPassword } from '../../middleware/auth';

// Mock repository
class MockProfilesRepo implements IProfilesRepo {
  private store: Map<string, Profile> = new Map();

  async getById(id: string): Promise<Profile | undefined> {
    return this.store.get(id);
  }

  async save(profile: Profile): Promise<void> {
    this.store.set(profile.id, profile);
  }

  async getAll(): Promise<Profile[]> {
    return Array.from(this.store.values());
  }

  async getByEmail(email: string): Promise<Profile | undefined> {
    return Array.from(this.store.values()).find(
      p => p.email?.toLowerCase() === email.toLowerCase()
    );
  }
}

describe('Auth Routes', () => {
  let app: Express;
  let profilesRepo: MockProfilesRepo;
  let profileService: ProfileService;

  const validRegistration = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'SecurePass123',
    location: { latitude: 37.7749, longitude: -122.4194 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    
    profilesRepo = new MockProfilesRepo();
    profileService = new ProfileService(profilesRepo);
    
    // Add app locals for routes
    (app.locals as any).profileService = profileService;
    
    // Import routes after setting up app
    const authRoutes = require('../../routes/auth').default;
    app.use('/api/auth', authRoutes);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.name).toBe('Test User');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    it('should reject registration with missing name', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistration, name: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistration, email: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistration, email: 'invalid-email' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with weak password (too short)', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistration, password: 'weak' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with password missing uppercase', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistration, password: 'lowercase123' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with password missing lowercase', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistration, password: 'UPPERCASE123' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with password missing numbers', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistration, password: 'NoNumbersHere' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already registered');
    });

    it('should normalize email to lowercase', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistration, email: 'TEST@EXAMPLE.COM' })
        .expect(201);

      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should accept optional location', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test2@example.com',
          password: 'SecurePass123',
        })
        .expect(201);

      expect(response.body.user).toBeDefined();
    });

    it('should reject invalid latitude', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistration,
          location: { latitude: 100, longitude: -122.4194 },
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid longitude', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistration,
          location: { latitude: 37.7749, longitude: -200 },
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a user for login tests
      await request(app)
        .post('/api/auth/register')
        .send(validRegistration);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body).toHaveProperty('tokens');
    });

    it('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'SecurePass123' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid', password: 'SecurePass123' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePass123',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle email case-insensitively', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'TEST@EXAMPLE.COM',
          password: 'SecurePass123',
        })
        .expect(200);

      expect(response.body.user.email).toBe('test@example.com');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get refresh token
      await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123',
        });

      refreshToken = loginResponse.body.tokens.refreshToken;
    });

    it('should refresh token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject refresh with missing token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123',
        });

      accessToken = loginResponse.body.tokens.accessToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject logout with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123',
        });

      accessToken = loginResponse.body.tokens.accessToken;
    });

    it('should return current user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});
