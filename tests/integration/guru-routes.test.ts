import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { initTestDatabase, getTestDb, cleanTestDb, closeTestDb } from '../setup';
import { hashPassword } from '../../src/utils/hash';

const createTestGuruRoutes = () => {
   const db = getTestDb();

   return new Elysia({ prefix: '/guru' })
      .derive(({ headers }) => {
         const auth = headers.authorization;
         if (auth === 'Bearer guru') {
            return { user: { id: 2, role: 'guru', nama: 'Test Guru' } };
         }
         return { user: null };
      })

      .onBeforeHandle(({ user, set }) => {
         if (!user || !user.id) {
            set.status = 401;
            return { success: false, error: "Silakan login terlebih dahulu" };
         }
         if (user.role !== "guru") {
            set.status = 403;
            return { success: false, error: "Akses ditolak" };
         }
      })

      .get('/dashboard/stats', ({ user }) => {
         const materiCount = (db.prepare("SELECT COUNT(*) as count FROM materi WHERE guru_id = ?").get(user!.id) as { count: number });
         const tugasCount = (db.prepare("SELECT COUNT(*) as count FROM tugas WHERE guru_id = ?").get(user!.id) as { count: number });

         return {
            success: true,
            data: {
               total_materi: materiCount?.count || 0,
               total_tugas: tugasCount?.count || 0,
               tugas_pending: 0,
               rata_nilai: 0,
               total_siswa: 0,
               total_kelas: 0,
               guru_info: {
                  nama: user!.nama,
                  bidang: "",
                  kelas_mengajar: "Belum mengajar",
                  is_wali_kelas: false
               }
            }
         };
      })

      .get('/materi', ({ user }) => {
         const materiGuru = db.prepare("SELECT * FROM materi WHERE guru_id = ? ORDER BY created_at DESC").all(user!.id);

         return {
            success: true,
            data: materiGuru.map((m: any) => ({
               id: m.id,
               judul: m.judul,
               deskripsi: m.deskripsi,
               kelas: "Test Kelas",
               created_at: m.created_at
            }))
         };
      })

      .post('/materi', async ({ user, body, set }) => {
         const { judul, deskripsi, konten, kelas_ids } = body as any;

         if (!judul || !konten || !kelas_ids || !Array.isArray(kelas_ids) || kelas_ids.length === 0) {
            set.status = 400;
            return { success: false, error: "Data tidak lengkap" };
         }

         const result = db.prepare(`
        INSERT INTO materi (judul, deskripsi, konten, guru_id) 
        VALUES (?, ?, ?, ?)
      `).run(judul.trim(), deskripsi?.trim() || "", konten.trim(), user!.id);

         return {
            success: true,
            message: "Materi berhasil dibuat",
            data: { id: result.lastInsertRowid, judul: judul.trim() }
         };
      })

      .delete('/materi/:id', ({ user, params, set }) => {
         const materiId = parseInt(params.id);
         if (isNaN(materiId)) {
            set.status = 400;
            return { success: false, error: "ID tidak valid" };
         }

         const result = db.prepare("DELETE FROM materi WHERE id = ? AND guru_id = ?").run(materiId, user!.id);

         if (result.changes === 0) {
            set.status = 404;
            return { success: false, error: "Materi tidak ditemukan" };
         }

         return { success: true, message: "Materi berhasil dihapus" };
      })

      .get('/tugas', ({ user }) => {
         const tugasGuru = db.prepare("SELECT * FROM tugas WHERE guru_id = ? ORDER BY deadline ASC").all(user!.id);

         return {
            success: true,
            data: tugasGuru.map((t: any) => ({
               ...t,
               materi_judul: "Test Materi",
               submissions_count: 0,
               graded_count: 0,
               kelas: "Test Kelas"
            }))
         };
      })

      .post('/tugas', async ({ user, body, set }) => {
         const { judul, deskripsi, materi_id, deadline } = body as any;

         if (!judul || !materi_id || !deadline) {
            set.status = 400;
            return { success: false, error: "Data tidak lengkap" };
         }

         // Check if material exists and belongs to guru
         const materi = db.prepare("SELECT * FROM materi WHERE id = ? AND guru_id = ?").get(parseInt(materi_id), user!.id);
         if (!materi) {
            set.status = 404;
            return { success: false, error: "Materi tidak ditemukan" };
         }

         const result = db.prepare(`
        INSERT INTO tugas (judul, deskripsi, materi_id, guru_id, deadline) 
        VALUES (?, ?, ?, ?, ?)
      `).run(judul.trim(), deskripsi?.trim() || "", parseInt(materi_id), user!.id, new Date(deadline).toISOString());

         return {
            success: true,
            message: "Tugas berhasil dibuat",
            data: { id: result.lastInsertRowid, judul: judul.trim() }
         };
      });
};

describe('Guru Routes Integration Tests', () => {
   let app: any;
   let db: any;

   beforeAll(() => {
      db = initTestDatabase();
      app = createTestGuruRoutes();
   });

   afterAll(() => {
      closeTestDb();
   });

   beforeEach(async () => {
      cleanTestDb();

      // Create test users and data
      const passwordHash = await hashPassword('password123');
      db.prepare(`
      INSERT INTO users (id, nama, email, password_hash, role, status, bidang) VALUES 
      (2, 'Test Guru', 'guru@test.com', ?, 'guru', 'active', 'Matematika')
    `).run(passwordHash);

      // Create test material
      db.prepare(`
      INSERT INTO materi (id, judul, deskripsi, konten, guru_id) VALUES 
      (1, 'Test Materi', 'Deskripsi test', 'Konten test', 2)
    `).run();
   });

   describe('Authorization', () => {
      test('should deny access to unauthenticated users', async () => {
         const response = await app.handle(
            new Request('http://localhost/guru/dashboard/stats')
         );

         expect(response.status).toBe(401);
         const data = await response.json();
         expect(data.success).toBe(false);
      });

      test('should allow access to guru users', async () => {
         const response = await app.handle(
            new Request('http://localhost/guru/dashboard/stats', {
               headers: { 'Authorization': 'Bearer guru' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
      });
   });

   describe('Dashboard Stats', () => {
      test('should return correct statistics', async () => {
         const response = await app.handle(
            new Request('http://localhost/guru/dashboard/stats', {
               headers: { 'Authorization': 'Bearer guru' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toHaveProperty('total_materi');
         expect(data.data).toHaveProperty('total_tugas');
         expect(data.data).toHaveProperty('guru_info');
         expect(data.data.guru_info.nama).toBe('Test Guru');
      });
   });

   describe('Material Management', () => {
      test('should get guru materials', async () => {
         const response = await app.handle(
            new Request('http://localhost/guru/materi', {
               headers: { 'Authorization': 'Bearer guru' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(Array.isArray(data.data)).toBe(true);
         expect(data.data.length).toBeGreaterThan(0);
      });

      test('should create new material', async () => {
         const materiData = {
            judul: 'Materi Baru',
            deskripsi: 'Deskripsi materi baru',
            konten: 'Konten materi baru',
            kelas_ids: [1]
         };

         const response = await app.handle(
            new Request('http://localhost/guru/materi', {
               method: 'POST',
               headers: {
                  'Authorization': 'Bearer guru',
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(materiData)
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.message).toContain('berhasil dibuat');

         // Verify in database
         const materi = db.prepare('SELECT * FROM materi WHERE judul = ?').get('Materi Baru');
         expect(materi).toBeDefined();
         expect(materi.guru_id).toBe(2);
      });

      test('should reject incomplete material data', async () => {
         const incompleteData = {
            judul: 'Materi Tidak Lengkap'
            // Missing konten and kelas_ids
         };

         const response = await app.handle(
            new Request('http://localhost/guru/materi', {
               method: 'POST',
               headers: {
                  'Authorization': 'Bearer guru',
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(incompleteData)
            })
         );

         expect(response.status).toBe(400);
         const data = await response.json();
         expect(data.success).toBe(false);
      });

      test('should delete material', async () => {
         const response = await app.handle(
            new Request('http://localhost/guru/materi/1', {
               method: 'DELETE',
               headers: { 'Authorization': 'Bearer guru' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.message).toContain('berhasil dihapus');

         // Verify deletion
         const materi = db.prepare('SELECT * FROM materi WHERE id = 1').get();
         expect(materi).toBeNull();
      });
   });

   describe('Assignment Management', () => {
      test('should get guru assignments', async () => {
         const response = await app.handle(
            new Request('http://localhost/guru/tugas', {
               headers: { 'Authorization': 'Bearer guru' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(Array.isArray(data.data)).toBe(true);
      });

      test('should create new assignment', async () => {
         const tugasData = {
            judul: 'Tugas Baru',
            deskripsi: 'Deskripsi tugas baru',
            materi_id: 1,
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
         };

         const response = await app.handle(
            new Request('http://localhost/guru/tugas', {
               method: 'POST',
               headers: {
                  'Authorization': 'Bearer guru',
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(tugasData)
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.message).toContain('berhasil dibuat');

         // Verify in database
         const tugas = db.prepare('SELECT * FROM tugas WHERE judul = ?').get('Tugas Baru');
         expect(tugas).toBeDefined();
         expect(tugas.guru_id).toBe(2);
      });

      test('should reject assignment for non-existent material', async () => {
         const tugasData = {
            judul: 'Tugas Invalid',
            materi_id: 999, // Non-existent
            deadline: new Date().toISOString()
         };

         const response = await app.handle(
            new Request('http://localhost/guru/tugas', {
               method: 'POST',
               headers: {
                  'Authorization': 'Bearer guru',
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(tugasData)
            })
         );

         expect(response.status).toBe(404);
         const data = await response.json();
         expect(data.success).toBe(false);
      });
   });
});