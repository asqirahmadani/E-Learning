import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { initTestDatabase, getTestDb, cleanTestDb, closeTestDb } from '../setup';
import { hashPassword } from '../../src/utils/hash';

const createTestKepsekRoutes = () => {
   const db = getTestDb();

   return new Elysia()
      // Mock auth middleware
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

      .onBeforeHandle(({ user, set }) => {
         if (!user || user.role !== 'kepsek') {
            set.status = 403;
            return { success: false, error: 'Akses ditolak' };
         }
      })

      .get('/kepsek/info-dasar', () => {
         const stats = {
            jumlah_guru: (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'guru'").get() as { count: number }).count,
            jumlah_siswa: (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'siswa'").get() as { count: number }).count,
            jumlah_kelas: (db.prepare("SELECT COUNT(*) as count FROM kelas").get() as { count: number }).count,
            jumlah_materi: 0 // Simplified
         };

         return { success: true, data: stats };
      })

      .get('/kepsek/guru/daftar', () => {
         const gurus = db.prepare("SELECT * FROM users WHERE role = 'guru'").all();
         return { success: true, data: gurus };
      })

      .post('/kepsek/guru/tambah', async ({ body, user, set }) => {
         const { nama, email, password, bidang } = body as any;

         if (!nama || !email || !password) {
            set.status = 400;
            return { success: false, error: 'Data tidak lengkap' };
         }

         // Check duplicate email
         const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
         if (exists) {
            set.status = 400;
            return { success: false, error: 'Email sudah terdaftar' };
         }

         // Create guru
         const passwordHash = await hashPassword(password);
         const result = db.prepare(`
        INSERT INTO users (nama, email, password_hash, role, status, created_by, bidang) 
        VALUES (?, ?, ?, 'guru', 'active', ?, ?)
      `).run(nama, email, passwordHash, user!.id, bidang || null);

         return {
            success: true,
            message: 'Guru berhasil ditambahkan',
            data: { id: result.lastInsertRowid, nama, email }
         };
      })

      .delete('/kepsek/guru/hapus/:id', ({ params, set }) => {
         const id = parseInt(params.id);
         if (isNaN(id)) {
            set.status = 400;
            return { success: false, error: 'ID tidak valid' };
         }

         const result = db.prepare("DELETE FROM users WHERE id = ? AND role = 'guru'").run(id);

         if (result.changes === 0) {
            set.status = 404;
            return { success: false, error: 'Guru tidak ditemukan' };
         }

         return { success: true, message: 'Guru berhasil dihapus' };
      });
};

describe('Kepsek Routes Integration Tests', () => {
   let app: any;
   let db: any;

   beforeAll(() => {
      db = initTestDatabase();
      app = createTestKepsekRoutes();
   });

   afterAll(() => {
      closeTestDb();
   });

   beforeEach(() => {
      cleanTestDb();

      // Create test users
      const passwordHash = 'hashed_password'; // Simplified for testing
      db.prepare(`
      INSERT INTO users (id, nama, email, password_hash, role, status) VALUES 
      (1, 'Test Kepsek', 'kepsek@test.com', ?, 'kepsek', 'active'),
      (2, 'Test Guru', 'guru@test.com', ?, 'guru', 'active'),
      (3, 'Test Siswa', 'siswa@test.com', ?, 'siswa', 'active')
    `).run(passwordHash, passwordHash, passwordHash);
   });

   describe('Authorization', () => {
      test('should allow kepsek access', async () => {
         const response = await app.handle(
            new Request('http://localhost/kepsek/info-dasar', {
               headers: { 'Authorization': 'Bearer kepsek' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
      });

      test('should deny guru access', async () => {
         const response = await app.handle(
            new Request('http://localhost/kepsek/info-dasar', {
               headers: { 'Authorization': 'Bearer guru' }
            })
         );

         expect(response.status).toBe(403);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toContain('Akses ditolak');
      });

      test('should deny siswa access', async () => {
         const response = await app.handle(
            new Request('http://localhost/kepsek/info-dasar', {
               headers: { 'Authorization': 'Bearer siswa' }
            })
         );

         expect(response.status).toBe(403);
      });

      test('should deny unauthenticated access', async () => {
         const response = await app.handle(
            new Request('http://localhost/kepsek/info-dasar')
         );

         expect(response.status).toBe(403);
      });
   });

   describe('Guru Management', () => {
      test('should add new guru successfully', async () => {
         const guruData = {
            nama: 'New Guru',
            email: 'newguru@test.com',
            password: 'password123',
            bidang: 'Matematika'
         };

         const response = await app.handle(
            new Request('http://localhost/kepsek/guru/tambah', {
               method: 'POST',
               headers: {
                  'Authorization': 'Bearer kepsek',
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(guruData)
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.message).toContain('berhasil ditambahkan');

         // Verify in database
         const guru = db.prepare('SELECT * FROM users WHERE email = ?').get(guruData.email);
         expect(guru).toBeDefined();
         expect(guru.role).toBe('guru');
         expect(guru.bidang).toBe('Matematika');
      });

      test('should reject duplicate email', async () => {
         const guruData = {
            nama: 'Duplicate Guru',
            email: 'guru@test.com', // Already exists
            password: 'password123'
         };

         const response = await app.handle(
            new Request('http://localhost/kepsek/guru/tambah', {
               method: 'POST',
               headers: {
                  'Authorization': 'Bearer kepsek',
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(guruData)
            })
         );

         expect(response.status).toBe(400);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toContain('Email sudah terdaftar');
      });

      test('should delete guru successfully', async () => {
         const response = await app.handle(
            new Request('http://localhost/kepsek/guru/hapus/2', {
               method: 'DELETE',
               headers: { 'Authorization': 'Bearer kepsek' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.message).toContain('berhasil dihapus');

         // Verify deletion
         const guru = db.prepare('SELECT * FROM users WHERE id = 2').get();
         expect(guru).toBeNull();
      });

      test('should return 404 for non-existent guru', async () => {
         const response = await app.handle(
            new Request('http://localhost/kepsek/guru/hapus/999', {
               method: 'DELETE',
               headers: { 'Authorization': 'Bearer kepsek' }
            })
         );

         expect(response.status).toBe(404);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toContain('tidak ditemukan');
      });
   });
});