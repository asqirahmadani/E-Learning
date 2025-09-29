import { Database } from 'bun:sqlite';
import { beforeAll, afterAll, beforeEach } from 'bun:test';

let testDb: Database;

export const initTestDatabase = () => {
  // Use in-memory SQLite for fast tests
  testDb = new Database(':memory:');

  // Create tables for testing - use run() instead of exec()
  const createTables = `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('kepsek', 'guru', 'siswa')),
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      login_count INTEGER DEFAULT 0,
      last_activity DATETIME,
      bidang TEXT
    );
  `;

  testDb.run(createTables);

  testDb.run(`
    CREATE TABLE kelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      tingkat TEXT NOT NULL,
      wali_kelas_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wali_kelas_id) REFERENCES users(id)
    );
  `);

  testDb.run(`
    CREATE TABLE siswa_kelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siswa_id INTEGER NOT NULL,
      kelas_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (siswa_id) REFERENCES users(id),
      FOREIGN KEY (kelas_id) REFERENCES kelas(id),
      UNIQUE(siswa_id, kelas_id)
    );
  `);

  testDb.run(`
    CREATE TABLE guru_kelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guru_id INTEGER NOT NULL,
      kelas_id INTEGER NOT NULL,
      mata_pelajaran TEXT NOT NULL,
      FOREIGN KEY (guru_id) REFERENCES users(id),
      FOREIGN KEY (kelas_id) REFERENCES kelas(id),
      UNIQUE(guru_id, kelas_id, mata_pelajaran)
    );
  `);

  testDb.run(`
    CREATE TABLE materi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judul TEXT NOT NULL,
      deskripsi TEXT,
      konten TEXT NOT NULL,
      guru_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (guru_id) REFERENCES users(id)
    );
  `);

  testDb.run(`
    CREATE TABLE tugas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judul TEXT NOT NULL,
      deskripsi TEXT,
      materi_id INTEGER NOT NULL,
      guru_id INTEGER NOT NULL,
      deadline DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (materi_id) REFERENCES materi(id),
      FOREIGN KEY (guru_id) REFERENCES users(id)
    );
  `);

  return testDb;
};

export const getTestDb = () => testDb;

export const cleanTestDb = () => {
  // Clean tables in correct order to respect foreign key constraints
  testDb.run('DELETE FROM guru_kelas');
  testDb.run('DELETE FROM siswa_kelas');
  testDb.run('DELETE FROM tugas');
  testDb.run('DELETE FROM materi');
  testDb.run('DELETE FROM kelas');
  testDb.run('DELETE FROM users');
};

export const closeTestDb = () => {
  if (testDb) {
    testDb.close();
  }
};