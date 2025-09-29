import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { hashPassword, verifyPassword } from '../../src/utils/hash';
import { signSession, verifySession } from '../../src/utils/session';
import { initTestDatabase, getTestDb, cleanTestDb, closeTestDb } from '../setup';
import { Role } from '../../src/db';

describe('Authentication Unit Tests', () => {
   let db: any;

   beforeAll(() => {
      db = initTestDatabase();
   });

   afterAll(() => {
      closeTestDb();
   });

   beforeEach(() => {
      cleanTestDb();
   });

   describe('Password Hashing', () => {
      test('should hash password correctly', async () => {
         const password = 'testpassword123';
         const hash = await hashPassword(password);

         expect(hash).toBeDefined();
         expect(hash).not.toBe(password);
         expect(hash.length).toBeGreaterThan(50);
      });

      test('should verify correct password', async () => {
         const password = 'testpassword123';
         const hash = await hashPassword(password);
         const isValid = await verifyPassword(password, hash);

         expect(isValid).toBe(true);
      });

      test('should reject incorrect password', async () => {
         const password = 'testpassword123';
         const wrongPassword = 'wrongpassword';
         const hash = await hashPassword(password);
         const isValid = await verifyPassword(wrongPassword, hash);

         expect(isValid).toBe(false);
      });
   });

   describe('Session Management', () => {
      test('should create and verify session token', () => {
         const payload = { userId: 1, role: 'siswa' as Role, issuedAt: Math.floor(Date.now() / 1000) };
         const secret = 'test_secret';

         const token = signSession(payload, secret);
         expect(token).toBeDefined();
         expect(typeof token).toBe('string');

         const verified = verifySession(token, secret);
         expect(verified).toEqual(payload);
      });

      test('should reject invalid token', () => {
         const invalidToken = 'invalid.token.here';
         const secret = 'test_secret';

         const verified = verifySession(invalidToken, secret);
         expect(verified).toBeNull();
      });

      test('should reject token with wrong secret', () => {
         const payload = { userId: 1, role: 'siswa' as Role, issuedAt: Math.floor(Date.now() / 1000) };
         const token = signSession(payload, 'correct_secret');

         const verified = verifySession(token, 'wrong_secret');
         expect(verified).toBeNull();
      });
   });
});