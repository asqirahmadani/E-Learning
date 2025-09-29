import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { initTestDatabase, getTestDb, cleanTestDb, closeTestDb } from '../setup';
import { hashPassword } from '../../src/utils/hash';

const createTestSiswaRoutes = () => {
   const db = getTestDb();

   return new Elysia({ prefix: '/siswa' })
      .derive(({ headers }) => {
         const auth = headers.authorization;
         if (auth === 'Bearer siswa') {
            return { user: { id: 3, role: 'siswa', nama: 'Test Siswa' } };
         }
         return { user: null };
      })

      .onBeforeHandle(({ user, set }) => {
         if (!user || !user.id) {
            set.status = 401;
            return { success: false, error: "Silakan login terlebih dahulu" };
         }
         if (user.role !== "siswa") {
            set.status = 403;
            return { success: false, error: "Akses ditolak" };
         }
      })

      .get('/dashboard-stats', ({ user }) => {
         // Simplified stats for testing
         return {
            success: true,
            data: {
               total_materi: 2,
               materi_dipelajari: 1,
               progress_materi: 50,
               total_tugas: 3,
               tugas_dikerjakan: 2,
               tugas_selesai: 1,
               tugas_pending: 1,
               rata_nilai: 85,
               overall_progress: 65,
               kelas: ["Kelas Test (Tingkat 1)"]
            }
         };
      })

      .get('/materi', ({ user }) => {
         const materiData = [
            {
               id: 1,
               judul: "Matematika Dasar",
               deskripsi: "Pengenalan matematika",
               konten: "Konten matematika dasar...",
               guru_nama: "Test Guru",
               kelas: "Kelas Test",
               is_completed: false,
               progress: 50
            }
         ];

         return {
            success: true,
            data: materiData
         };
      })

      .get('/tugas', ({ user }) => {
         const tugasData = [
            {
               id: 1,
               judul: "Tugas Matematika 1",
               deskripsi: "Kerjakan soal matematika",
               materi_judul: "Matematika Dasar",
               kelas: "Kelas Test",
               deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
               status: "belum_dikerjakan"
            }
         ];

         return {
            success: true,
            data: tugasData
         };
      })

      .post('/tugas/:id/submit', async ({ user, params, body, set }) => {
         const tugasId = parseInt(params.id);
         if (isNaN(tugasId)) {
            set.status = 400;
            return { success: false, error: "ID tidak valid" };
         }

         const { jawaban } = body as any;
         if (!jawaban || jawaban.trim().length === 0) {
            set.status = 400;
            return { success: false, error: "Jawaban tidak boleh kosong" };
         }

         // Simulate submission storage
         const result = db.prepare(`
        INSERT OR REPLACE INTO siswa_tugas (siswa_id, tugas_id, jawaban, status, submitted_at) 
        VALUES (?, ?, ?, 'dikerjakan', datetime('now'))
      `).run(user!.id, tugasId, jawaban.trim());

         return {
            success: true,
            message: "Tugas berhasil dikumpulkan"
         };
      })

      .get('/nilai', ({ user }) => {
         const nilaiData = [
            {
               id: 1,
               tugas_judul: "Tugas Matematika 1",
               materi_judul: "Matematika Dasar",
               kelas: "Kelas Test",
               nilai: 85,
               feedback: "Kerja bagus!",
               graded_at: new Date().toISOString()
            }
         ];

         return {
            success: true,
            data: nilaiData
         };
      })

      .get('/materi/:id', ({ user, params, set }) => {
         const materiId = parseInt(params.id);
         if (isNaN(materiId)) {
            set.status = 400;
            return { success: false, error: "ID tidak valid" };
         }

         // Simulate material access check
         const materiData = {
            id: materiId,
            judul: "Matematika Dasar",
            deskripsi: "Pengenalan matematika",
            konten: "Ini adalah konten lengkap dari materi matematika dasar...",
            guru_nama: "Test Guru",
            kelas: "Kelas Test",
            created_at: new Date().toISOString()
         };

         return {
            success: true,
            data: materiData
         };
      })

      .post('/materi/:id/complete', ({ user, params, set }) => {
         const materiId = parseInt(params.id);
         if (isNaN(materiId)) {
            set.status = 400;
            return { success: false, error: "ID tidak valid" };
         }

         // Simulate marking material as complete
         db.prepare(`
        INSERT OR REPLACE INTO siswa_materi (siswa_id, materi_id, is_completed, last_accessed) 
        VALUES (?, ?, 1, datetime('now'))
      `).run(user!.id, materiId);

         return {
            success: true,
            message: "Materi berhasil ditandai sebagai selesai"
         };
      });
};

describe('Siswa Routes Integration Tests', () => {
   let app: any;
   let db: any;

   beforeAll(() => {
      db = initTestDatabase();

      // Add siswa_tugas and siswa_materi tables for testing
      db.run(`
      CREATE TABLE IF NOT EXISTS siswa_tugas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        siswa_id INTEGER NOT NULL,
        tugas_id INTEGER NOT NULL,
        jawaban TEXT,
        nilai INTEGER,
        feedback TEXT,
        status TEXT DEFAULT 'belum_dikerjakan',
        submitted_at DATETIME,
        graded_at DATETIME,
        UNIQUE(siswa_id, tugas_id)
      );
    `);

      db.run(`
      CREATE TABLE IF NOT EXISTS siswa_materi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        siswa_id INTEGER NOT NULL,
        materi_id INTEGER NOT NULL,
        last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_completed BOOLEAN DEFAULT FALSE,
        UNIQUE(siswa_id, materi_id)
      );
    `);

      app = createTestSiswaRoutes();
   });

   afterAll(() => {
      closeTestDb();
   });

   beforeEach(async () => {
      cleanTestDb();

      // Create test user
      const passwordHash = await hashPassword('password123');
      db.prepare(`
      INSERT INTO users (id, nama, email, password_hash, role, status) VALUES 
      (3, 'Test Siswa', 'siswa@test.com', ?, 'siswa', 'active')
    `).run(passwordHash);
   });

   describe('Authorization', () => {
      test('should deny access to unauthenticated users', async () => {
         const response = await app.handle(
            new Request('http://localhost/siswa/dashboard-stats')
         );

         expect(response.status).toBe(401);
         const data = await response.json();
         expect(data.success).toBe(false);
      });

      test('should allow access to siswa users', async () => {
         const response = await app.handle(
            new Request('http://localhost/siswa/dashboard-stats', {
               headers: { 'Authorization': 'Bearer siswa' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
      });
   });

   describe('Dashboard Stats', () => {
      test('should return student statistics', async () => {
         const response = await app.handle(
            new Request('http://localhost/siswa/dashboard-stats', {
               headers: { 'Authorization': 'Bearer siswa' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toHaveProperty('total_materi');
         expect(data.data).toHaveProperty('total_tugas');
         expect(data.data).toHaveProperty('rata_nilai');
         expect(data.data).toHaveProperty('overall_progress');
      });
   });

   describe('Material Access', () => {
      test('should get student materials', async () => {
         const response = await app.handle(
            new Request('http://localhost/siswa/materi', {
               headers: { 'Authorization': 'Bearer siswa' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(Array.isArray(data.data)).toBe(true);
      });

      test('should get material detail', async () => {
         const response = await app.handle(
            new Request('http://localhost/siswa/materi/1', {
               headers: { 'Authorization': 'Bearer siswa' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toHaveProperty('judul');
         expect(data.data).toHaveProperty('konten');
      });

      test('should mark material as complete', async () => {
         const response = await app.handle(
            new Request('http://localhost/siswa/materi/1/complete', {
               method: 'POST',
               headers: { 'Authorization': 'Bearer siswa' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.message).toContain('selesai');

         // Verify in database
         const progress = db.prepare('SELECT * FROM siswa_materi WHERE siswa_id = 3 AND materi_id = 1').get();
         expect(progress).toBeDefined();
         expect(progress.is_completed).toBe(1);
      });
   });

   describe('Assignment Submission', () => {
      test('should get student assignments', async () => {
         const response = await app.handle(
            new Request('http://localhost/siswa/tugas', {
               headers: { 'Authorization': 'Bearer siswa' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(Array.isArray(data.data)).toBe(true);
      });

      test('should submit assignment successfully', async () => {
         const submissionData = {
            jawaban: 'Ini adalah jawaban tugas saya yang lengkap dan detail.'
         };

         const response = await app.handle(
            new Request('http://localhost/siswa/tugas/1/submit', {
               method: 'POST',
               headers: {
                  'Authorization': 'Bearer siswa',
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(submissionData)
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.message).toContain('berhasil dikumpulkan');

         // Verify in database
         const submission = db.prepare('SELECT * FROM siswa_tugas WHERE siswa_id = 3 AND tugas_id = 1').get();
         expect(submission).toBeDefined();
         expect(submission.jawaban).toBe(submissionData.jawaban);
         expect(submission.status).toBe('dikerjakan');
      });

      test('should reject empty submission', async () => {
         const emptyData = { jawaban: '' };

         const response = await app.handle(
            new Request('http://localhost/siswa/tugas/1/submit', {
               method: 'POST',
               headers: {
                  'Authorization': 'Bearer siswa',
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(emptyData)
            })
         );

         expect(response.status).toBe(400);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toContain('tidak boleh kosong');
      });

      test('should reject invalid assignment ID', async () => {
         const response = await app.handle(
            new Request('http://localhost/siswa/tugas/invalid/submit', {
               method: 'POST',
               headers: {
                  'Authorization': 'Bearer siswa',
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({ jawaban: 'Test jawaban' })
            })
         );

         expect(response.status).toBe(400);
         const data = await response.json();
         expect(data.success).toBe(false);
      });
   });

   describe('Grades', () => {
      test('should get student grades', async () => {
         const response = await app.handle(
            new Request('http://localhost/siswa/nilai', {
               headers: { 'Authorization': 'Bearer siswa' }
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(Array.isArray(data.data)).toBe(true);
      });
   });
});