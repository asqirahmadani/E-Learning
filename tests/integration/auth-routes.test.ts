import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { User } from '../../src/db';
import { initTestDatabase, getTestDb, cleanTestDb, closeTestDb } from '../setup';
import { hashPassword, verifyPassword } from '../../src/utils/hash';

// Mock auth routes for testing
const createTestAuthRoutes = () => {
   const db = getTestDb();

   return new Elysia()
      .get('/login', () => 'Login page')

      .post('/register', async ({ body, set }) => {
         const { nama, email, password, role = 'siswa' } = body as any;

         // Validation
         if (!nama || !email || !password) {
            set.status = 400;
            return { success: false, error: 'Missing required fields' };
         }

         // Check if user exists
         const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
         if (existingUser) {
            set.status = 400;
            return { success: false, error: 'Email already exists' };
         }

         // Create user
         const passwordHash = await hashPassword(password);
         const result = db.prepare(`
        INSERT INTO users (nama, email, password_hash, role, status) 
        VALUES (?, ?, ?, ?, 'active')
      `).run(nama, email, passwordHash, role);

         return { success: true, id: result.lastInsertRowid };
      })

      .post('/login', async ({ body, set }) => {
         const { email, password } = body as any;

         if (!email || !password) {
            set.status = 400;
            return { success: false, error: 'Email and password required' };
         }

         // Find user
         const user: any = db.prepare('SELECT * FROM users WHERE email = ? AND status = ?')
            .get(email, 'active');

         if (!user) {
            set.status = 401;
            return { success: false, error: 'Invalid credentials' };
         }

         // Verify password (simplified for test)
         const isValid = await verifyPassword(password, user.password_hash);
         if (!isValid) {
            set.status = 401;
            return { success: false, error: 'Invalid credentials' };
         }

         return {
            success: true,
            user: { id: user.id, nama: user.nama, role: user.role }
         };
      });
};

describe('Auth Routes Integration Tests', () => {
   let app: Elysia;
   let db: any;

   beforeAll(() => {
      db = initTestDatabase();
      app = createTestAuthRoutes();
   });

   afterAll(() => {
      closeTestDb();
   });

   beforeEach(() => {
      cleanTestDb();
   });

   describe('POST /register', () => {
      test('should register new user successfully', async () => {
         const userData = {
            nama: 'Test User',
            email: 'test@example.com',
            password: 'password123'
         };

         const response = await app.handle(
            new Request('http://localhost/register', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(userData)
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.id).toBeDefined();

         // Verify user was created in database
         const user = db.prepare('SELECT * FROM users WHERE email = ?').get(userData.email);
         expect(user).toBeDefined();
         expect(user.nama).toBe(userData.nama);
         expect(user.role).toBe('siswa');
      });

      test('should reject registration with missing fields', async () => {
         const incompleteData = {
            nama: 'Test User'
            // Missing email and password
         };

         const response = await app.handle(
            new Request('http://localhost/register', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(incompleteData)
            })
         );

         expect(response.status).toBe(400);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toContain('Missing required fields');
      });

      test('should reject duplicate email registration', async () => {
         const userData = {
            nama: 'First User',
            email: 'duplicate@example.com',
            password: 'password123'
         };

         // Register first user
         await app.handle(
            new Request('http://localhost/register', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(userData)
            })
         );

         // Try to register with same email
         const duplicateData = {
            nama: 'Second User',
            email: 'duplicate@example.com',
            password: 'different123'
         };

         const response = await app.handle(
            new Request('http://localhost/register', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(duplicateData)
            })
         );

         expect(response.status).toBe(400);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toContain('Email already exists');
      });
   });

   describe('POST /login', () => {
      beforeEach(async () => {
         // Create test user
         const passwordHash = await hashPassword('password123');
         db.prepare(`
        INSERT INTO users (nama, email, password_hash, role, status) 
        VALUES (?, ?, ?, ?, ?)
      `).run('Test User', 'test@example.com', passwordHash, 'siswa', 'active');
      });

      test('should login with valid credentials', async () => {
         const loginData = {
            email: 'test@example.com',
            password: 'password123'
         };

         const response = await app.handle(
            new Request('http://localhost/login', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(loginData)
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.user).toBeDefined();
         expect(data.user.nama).toBe('Test User');
         expect(data.user.role).toBe('siswa');
      });

      test('should reject invalid email', async () => {
         const loginData = {
            email: 'nonexistent@example.com',
            password: 'password123'
         };

         const response = await app.handle(
            new Request('http://localhost/login', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(loginData)
            })
         );

         expect(response.status).toBe(401);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toContain('Invalid credentials');
      });

      test('should reject invalid password', async () => {
         const loginData = {
            email: 'test@example.com',
            password: 'wrongpassword'
         };

         const response = await app.handle(
            new Request('http://localhost/login', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(loginData)
            })
         );

         expect(response.status).toBe(401);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toContain('Invalid credentials');
      });

      test('should reject inactive user', async () => {
         // Create inactive user
         const passwordHash = await hashPassword('password123');
         db.prepare(`
        INSERT INTO users (nama, email, password_hash, role, status) 
        VALUES (?, ?, ?, ?, ?)
      `).run('Inactive User', 'inactive@example.com', passwordHash, 'siswa', 'inactive');

         const loginData = {
            email: 'inactive@example.com',
            password: 'password123'
         };

         const response = await app.handle(
            new Request('http://localhost/login', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(loginData)
            })
         );

         expect(response.status).toBe(401);
         const data = await response.json();
         expect(data.success).toBe(false);
      });
   });
});