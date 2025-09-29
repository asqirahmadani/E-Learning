import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { initTestDatabase, getTestDb, cleanTestDb, closeTestDb } from '../setup';
import { hashPassword } from '../../src/utils/hash';

const createTestDashboardRoutes = () => {
   const db = getTestDb();

   return new Elysia()
      .derive(({ headers }) => {
         const auth = headers.authorization;
         if (auth === 'Bearer kepsek') {
            return { user: { id: 1, role: 'kepsek', nama: 'Test Kepsek' } };
         }
         if (auth === 'Bearer guru') {
            return { user: { id: 2, role: 'guru', nama: 'Test Guru' } };
         }
         if (auth === 'Bearer siswa') {
            return { user: { id: 3, role: 'siswa', nama: 'Test Siswa' } };
         }
         return { user: null };
      })

      .get('/dashboard', ({ set, user }) => {
         if (!user) {
            set.status = 302;
            set.headers = { Location: '/login?error=Silakan login terlebih dahulu' };
            return;
         }

         const userData = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
         if (!userData) {
            set.status = 302;
            set.headers = { Location: '/login?error=Data user tidak ditemukan' };
            return;
         }

         set.headers = { 'Content-Type': 'text/html; charset=utf-8' };
         return `Dashboard ${user.role} - ${user.nama}`;
      });
};

describe('Dashboard Routes Integration Tests', () => {
   let app: any;
   let db: any;

   beforeAll(() => {
      db = initTestDatabase();
      app = createTestDashboardRoutes();
   });

   afterAll(() => {
      closeTestDb();
   });

   beforeEach(async () => {
      cleanTestDb();

      // Create test users
      const passwordHash = await hashPassword('password123');
      db.prepare(`
      INSERT INTO users (id, nama, email, password_hash, role, status) VALUES 
      (1, 'Test Kepsek', 'kepsek@test.com', ?, 'kepsek', 'active'),
      (2, 'Test Guru', 'guru@test.com', ?, 'guru', 'active'),
      (3, 'Test Siswa', 'siswa@test.com', ?, 'siswa', 'active')
    `).run(passwordHash, passwordHash, passwordHash);
   });

   describe('GET /dashboard', () => {
      test('should redirect unauthenticated users to login', async () => {
         const response = await app.handle(
            new Request('http://localhost/dashboard')
         );

         expect(response.status).toBe(302);
         expect(response.headers.get('Location')).toContain('/login');
      });

      test('should render kepsek dashboard for kepsek user', async () => {
         const response = await app.handle(
            new Request('http://localhost/dashboard', {
               headers: { 'Authorization': 'Bearer kepsek' }
            })
         );

         expect(response.status).toBe(200);
         expect(response.headers.get('Content-Type')).toContain('text/html');
         const content = await response.text();
         expect(content).toContain('Dashboard kepsek');
      });

      test('should render guru dashboard for guru user', async () => {
         const response = await app.handle(
            new Request('http://localhost/dashboard', {
               headers: { 'Authorization': 'Bearer guru' }
            })
         );

         expect(response.status).toBe(200);
         const content = await response.text();
         expect(content).toContain('Dashboard guru');
      });

      test('should render siswa dashboard for siswa user', async () => {
         const response = await app.handle(
            new Request('http://localhost/dashboard', {
               headers: { 'Authorization': 'Bearer siswa' }
            })
         );

         expect(response.status).toBe(200);
         const content = await response.text();
         expect(content).toContain('Dashboard siswa');
      });
   });
});
