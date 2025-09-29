import mysql from 'mysql2/promise';
import { hashPassword } from "./utils/hash";

export type Role = "kepsek" | "guru" | "siswa";

export interface User {
  id: number;
  nama: string;
  email: string;
  password_hash: string;
  role: Role;
  status: 'active' | 'inactive';
  created_by?: number;
  created_at: Date;
  last_login?: Date;
  login_count?: number;
  last_activity?: Date;
  bidang?: string;
}

export interface Kelas {
  id: number;
  nama: string;
  tingkat: string;
  wali_kelas_id: number;
  created_at: Date;
}

export interface Materi {
  id: number;
  judul: string;
  deskripsi: string;
  konten: string;
  guru_id: number;
  created_at: Date;
  updated_at?: Date;
}

export interface Diskusi {
  id: number;
  kelas: string;
  isi: string;
  user_id: number;
  user_role: Role;
  created_at: Date;
}

export interface Tugas {
  id: number;
  judul: string;
  deskripsi: string;
  materi_id: number;
  guru_id: number;
  deadline: Date;
  created_at: Date;
  updated_at?: Date;
}

export interface DiskusiMateri {
  id: number;
  materi_id: number;
  user_id: number;
  user_role: Role;
  isi: string;
  parent_id?: number;
  created_at: Date;
}

export interface SiswaTugas {
  id: number;
  siswa_id: number;
  tugas_id: number;
  jawaban?: string;
  nilai?: number;
  feedback?: string;
  status: 'belum_dikerjakan' | 'dikerjakan' | 'selesai';
  submitted_at?: Date;
  graded_at?: Date;
  created_at: Date;
}

export interface SiswaMateri {
  id: number;
  siswa_id: number;
  materi_id: number;
  last_accessed: Date;
  is_completed: boolean;
}

export interface GuruKelas {
  id: number;
  guru_id: number;
  kelas_id: number;
  mata_pelajaran: string;
}

export interface MateriKelas {
  id: number;
  materi_id: number;
  kelas_id: number;
  created_at: Date;
}

export interface SiswaKelas {
  id: number;
  siswa_id: number;
  kelas_id: number;
  created_at: Date;
}


let pool: mysql.Pool;

export function initializeDatabase() {
  pool = mysql.createPool({
    host: process.env.HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT) : 3306,
    connectionLimit: 10,
    connectTimeout: 60000,
    idleTimeout: 60000
  });

  return pool;
}

export async function query(sql: string, params: any[] = []) {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }

  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}


export async function getUsers(): Promise<User[]> {
  const rows = await query('SELECT * FROM users');
  return rows as User[];
}

export async function getKelas(): Promise<Kelas[]> {
  const rows = await query('SELECT * FROM kelas');
  return rows as Kelas[];
}

export async function getMateri(): Promise<Materi[]> {
  const rows = await query('SELECT * FROM materi');
  return rows as Materi[];
}

export async function getDiskusi(): Promise<Diskusi[]> {
  const rows = await query('SELECT * FROM diskusi');
  return rows as Diskusi[];
}

export async function getTugas(): Promise<Tugas[]> {
  const rows = await query('SELECT * FROM tugas');
  return rows as Tugas[];
}

export async function getDiskusiMateri(): Promise<DiskusiMateri[]> {
  const rows = await query('SELECT * FROM diskusi_materi');
  return rows as DiskusiMateri[];
}

export async function getSiswaTugas(): Promise<SiswaTugas[]> {
  const rows = await query('SELECT * FROM siswa_tugas');
  return rows as SiswaTugas[];
}

export async function getSiswaMateri(): Promise<SiswaMateri[]> {
  const rows = await query('SELECT * FROM siswa_materi');
  return rows as SiswaMateri[];
}

export async function getGuruKelas(): Promise<GuruKelas[]> {
  const rows = await query('SELECT * FROM guru_kelas');
  return rows as GuruKelas[];
}

export async function getMateriKelas(): Promise<MateriKelas[]> {
  const rows = await query('SELECT * FROM materi_kelas');
  return rows as MateriKelas[];
}

export async function getSiswaKelas(): Promise<SiswaKelas[]> {
  const rows = await query('SELECT * FROM siswa_kelas');
  return rows as SiswaKelas[];
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
  return (rows as User[])[0] || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
  return (rows as User[])[0] || null
}

export async function getKelasById(id: number): Promise<Kelas | null> {
  const rows = await query('SELECT * FROM kelas WHERE id = ?', [id]);
  return (rows as Kelas[])[0] || null;
}

export async function getMateriById(id: number): Promise<Materi | null> {
  const rows = await query('SELECT * FROM materi WHERE id = ?', [id]);
  return (rows as Materi[])[0] || null;
}


export async function getKelasForMateri(materiId: number): Promise<Kelas[]> {
  const rows = await query(`
    SELECT k.* FROM kelas k
    JOIN materi_kelas mk ON k.id = mk.kelas_id
    WHERE mk.materi_id = ?
  `, [materiId]);

  return rows as Kelas[];
}

export async function getMateriForKelas(kelasId: number): Promise<Materi[]> {
  const rows = await query(`
    SELECT m.* FROM materi m
    JOIN materi_kelas mk ON m.id = mk.materi_id
    WHERE mk.kelas_id = ?
  `, [kelasId]);

  return rows as Materi[];
}

export async function getKelasForSiswa(siswaId: number): Promise<Kelas[]> {
  const rows = await query(`
    SELECT k.* FROM kelas k
    JOIN siswa_kelas sk ON k.id = sk.kelas_id
    WHERE sk.siswa_id = ?
  `, [siswaId]);

  return rows as Kelas[];
}

export async function getSiswaForKelas(kelasId: number): Promise<User[]> {
  const rows = await query(`
    SELECT u.* FROM users u
    JOIN siswa_kelas sk ON u.id = sk.siswa_id
    WHERE sk.kelas_id = ? AND u.role = 'siswa'
  `, [kelasId]);

  return rows as User[];
}

export async function getTugasForKelas(kelasId: number): Promise<Tugas[]> {
  const materiIds = (await getMateriForKelas(kelasId)).map(m => m.id);

  if (materiIds.length === 0) return [];

  const placeholders = materiIds.map(() => '?').join(',');
  const rows = await query(`
    SELECT * FROM tugas 
    WHERE materi_id IN (${placeholders})
  `, materiIds);

  return rows as Tugas[];
}

export async function getTugasForSiswa(siswaId: number): Promise<Tugas[]> {
  const kelasSiswa = await getKelasForSiswa(siswaId);
  const semuaTugasPromises = kelasSiswa.map(k => getTugasForKelas(k.id));
  const semuaTugasArrays = await Promise.all(semuaTugasPromises);
  const semuaTugas = semuaTugasArrays.flat();


  const uniqueTugas = semuaTugas.filter((tugas, index, self) =>
    index === self.findIndex(t => t.id === tugas.id)
  );

  return uniqueTugas;
}

export async function getSubmissionForSiswa(siswaId: number, tugasId?: number): Promise<SiswaTugas | SiswaTugas[] | null> {
  if (tugasId) {
    const rows = await query(`
      SELECT * FROM siswa_tugas 
      WHERE siswa_id = ? AND tugas_id = ?
    `, [siswaId, tugasId]);

    return (rows as SiswaTugas[])[0] || null;
  } else {
    const rows = await query(`
      SELECT * FROM siswa_tugas 
      WHERE siswa_id = ?
    `, [siswaId]);

    return rows as SiswaTugas[];
  }
}

export async function getMateriProgressForSiswa(siswaId: number, materiId?: number): Promise<SiswaMateri | SiswaMateri[] | null> {
  if (materiId) {
    const rows = await query(`
      SELECT * FROM siswa_materi 
      WHERE siswa_id = ? AND materi_id = ?
    `, [siswaId, materiId]);

    return (rows as SiswaMateri[])[0] || null;
  } else {
    const rows = await query(`
      SELECT * FROM siswa_materi 
      WHERE siswa_id = ?
    `, [siswaId]);

    return rows as SiswaMateri[];
  }
}

export async function getTugasWithStatus(siswaId: number): Promise<any[]> {
  try {
    const semuaTugas = await getTugasForSiswa(siswaId);
    const result = [];

    for (const tugasItem of semuaTugas) {
      const submission = await getSubmissionForSiswa(siswaId, tugasItem.id) as SiswaTugas;
      const materiItem = await getMateriById(tugasItem.materi_id);
      const kelasMateri = await getKelasForMateri(tugasItem.materi_id);

      result.push({
        ...tugasItem,
        status: submission?.status || 'belum_dikerjakan',
        nilai: submission?.nilai,
        feedback: submission?.feedback,
        jawaban: submission?.jawaban,
        submitted_at: submission?.submitted_at,
        graded_at: submission?.graded_at,
        materi_judul: materiItem?.judul || "Tidak diketahui",
        kelas: kelasMateri.map(k => k.nama).join(", ")
      });
    }

    return result;
  } catch (error) {
    console.error('Error getting tugas with status:', error);
    throw error;
  }
}

export async function isSiswaInKelas(siswaId: number, kelasId: number): Promise<boolean> {
  const rows = await query(`
    SELECT COUNT(*) as count FROM siswa_kelas 
    WHERE siswa_id = ? AND kelas_id = ?
  `, [siswaId, kelasId]);

  return (rows as any[])[0].count > 0;
}

export async function isMateriInKelas(materiId: number, kelasId: number): Promise<boolean> {
  const rows = await query(`
    SELECT COUNT(*) as count FROM materi_kelas 
    WHERE materi_id = ? AND kelas_id = ?
  `, [materiId, kelasId]);

  return (rows as any[])[0].count > 0;
}

export async function getGuruForKelas(kelasId: number): Promise<User[]> {
  const rows = await query(`
    SELECT u.* FROM users u
    JOIN guru_kelas gk ON u.id = gk.guru_id
    WHERE gk.kelas_id = ?
  `, [kelasId]);

  return rows as User[];
}

export async function getKelasForGuru(guruId: number): Promise<Kelas[]> {
  const rows = await query(`
    SELECT k.* FROM kelas k
    JOIN guru_kelas gk ON k.id = gk.kelas_id
    WHERE gk.guru_id = ?
  `, [guruId]);

  return rows as Kelas[];
}

// Create / Update functions
export async function createUser(userData: Omit<User, 'id' | 'created_at'>): Promise<number> {
  const { nama, email, password_hash, role, status, created_by, last_login, login_count, last_activity, bidang } = userData;

  const result = await query(`
    INSERT INTO users (nama, email, password_hash, role, status, created_by, last_login, login_count, last_activity, bidang) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [nama, email, password_hash, role, status, created_by, last_login, login_count, last_activity, bidang]);

  return (result as any).insertId;
}

export async function updateUserLastLogin(userId: number): Promise<void> {
  const now = new Date();
  await query(`
    UPDATE users 
    SET last_login = ?, login_count = login_count + 1, last_activity = ?
    WHERE id = ?
  `, [now, now, userId]);
}

// create new class
export async function createKelas(nama: string, tingkat: string, waliKelasId: number): Promise<number> {
  const result = await query(`
    INSERT INTO kelas (nama, tingkat, wali_kelas_id) 
    VALUES (?, ?, ?)
  `, [nama, tingkat, waliKelasId]);

  return (result as any).insertId
}

// update class
export async function updateKelas(kelasId: number, data: { nama?: string; tingkat?: string; wali_kelas_id?: number }): Promise<void> {
  const { nama, tingkat, wali_kelas_id } = data;

  let updateFields = []
  let values = []

  if (nama !== undefined) {
    updateFields.push('nama = ?')
    values.push(nama)
  }

  if (tingkat !== undefined) {
    updateFields.push('tingkat = ?')
    values.push(tingkat)
  }

  if (wali_kelas_id !== undefined) {
    updateFields.push('wali_kelas_id = ?')
    values.push(wali_kelas_id)
  }

  values.push(kelasId)

  await query(`
    UPDATE kelas 
    SET ${updateFields.join(', ')} 
    WHERE id = ?
  `, values)
}

// delete class
export async function deleteKelas(kelasId: number): Promise<boolean> {
  const result = await query(`
    DELETE FROM kelas 
    WHERE id = ?
  `, [kelasId])

  return (result as any).affectedRows > 0
}

// add guru to class with subject
export async function addGuruToKelas(guruId: number, kelasId: number, mataPelajaran: string): Promise<number> {
  const result = await query(`
    INSERT INTO guru_kelas (guru_id, kelas_id, mata_pelajaran) 
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE mata_pelajaran = VALUES(mata_pelajaran)
  `, [guruId, kelasId, mataPelajaran]);

  return (result as any).insertId;
}

// remove guru from class
export async function removeGuruFromKelas(guruId: number, kelasId: number, mataPelajaran?: string): Promise<boolean> {
  let sql = 'DELETE FROM guru_kelas WHERE guru_id = ? AND kelas_id = ?';
  let params: any = [guruId, kelasId];

  if (mataPelajaran) {
    sql += ' AND mata_pelajaran = ?';
    params.push(mataPelajaran);
  }

  const result = await query(sql, params);
  return (result as any).affectedRows > 0;
}

// class detailed information
export async function getKelasDetail(kelasId: number): Promise<any> {
  try {
    const kelasInfo = await getKelasById(kelasId)
    if (!kelasInfo) return null

    const siswaList = await getSiswaForKelas(kelasId)
    const guruList = await query(`
      SELECT u.*, gk.mata_pelajaran, u.bidang
      FROM users u
      JOIN guru_kelas gk ON u.id = gk.guru_id
      WHERE gk.kelas_id = ? AND u.role = 'guru'
    `, [kelasId]) as any[]

    const materiList = await getMateriForKelas(kelasId)
    const tugasList = await getTugasForKelas(kelasId)

    // get class statistics
    const totalSiswa = siswaList.length
    const totalMateri = materiList.length
    const totalTugas = tugasList.length

    const tugasIds = tugasList.map(t => t.id)
    let avgNilai = 0

    if (tugasIds.length > 0) {
      const placeholders = tugasIds.map(() => '?').join(',')
      const nilaiResult = await query(`
        SELECT AVG(nilai) as avg_nilai
        FROM siswa_tugas 
        WHERE tugas_id IN (${placeholders}) AND nilai IS NOT NULL
      `, tugasIds) as any[]

      avgNilai = nilaiResult[0].avg_nilai || 0
    }

    return {
      kelas: kelasInfo,
      siswa: siswaList,
      guru: guruList,
      materi: materiList,
      tugas: tugasList,
      statistik: {
        total_siswa: totalSiswa,
        total_materi: totalMateri,
        total_tugas: totalTugas,
        avg_nilai: Math.round(avgNilai)
      }
    }
  } catch (error) {
    console.error('Error getting kelas detail:', error);
    throw error;
  }
}

// get student detailed progress
export async function getSiswaProgressInKelas(siswaId: number, kelasId: number): Promise<any> {
  try {
    const siswa = await getUserById(siswaId)
    if (!siswa || siswa.role !== 'siswa') return null

    const isInKelas = await isSiswaInKelas(siswaId, kelasId)
    if (!isInKelas) return null

    const materiKelas = await getMateriForKelas(kelasId)
    const tugasKelas = await getTugasForKelas(kelasId)

    // get material progress
    const materiProgress = await query(`
      SELECT * FROM siswa_materi 
      WHERE siswa_id = ? AND materi_id IN (${materiKelas.map(() => '?').join(',')})
    `, [siswaId, ...materiKelas.map(m => m.id)]) as any[]

    // get assignment submission
    const tugasSubmissions = await query(`
      SELECT * FROM siswa_tugas 
      WHERE siswa_id = ? AND tugas_id IN (${tugasKelas.map(() => '?').join(',')})
    `, [siswaId, ...tugasKelas.map(t => t.id)]) as any[]

    const materiSelesai = materiProgress.filter(mp => mp.is_completed).length
    const tugasDikerjakan = tugasSubmissions.filter(ts => ts.status !== 'belum_dikerjakan').length
    const tugasSelesai = tugasSubmissions.filter(ts => ts.status === 'selesai' && ts.nilai !== null).length

    const nilaiList = tugasSubmissions
      .filter(ts => ts.nilai !== null && ts.nilai !== undefined)
      .map(ts => ts.nilai)

    const rataNilai = nilaiList.length > 0
      ? Math.round(nilaiList.reduce((a, b) => a + b, 0) / nilaiList.length)
      : 0

    return {
      siswa: {
        id: siswa.id,
        nama: siswa.nama,
        email: siswa.email,
        last_login: siswa.last_login
      },
      progress: {
        materi_selesai: materiSelesai,
        total_materi: materiKelas.length,
        tugas_dikerjakan: tugasDikerjakan,
        tugas_selesai: tugasSelesai,
        total_tugas: tugasKelas.length,
        rata_nilai: rataNilai,
        progress_materi: materiKelas.length > 0 ? Math.round((materiSelesai / materiKelas.length) * 100) : 0,
        progress_tugas: tugasKelas.length > 0 ? Math.round((tugasDikerjakan / tugasKelas.length) * 100) : 0
      },
      detail_tugas: await Promise.all(tugasKelas.map(async (tugas) => {
        const submission = tugasSubmissions.find(ts => ts.tugas_id === tugas.id)
        const materiInfo = await getMateriById(tugas.materi_id)

        return {
          id: tugas.id,
          judul: tugas.judul,
          materi: materiInfo?.judul || 'Unknown',
          status: submission?.status || 'belum_dikerjakan',
          nilai: submission?.nilai || null,
          feedback: submission?.feedback || null,
          submitted_at: submission?.submitted_at || null,
          deadline: tugas.deadline
        }
      }))
    }
  } catch (error) {
    console.error('Error getting siswa progress in kelas:', error);
    throw error;
  }
}

export async function getGuruSiswaProgress(guruId: number): Promise<any[]> {
  try {
    // get all materials created by this guru
    const guruMateri = await query("SELECT * FROM materi WHERE guru_id = ?", [guruId]) as any[]
    if (guruMateri.length === 0) return []

    // get all classes that have these materials
    const materiIds = guruMateri.map(m => m.id)
    const materiKelasIds = await query(`
      SELECT DISTINCT kelas_id FROM materi_kelas 
      WHERE materi_id IN (${materiIds.map(() => '?').join(',')})
    `, materiIds) as any[]

    if (materiKelasIds.length === 0) return []

    // get all students in these classes
    const kelasIds = materiKelasIds.map(mk => mk.kelas_id)
    const siswaInKelas = await query(`
      SELECT DISTINCT u.* FROM users u
      JOIN siswa_kelas sk ON u.id = sk.siswa_id
      WHERE sk.kelas_id IN (${kelasIds.map(() => '?').join(',')}) 
        AND u.role = 'siswa' 
        AND u.status = 'active'
    `, kelasIds) as any[]

    // get guru's assignments
    const guruTugas = await query("SELECT * FROM tugas WHERE guru_id = ?", [guruId]) as any[];
    const tugasIds = guruTugas.map(t => t.id);

    const siswaProgress = await Promise.all(siswaInKelas.map(async (siswa) => {
      // get submissions for guru's assignments only
      const submissions = tugasIds.length > 0
        ? await query(`
        SELECT * FROM siswa_tugas 
        WHERE siswa_id = ? AND tugas_id IN (${tugasIds.map(() => '?').join(',')})
      `, [siswa.id, ...tugasIds]) as any[]
        : []

      const tugasDikerjakan = submissions.filter(s => s.status !== 'belum_dikerjakan').length
      const tugasSelesai = submissions.filter(s => s.status === 'selesai' && s.nilai !== null).length

      const nilaiList = submissions
        .filter(s => s.nilai !== null && s.nilai !== undefined)
        .map(s => s.nilai)

      const rataNilai = nilaiList.length > 0
        ? Math.round(nilaiList.reduce((a, b) => a + b, 0) / nilaiList.length)
        : 0

      const progress = guruTugas.length > 0
        ? Math.round((tugasDikerjakan / guruTugas.length) * 100)
        : 0

      // get classes where this students and guru intersect
      const siswaKelas = await getKelasForSiswa(siswa.id)
      const guruKelas = await getKelasForGuru(guruId)
      const commonKelas = siswaKelas.filter(sk => guruKelas.some(gk => gk.id === sk.id))

      return {
        id: siswa.id,
        nama: siswa.nama,
        email: siswa.email,
        kelas: commonKelas.map(k => k.nama).join(', '),
        progress: Math.min(progress, 100),
        rata_nilai: rataNilai,
        tugas_dikerjakan: tugasDikerjakan,
        tugas_selesai: tugasSelesai,
        total_tugas: guruTugas.length,
        last_activity: siswa.last_activity
      }
    }))

    return siswaProgress.filter(sp => sp.total_tugas > 0)
  } catch (error) {
    console.error('Error getting guru siswa progress:', error);
    throw error;
  }
}

// get learning activity summary for dashboard
export async function getLearningActivitySummary(): Promise<any> {
  try {
    const [
      recentMateri,
      recentTugas,
      recentSubmissions,
      recentGrades,
      activeStudents
    ] = await Promise.all([
      // Recent materials created
      query(`
        SELECT m.*, u.nama as guru_nama
        FROM materi m
        JOIN users u ON m.guru_id = u.id
        ORDER BY m.created_at DESC
        LIMIT 5
      `),

      // Recent assignments created
      query(`
        SELECT t.*, u.nama as guru_nama, m.judul as materi_judul
        FROM tugas t
        JOIN users u ON t.guru_id = u.id
        JOIN materi m ON t.materi_id = m.id
        ORDER BY t.created_at DESC
        LIMIT 5
      `),

      // Recent submissions
      query(`
        SELECT st.*, u.nama as siswa_nama, t.judul as tugas_judul
        FROM siswa_tugas st
        JOIN users u ON st.siswa_id = u.id
        JOIN tugas t ON st.tugas_id = t.id
        WHERE st.submitted_at IS NOT NULL
        ORDER BY st.submitted_at DESC
        LIMIT 5
      `),

      // Recent grades given
      query(`
        SELECT st.*, u.nama as siswa_nama, t.judul as tugas_judul, gu.nama as guru_nama
        FROM siswa_tugas st
        JOIN users u ON st.siswa_id = u.id
        JOIN tugas t ON st.tugas_id = t.id
        JOIN users gu ON t.guru_id = gu.id
        WHERE st.graded_at IS NOT NULL
        ORDER BY st.graded_at DESC
        LIMIT 5
      `),

      // Active students today
      query(`
        SELECT COUNT(*) as count
        FROM users 
        WHERE role = 'siswa' 
          AND status = 'active' 
          AND last_activity >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      `)
    ])

    return {
      recent_materials: (recentMateri as any[]).map(m => ({
        type: 'materi',
        title: `Materi "${m.judul}" dibuat`,
        description: `oleh ${m.guru_nama}`,
        created_at: m.created_at
      })),

      recent_assignments: (recentTugas as any[]).map(t => ({
        type: 'tugas',
        title: `Tugas "${t.judul}" dibuat`,
        description: `untuk materi ${t.materi_judul} oleh ${t.guru_nama}`,
        created_at: t.created_at
      })),

      recent_submissions: (recentSubmissions as any[]).map(s => ({
        type: 'submission',
        title: `${s.siswa_nama} mengumpulkan tugas`,
        description: `Tugas: ${s.tugas_judul}`,
        created_at: s.submitted_at
      })),

      recent_grades: (recentGrades as any[]).map(g => ({
        type: 'grade',
        title: `Nilai diberikan untuk ${g.siswa_nama}`,
        description: `Tugas: ${g.tugas_judul}, Nilai: ${g.nilai} oleh ${g.guru_nama}`,
        created_at: g.graded_at
      })),

      active_students_today: (activeStudents as any[])[0].count
    }
  } catch (error) {
    console.error('Error getting learning activity summary:', error);
    throw error;
  }
}

export async function createMateri(materiData: Omit<Materi, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const { judul, deskripsi, konten, guru_id } = materiData;

  const result = await query(`
    INSERT INTO materi (judul, deskripsi, konten, guru_id, updated_at) 
    VALUES (?, ?, ?, ?, NOW())
  `, [judul, deskripsi, konten, guru_id]);

  return (result as any).insertId;
}

export async function updateMateri(materiId: number, guruId: number, data: { judul?: string; deskripsi?: string; konten?: string }): Promise<void> {
  const { judul, deskripsi, konten } = data;

  let updateFields = [];
  let values = [];

  if (judul !== undefined) {
    updateFields.push('judul = ?');
    values.push(judul);
  }

  if (deskripsi !== undefined) {
    updateFields.push('deskripsi = ?');
    values.push(deskripsi);
  }

  if (konten !== undefined) {
    updateFields.push('konten = ?');
    values.push(konten);
  }

  updateFields.push('updated_at = NOW()');
  values.push(materiId, guruId);

  await query(`
    UPDATE materi 
    SET ${updateFields.join(', ')} 
    WHERE id = ? AND guru_id = ?
  `, values);
}

export async function createTugas(tugasData: Omit<Tugas, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const { judul, deskripsi, materi_id, guru_id, deadline } = tugasData;

  const result = await query(`
    INSERT INTO tugas (judul, deskripsi, materi_id, guru_id, deadline, updated_at) 
    VALUES (?, ?, ?, ?, ?, NOW())
  `, [judul, deskripsi, materi_id, guru_id, deadline]);

  return (result as any).insertId;
}

export async function updateTugas(tugasId: number, guruId: number, data: { judul?: string; deskripsi?: string; deadline?: Date }): Promise<void> {
  const { judul, deskripsi, deadline } = data;

  let updateFields = [];
  let values = [];

  if (judul !== undefined) {
    updateFields.push('judul = ?');
    values.push(judul);
  }

  if (deskripsi !== undefined) {
    updateFields.push('deskripsi = ?');
    values.push(deskripsi);
  }

  if (deadline !== undefined) {
    updateFields.push('deadline = ?');
    values.push(deadline);
  }

  updateFields.push('updated_at = NOW()');
  values.push(tugasId, guruId);

  await query(`
    UPDATE tugas 
    SET ${updateFields.join(', ')} 
    WHERE id = ? AND guru_id = ?
  `, values);
}

export async function submitTugas(siswaId: number, tugasId: number, jawaban: string): Promise<void> {
  const now = new Date();

  await query(`
    INSERT INTO siswa_tugas (siswa_id, tugas_id, jawaban, status, submitted_at) 
    VALUES (?, ?, ?, 'dikerjakan', ?)
    ON DUPLICATE KEY UPDATE 
    jawaban = VALUES(jawaban), 
    status = 'dikerjakan', 
    submitted_at = VALUES(submitted_at),
    nilai = NULL,
    feedback = NULL,
    graded_at = NULL
  `, [siswaId, tugasId, jawaban, now]);
}

export async function gradeTugas(siswaId: number, tugasId: number, nilai: number, feedback?: string): Promise<void> {
  const now = new Date();

  await query(`
    UPDATE siswa_tugas 
    SET nilai = ?, feedback = ?, status = 'selesai', graded_at = ?
    WHERE siswa_id = ? AND tugas_id = ?
  `, [nilai, feedback || "", now, siswaId, tugasId]);
}

export async function createSubmission(siswaId: number, tugasId: number, jawaban: string): Promise<number> {
  const now = new Date();

  const result = await query(`
    INSERT INTO siswa_tugas (siswa_id, tugas_id, jawaban, status, submitted_at) 
    VALUES (?, ?, ?, 'dikerjakan', ?)
  `, [siswaId, tugasId, jawaban, now]);

  return (result as any).insertId;
}

export async function updateSubmissionStatus(siswaId: number, tugasId: number, status: 'belum_dikerjakan' | 'dikerjakan' | 'selesai'): Promise<void> {
  await query(`
    UPDATE siswa_tugas 
    SET status = ?
    WHERE siswa_id = ? AND tugas_id = ?
  `, [status, siswaId, tugasId]);
}

export async function updateMateriProgress(siswaId: number, materiId: number, isCompleted: boolean = false): Promise<void> {
  const now = new Date();

  await query(`
    INSERT INTO siswa_materi (siswa_id, materi_id, last_accessed, is_completed) 
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
    last_accessed = VALUES(last_accessed),
    is_completed = VALUES(is_completed)
  `, [siswaId, materiId, now, isCompleted]);
}

export async function markMateriAsCompleted(siswaId: number, materiId: number): Promise<void> {
  const now = new Date();

  await query(`
    INSERT INTO siswa_materi (siswa_id, materi_id, last_accessed, is_completed) 
    VALUES (?, ?, ?, TRUE)
    ON DUPLICATE KEY UPDATE 
    last_accessed = VALUES(last_accessed),
    is_completed = TRUE
  `, [siswaId, materiId, now]);
}

export async function updateUserActivity(userId: number): Promise<void> {
  const now = new Date();
  await query(`
    UPDATE users 
    SET last_activity = ?
    WHERE id = ?
  `, [now, userId]);
}

// Function to create diskusi
export async function createDiskusi(kelas: string, isi: string, userId: number, userRole: Role): Promise<number> {
  const result = await query(`
    INSERT INTO diskusi (kelas, isi, user_id, user_role) 
    VALUES (?, ?, ?, ?)
  `, [kelas, isi, userId, userRole]);

  return (result as any).insertId;
}

// Function to create diskusi materi
export async function createDiskusiMateri(materiId: number, userId: number, userRole: Role, isi: string, parentId?: number): Promise<number> {
  const result = await query(`
    INSERT INTO diskusi_materi (materi_id, user_id, user_role, isi, parent_id) 
    VALUES (?, ?, ?, ?, ?)
  `, [materiId, userId, userRole, isi, parentId || null]);

  return (result as any).insertId;
}

// Function to delete materi
export async function deleteMateri(materiId: number, guruId: number): Promise<boolean> {
  const result = await query(`
    DELETE FROM materi 
    WHERE id = ? AND guru_id = ?
  `, [materiId, guruId]);

  return (result as any).affectedRows > 0;
}

// Function to delete tugas
export async function deleteTugas(tugasId: number, guruId: number): Promise<boolean> {
  const result = await query(`
    DELETE FROM tugas 
    WHERE id = ? AND guru_id = ?
  `, [tugasId, guruId]);

  return (result as any).affectedRows > 0;
}

// Function to get tugas by ID
export async function getTugasById(tugasId: number): Promise<Tugas | null> {
  const rows = await query('SELECT * FROM tugas WHERE id = ?', [tugasId]);
  return (rows as Tugas[])[0] || null;
}

// Function to add student to class
export async function addSiswaToKelas(siswaId: number, kelasId: number): Promise<number> {
  const result = await query(`
    INSERT INTO siswa_kelas (siswa_id, kelas_id) 
    VALUES (?, ?)
  `, [siswaId, kelasId]);

  return (result as any).insertId;
}

// Function to remove student from class
export async function removeSiswaFromKelas(siswaId: number, kelasId: number): Promise<boolean> {
  const result = await query(`
    DELETE FROM siswa_kelas 
    WHERE siswa_id = ? AND kelas_id = ?
  `, [siswaId, kelasId]);

  return (result as any).affectedRows > 0;
}

// Function to add materi to class
export async function addMateriToKelas(materiId: number, kelasId: number): Promise<number> {
  const result = await query(`
    INSERT INTO materi_kelas (materi_id, kelas_id) 
    VALUES (?, ?)
  `, [materiId, kelasId]);

  return (result as any).insertId;
}

// Function to remove materi from class
export async function removeMateriFromKelas(materiId: number, kelasId: number): Promise<boolean> {
  const result = await query(`
    DELETE FROM materi_kelas 
    WHERE materi_id = ? AND kelas_id = ?
  `, [materiId, kelasId]);

  return (result as any).affectedRows > 0;
}

// Function to get recent submissions for grading
export async function getPendingSubmissions(guruId: number): Promise<any[]> {
  const rows = await query(`
    SELECT 
      st.id, st.siswa_id, st.tugas_id, st.jawaban, st.submitted_at,
      t.judul as tugas_judul,
      u.nama as siswa_nama
    FROM siswa_tugas st
    JOIN tugas t ON st.tugas_id = t.id
    JOIN users u ON st.siswa_id = u.id
    WHERE t.guru_id = ? 
      AND st.status = 'dikerjakan' 
      AND st.nilai IS NULL
    ORDER BY st.submitted_at ASC
  `, [guruId]);

  return rows as any[];
}

// Function to get graded submissions
export async function getGradedSubmissions(guruId: number, limit: number = 10): Promise<any[]> {
  const rows = await query(`
    SELECT 
      st.id, st.siswa_id, st.tugas_id, st.nilai, st.feedback, st.graded_at,
      t.judul as tugas_judul,
      u.nama as siswa_nama
    FROM siswa_tugas st
    JOIN tugas t ON st.tugas_id = t.id
    JOIN users u ON st.siswa_id = u.id
    WHERE t.guru_id = ? 
      AND st.status = 'selesai' 
      AND st.nilai IS NOT NULL
    ORDER BY st.graded_at DESC
    LIMIT ?
  `, [guruId, limit]);

  return rows as any[];
}

// Function to check if submission exists
export async function checkSubmissionExists(siswaId: number, tugasId: number): Promise<boolean> {
  const rows = await query(`
    SELECT COUNT(*) as count 
    FROM siswa_tugas 
    WHERE siswa_id = ? AND tugas_id = ?
  `, [siswaId, tugasId]);

  return (rows as any[])[0].count > 0;
}

export async function getStudentStatistics(siswaId: number): Promise<any> {
  const [submissions, materials, classes] = await Promise.all([
    query(`
      SELECT 
        COUNT(*) as total_submissions,
        SUM(CASE WHEN status = 'dikerjakan' THEN 1 ELSE 0 END) as submitted_count,
        SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) as graded_count,
        AVG(CASE WHEN nilai IS NOT NULL THEN nilai ELSE NULL END) as avg_grade
      FROM siswa_tugas 
      WHERE siswa_id = ?
    `, [siswaId]),

    query(`
      SELECT 
        COUNT(*) as total_materials,
        SUM(CASE WHEN is_completed = TRUE THEN 1 ELSE 0 END) as completed_materials
      FROM siswa_materi 
      WHERE siswa_id = ?
    `, [siswaId]),

    query(`
      SELECT COUNT(*) as total_classes
      FROM siswa_kelas 
      WHERE siswa_id = ?
    `, [siswaId])
  ]);

  const submissionStats = (submissions as any[])[0];
  const materialStats = (materials as any[])[0];
  const classStats = (classes as any[])[0];

  return {
    total_submissions: submissionStats.total_submissions || 0,
    submitted_count: submissionStats.submitted_count || 0,
    graded_count: submissionStats.graded_count || 0,
    avg_grade: Math.round(submissionStats.avg_grade || 0),
    total_materials: materialStats.total_materials || 0,
    completed_materials: materialStats.completed_materials || 0,
    total_classes: classStats.total_classes || 0
  };
}

// Function to get guru statistics  
export async function getGuruStatistics(guruId: number): Promise<any> {
  const [materials, assignments, submissions] = await Promise.all([
    query(`
      SELECT COUNT(*) as total_materials
      FROM materi 
      WHERE guru_id = ?
    `, [guruId]),

    query(`
      SELECT COUNT(*) as total_assignments
      FROM tugas 
      WHERE guru_id = ?
    `, [guruId]),

    query(`
      SELECT 
        COUNT(*) as total_submissions,
        SUM(CASE WHEN st.status = 'dikerjakan' AND st.nilai IS NULL THEN 1 ELSE 0 END) as pending_grading,
        AVG(CASE WHEN st.nilai IS NOT NULL THEN st.nilai ELSE NULL END) as avg_grade
      FROM siswa_tugas st
      JOIN tugas t ON st.tugas_id = t.id
      WHERE t.guru_id = ?
    `, [guruId])
  ]);

  const materialStats = (materials as any[])[0];
  const assignmentStats = (assignments as any[])[0];
  const submissionStats = (submissions as any[])[0];

  return {
    total_materials: materialStats.total_materials || 0,
    total_assignments: assignmentStats.total_assignments || 0,
    total_submissions: submissionStats.total_submissions || 0,
    pending_grading: submissionStats.pending_grading || 0,
    avg_grade: Math.round(submissionStats.avg_grade || 0)
  };
}

export async function getStatistics() {
  try {
    const [
      totalUsers,
      totalSiswa,
      totalGuru,
      totalKelas,
      totalMateri,
      totalTugas,
      activeSiswa,
      activeGuru
    ] = await Promise.all([
      query("SELECT COUNT(*) as count FROM users"),
      query("SELECT COUNT(*) as count FROM users WHERE role = 'siswa'"),
      query("SELECT COUNT(*) as count FROM users WHERE role = 'guru'"),
      query("SELECT COUNT(*) as count FROM kelas"),
      query("SELECT COUNT(*) as count FROM materi"),
      query("SELECT COUNT(*) as count FROM tugas"),
      query("SELECT COUNT(*) as count FROM users WHERE role = 'siswa' AND status = 'active'"),
      query("SELECT COUNT(*) as count FROM users WHERE role = 'guru' AND status = 'active'")
    ]);

    return {
      totalUsers: (totalUsers as any[])[0].count,
      totalSiswa: (totalSiswa as any[])[0].count,
      totalGuru: (totalGuru as any[])[0].count,
      totalKelas: (totalKelas as any[])[0].count,
      totalMateri: (totalMateri as any[])[0].count,
      totalTugas: (totalTugas as any[])[0].count,
      activeSiswa: (activeSiswa as any[])[0].count,
      activeGuru: (activeGuru as any[])[0].count
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    throw error;
  }
}

export const loginAttempts = new Map<string, { count: number; unlockTime: number }>();


export async function initializeTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('kepsek', 'guru', 'siswa') NOT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME NULL,
        login_count INT DEFAULT 0,
        last_activity DATETIME NULL,
        bidang VARCHAR(100) NULL,
        INDEX idx_email (email),
        INDEX idx_role (role),
        INDEX idx_status (status)
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS kelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(100) NOT NULL,
        tingkat VARCHAR(10) NOT NULL,
        wali_kelas_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tingkat (tingkat),
        FOREIGN KEY (wali_kelas_id) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS materi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        judul VARCHAR(255) NOT NULL,
        deskripsi TEXT,
        konten LONGTEXT NOT NULL,
        guru_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL,
        INDEX idx_guru_id (guru_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (guru_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS diskusi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kelas VARCHAR(100) NOT NULL,
        isi TEXT NOT NULL,
        user_id INT NOT NULL,
        user_role ENUM('kepsek', 'guru', 'siswa') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_kelas (kelas),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS tugas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        judul VARCHAR(255) NOT NULL,
        deskripsi TEXT,
        materi_id INT NOT NULL,
        guru_id INT NOT NULL,
        deadline DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL,
        INDEX idx_materi_id (materi_id),
        INDEX idx_guru_id (guru_id),
        INDEX idx_deadline (deadline),
        FOREIGN KEY (materi_id) REFERENCES materi(id) ON DELETE CASCADE,
        FOREIGN KEY (guru_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS diskusi_materi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        materi_id INT NOT NULL,
        user_id INT NOT NULL,
        user_role ENUM('kepsek', 'guru', 'siswa') NOT NULL,
        isi TEXT NOT NULL,
        parent_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_materi_id (materi_id),
        INDEX idx_user_id (user_id),
        INDEX idx_parent_id (parent_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (materi_id) REFERENCES materi(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES diskusi_materi(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS siswa_tugas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        siswa_id INT NOT NULL,
        tugas_id INT NOT NULL,
        jawaban LONGTEXT,
        nilai INT CHECK (nilai >= 0 AND nilai <= 100),
        feedback TEXT,
        status ENUM('belum_dikerjakan', 'dikerjakan', 'selesai') DEFAULT 'belum_dikerjakan',
        submitted_at DATETIME NULL,
        graded_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_siswa_id (siswa_id),
        INDEX idx_tugas_id (tugas_id),
        INDEX idx_status (status),
        FOREIGN KEY (siswa_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tugas_id) REFERENCES tugas(id) ON DELETE CASCADE,
        UNIQUE KEY unique_siswa_tugas (siswa_id, tugas_id)
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS siswa_materi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        siswa_id INT NOT NULL,
        materi_id INT NOT NULL,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_completed BOOLEAN DEFAULT FALSE,
        INDEX idx_siswa_id (siswa_id),
        INDEX idx_materi_id (materi_id),
        INDEX idx_last_accessed (last_accessed),
        FOREIGN KEY (siswa_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (materi_id) REFERENCES materi(id) ON DELETE CASCADE,
        UNIQUE KEY unique_siswa_materi (siswa_id, materi_id)
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS guru_kelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guru_id INT NOT NULL,
        kelas_id INT NOT NULL,
        mata_pelajaran VARCHAR(100) NOT NULL,
        INDEX idx_guru_id (guru_id),
        INDEX idx_kelas_id (kelas_id),
        FOREIGN KEY (guru_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE,
        UNIQUE KEY unique_guru_kelas_mapel (guru_id, kelas_id, mata_pelajaran)
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS materi_kelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        materi_id INT NOT NULL,
        kelas_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_materi_id (materi_id),
        INDEX idx_kelas_id (kelas_id),
        FOREIGN KEY (materi_id) REFERENCES materi(id) ON DELETE CASCADE,
        FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE,
        UNIQUE KEY unique_materi_kelas (materi_id, kelas_id)
      ) ENGINE=InnoDB
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS siswa_kelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        siswa_id INT NOT NULL,
        kelas_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_siswa_id (siswa_id),
        INDEX idx_kelas_id (kelas_id),
        FOREIGN KEY (siswa_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE,
        UNIQUE KEY unique_siswa_kelas (siswa_id, kelas_id)
      ) ENGINE=InnoDB
    `);

    console.log("Database tables initialized successfully!");
  } catch (error) {
    console.error("Error initializing database tables:", error);
    throw error;
  }
}

// Enhanced seed function with proper constraints
export async function seed() {
  try {
    const users = await getUsers();

    if (users.length === 0) {
      const now = new Date();

      // Create Kepsek
      await query(
        `INSERT INTO users (nama, email, password_hash, role, status, created_at, last_login, login_count, last_activity) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Dr. Prabowo, M.Pd",
          "kepsek@example.com",
          await hashPassword("123456"),
          "kepsek",
          "active",
          now,
          now,
          15,
          now
        ]
      );

      // Create Gurus
      const guruData = [
        { nama: "Jokowi, S.Pd", email: "guru@example.com", bidang: "Matematika" },
        { nama: "Megawati, S.Pd", email: "guru2@example.com", bidang: "Bahasa Indonesia" },
        { nama: "SBY, S.Pd", email: "guru3@example.com", bidang: "IPA" },
        { nama: "Gus Dur, S.Pd", email: "guru4@example.com", bidang: "IPS" },
        { nama: "Wiranto, S.Pd", email: "guru5@example.com", bidang: "Olahraga" }
      ];

      for (const [index, guru] of guruData.entries()) {
        await query(
          `INSERT INTO users (nama, email, password_hash, role, status, created_by, created_at, last_login, login_count, last_activity, bidang) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            guru.nama,
            guru.email,
            await hashPassword("123456"),
            "guru",
            index === 4 ? "inactive" : "active", // Last guru inactive
            1, // Created by kepsek
            now,
            new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
            Math.floor(Math.random() * 20) + 1,
            new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
            guru.bidang
          ]
        );
      }

      // Create Students (15 students)
      for (let i = 1; i <= 15; i++) {
        const status = i === 15 ? "inactive" : "active"; // Last student inactive
        const lastLogin = new Date(Date.now() - (i % 7) * 24 * 60 * 60 * 1000); // More realistic login patterns

        await query(
          `INSERT INTO users (nama, email, password_hash, role, status, created_at, last_login, login_count, last_activity) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `Siswa ${i.toString().padStart(2, '0')}`,
            `siswa${i}@example.com`,
            await hashPassword("123456"),
            "siswa",
            status,
            now,
            lastLogin,
            Math.floor(Math.random() * 50) + 5, // 5-55 logins
            lastLogin
          ]
        );
      }

      // Create Classes with proper wali kelas
      const kelasData = [
        { nama: "Kelas 1A", tingkat: "1", wali_kelas_id: 2 }, // Jokowi
        { nama: "Kelas 2B", tingkat: "2", wali_kelas_id: 3 }, // Megawati  
        { nama: "Kelas 3C", tingkat: "3", wali_kelas_id: 4 }  // SBY
      ];

      for (const kelas of kelasData) {
        await query(
          `INSERT INTO kelas (nama, tingkat, wali_kelas_id, created_at) 
           VALUES (?, ?, ?, ?)`,
          [kelas.nama, kelas.tingkat, kelas.wali_kelas_id, now]
        );
      }

      // Create Teacher-Class assignments (guru mengajar di kelas)
      const guruKelasData = [
        // Kelas 1A
        { guru_id: 2, kelas_id: 1, mata_pelajaran: "Matematika" },
        { guru_id: 3, kelas_id: 1, mata_pelajaran: "Bahasa Indonesia" },
        { guru_id: 4, kelas_id: 1, mata_pelajaran: "IPA" },

        // Kelas 2B
        { guru_id: 2, kelas_id: 2, mata_pelajaran: "Matematika" },
        { guru_id: 3, kelas_id: 2, mata_pelajaran: "Bahasa Indonesia" },
        { guru_id: 5, kelas_id: 2, mata_pelajaran: "IPS" },

        // Kelas 3C
        { guru_id: 4, kelas_id: 3, mata_pelajaran: "IPA" },
        { guru_id: 5, kelas_id: 3, mata_pelajaran: "IPS" },
        { guru_id: 6, kelas_id: 3, mata_pelajaran: "Olahraga" }
      ];

      for (const gk of guruKelasData) {
        await query(
          `INSERT INTO guru_kelas (guru_id, kelas_id, mata_pelajaran) 
           VALUES (?, ?, ?)`,
          [gk.guru_id, gk.kelas_id, gk.mata_pelajaran]
        );
      }

      // Assign Students to Classes (ONE CLASS PER STUDENT)
      const siswaKelasAssignment = [
        // Kelas 1A: siswa 7-11 (5 students)
        { siswa_start: 7, siswa_end: 11, kelas_id: 1 },
        // Kelas 2B: siswa 12-16 (5 students) 
        { siswa_start: 12, siswa_end: 16, kelas_id: 2 },
        // Kelas 3C: siswa 17-21 (5 students)
        { siswa_start: 17, siswa_end: 21, kelas_id: 3 }
      ];

      for (const assignment of siswaKelasAssignment) {
        for (let siswaId = assignment.siswa_start; siswaId <= assignment.siswa_end; siswaId++) {
          // Check if student exists before assignment
          const siswaExists = await query("SELECT id FROM users WHERE id = ? AND role = 'siswa'", [siswaId]);
          if ((siswaExists as any[]).length > 0) {
            await query(
              `INSERT INTO siswa_kelas (siswa_id, kelas_id, created_at) 
               VALUES (?, ?, ?)`,
              [siswaId, assignment.kelas_id, now]
            );
          }
        }
      }

      // Create Learning Materials (proper distribution)
      const materiData = [
        // Matematika materials
        { judul: "Pengenalan Bilangan", deskripsi: "Materi dasar tentang bilangan dan operasi", guru_id: 2, bidang: "Matematika" },
        { judul: "Aljabar Dasar", deskripsi: "Konsep dasar aljabar untuk pemula", guru_id: 2, bidang: "Matematika" },
        { judul: "Geometri Sederhana", deskripsi: "Bentuk-bentuk geometri dasar", guru_id: 2, bidang: "Matematika" },

        // Bahasa Indonesia materials
        { judul: "Membaca Pemahaman", deskripsi: "Teknik membaca dan memahami teks", guru_id: 3, bidang: "Bahasa Indonesia" },
        { judul: "Menulis Kreatif", deskripsi: "Pembelajaran menulis yang kreatif", guru_id: 3, bidang: "Bahasa Indonesia" },

        // IPA materials
        { judul: "Sains Dasar", deskripsi: "Pengenalan konsep sains dasar", guru_id: 4, bidang: "IPA" },
        { judul: "Eksperimen Sederhana", deskripsi: "Praktik eksperimen sains sederhana", guru_id: 4, bidang: "IPA" },

        // IPS materials
        { judul: "Sejarah Indonesia", deskripsi: "Pembelajaran sejarah Indonesia", guru_id: 5, bidang: "IPS" },
        { judul: "Geografi Dasar", deskripsi: "Pengenalan geografi Indonesia", guru_id: 5, bidang: "IPS" }
      ];

      for (const [index, materi] of materiData.entries()) {
        const konten = `Konten pembelajaran ${materi.judul}. 

Materi ini membahas tentang ${materi.deskripsi.toLowerCase()}. 

Tujuan Pembelajaran:
1. Memahami konsep dasar ${materi.bidang.toLowerCase()}
2. Mampu mengaplikasikan pengetahuan dalam kehidupan sehari-hari
3. Mengembangkan kemampuan berpikir kritis

Isi Materi:
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Kesimpulan:
Materi ini penting untuk dipelajari sebagai dasar pemahaman ${materi.bidang.toLowerCase()}.`;

        await query(
          `INSERT INTO materi (judul, deskripsi, konten, guru_id, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            materi.judul,
            materi.deskripsi,
            konten,
            materi.guru_id,
            new Date(Date.now() - (index * 24 * 60 * 60 * 1000)), // Spread over days
            new Date(Date.now() - (index * 12 * 60 * 60 * 1000))
          ]
        );
      }

      // Assign Materials to Classes (logical assignment)
      const materiKelasAssignment = [
        // Kelas 1A (basic level)
        { materi_ids: [1, 4, 6], kelas_id: 1 }, // Math basic, Reading, Basic Science
        // Kelas 2B (intermediate level) 
        { materi_ids: [2, 5, 8], kelas_id: 2 }, // Algebra, Creative Writing, History
        // Kelas 3C (advanced level)
        { materi_ids: [3, 7, 9], kelas_id: 3 }  // Geometry, Experiments, Geography
      ];

      for (const assignment of materiKelasAssignment) {
        for (const materiId of assignment.materi_ids) {
          await query(
            `INSERT INTO materi_kelas (materi_id, kelas_id, created_at) 
             VALUES (?, ?, ?)`,
            [materiId, assignment.kelas_id, now]
          );
        }
      }

      // Create Assignments (realistic distribution)
      const tugasData = [
        { judul: "Latihan Bilangan 1", deskripsi: "Kerjakan soal-soal tentang bilangan dasar", materi_id: 1, guru_id: 2, days_from_now: 7 },
        { judul: "Quiz Aljabar", deskripsi: "Kuis singkat tentang konsep aljabar", materi_id: 2, guru_id: 2, days_from_now: 10 },
        { judul: "Tugas Membaca", deskripsi: "Baca artikel dan buat ringkasan", materi_id: 4, guru_id: 3, days_from_now: 5 },
        { judul: "Eksperimen Air", deskripsi: "Lakukan eksperimen tentang sifat air", materi_id: 7, guru_id: 4, days_from_now: 14 },
        { judul: "Esai Sejarah", deskripsi: "Tulis esai tentang kemerdekaan Indonesia", materi_id: 8, guru_id: 5, days_from_now: 12 }
      ];

      for (const tugas of tugasData) {
        await query(
          `INSERT INTO tugas (judul, deskripsi, materi_id, guru_id, deadline, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            tugas.judul,
            tugas.deskripsi,
            tugas.materi_id,
            tugas.guru_id,
            new Date(Date.now() + tugas.days_from_now * 24 * 60 * 60 * 1000)
          ]
        );
      }

      // Create Student Submissions (realistic scenarios)
      // Only for students who have access to the materials through their classes
      const submissionScenarios = [
        // Tugas 1 (Materi 1 - Kelas 1A) - siswa 7-11
        { tugas_id: 1, siswa_range: [7, 11], completion_rate: 0.8 },
        // Tugas 2 (Materi 2 - Kelas 2B) - siswa 12-16  
        { tugas_id: 2, siswa_range: [12, 16], completion_rate: 0.6 },
        // Tugas 3 (Materi 4 - Kelas 1A) - siswa 7-11
        { tugas_id: 3, siswa_range: [7, 11], completion_rate: 0.9 },
        // Tugas 4 (Materi 7 - Kelas 3C) - siswa 17-21
        { tugas_id: 4, siswa_range: [17, 21], completion_rate: 0.7 },
        // Tugas 5 (Materi 8 - Kelas 2B) - siswa 12-16
        { tugas_id: 5, siswa_range: [12, 16], completion_rate: 0.5 }
      ];

      for (const scenario of submissionScenarios) {
        const [siswaStart, siswaEnd] = scenario.siswa_range;

        for (let siswaId = siswaStart; siswaId <= siswaEnd; siswaId++) {
          // Check if student exists
          const siswaExists = await query("SELECT id FROM users WHERE id = ? AND role = 'siswa'", [siswaId]);
          if ((siswaExists as any[]).length === 0) continue;

          const shouldComplete = Math.random() < scenario.completion_rate;

          if (shouldComplete) {
            const statuses: Array<'dikerjakan' | 'selesai'> = ['dikerjakan', 'selesai'];
            const status = statuses[Math.floor(Math.random() * 2)];
            const nilai: any = status === 'selesai' ? Math.floor(Math.random() * 40) + 60 : null; // 60-100
            const jawaban = `Jawaban tugas ${scenario.tugas_id} dari siswa ${siswaId}. Saya telah mengerjakan tugas ini dengan baik.`;
            const feedback = status === 'selesai' ? (nilai >= 80 ? 'Kerja bagus!' : 'Perlu ditingkatkan lagi') : null;
            const submitted_at = new Date(Date.now() - Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000);
            const graded_at = status === 'selesai' ? new Date(submitted_at.getTime() + Math.floor(Math.random() * 2) * 24 * 60 * 60 * 1000) : null;

            await query(
              `INSERT INTO siswa_tugas (siswa_id, tugas_id, status, nilai, jawaban, feedback, submitted_at, graded_at, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
              [siswaId, scenario.tugas_id, status, nilai, jawaban, feedback, submitted_at, graded_at]
            );
          }
        }
      }

      // Create Student Material Progress (realistic access patterns)
      const materiProgressScenarios = [
        { materi_id: 1, siswa_range: [7, 11], access_rate: 0.9, completion_rate: 0.7 },
        { materi_id: 2, siswa_range: [12, 16], access_rate: 0.8, completion_rate: 0.6 },
        { materi_id: 3, siswa_range: [17, 21], access_rate: 0.85, completion_rate: 0.8 },
        { materi_id: 4, siswa_range: [7, 11], access_rate: 0.95, completion_rate: 0.85 },
        { materi_id: 5, siswa_range: [12, 16], access_rate: 0.75, completion_rate: 0.5 },
        { materi_id: 6, siswa_range: [7, 11], access_rate: 0.8, completion_rate: 0.6 },
        { materi_id: 7, siswa_range: [17, 21], access_rate: 0.9, completion_rate: 0.75 },
        { materi_id: 8, siswa_range: [12, 16], access_rate: 0.7, completion_rate: 0.4 },
        { materi_id: 9, siswa_range: [17, 21], access_rate: 0.8, completion_rate: 0.65 }
      ];

      for (const scenario of materiProgressScenarios) {
        const [siswaStart, siswaEnd] = scenario.siswa_range;

        for (let siswaId = siswaStart; siswaId <= siswaEnd; siswaId++) {
          // Check if student exists
          const siswaExists = await query("SELECT id FROM users WHERE id = ? AND role = 'siswa'", [siswaId]);
          if ((siswaExists as any[]).length === 0) continue;

          const shouldAccess = Math.random() < scenario.access_rate;

          if (shouldAccess) {
            const isCompleted = Math.random() < scenario.completion_rate;
            const lastAccessed = new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);

            await query(
              `INSERT INTO siswa_materi (siswa_id, materi_id, last_accessed, is_completed) 
               VALUES (?, ?, ?, ?)`,
              [siswaId, scenario.materi_id, lastAccessed, isCompleted]
            );
          }
        }
      }

      // Create Class Discussions (realistic conversations)
      const diskusiKelasData = [
        { kelas: "Kelas 1A", isi: "Selamat datang di kelas 1A! Mari kita belajar dengan semangat.", user_id: 2, user_role: "guru" },
        { kelas: "Kelas 1A", isi: "Terima kasih pak guru. Kami siap belajar!", user_id: 7, user_role: "siswa" },
        { kelas: "Kelas 2B", isi: "Untuk tugas minggu ini, jangan lupa baca materi terlebih dahulu.", user_id: 3, user_role: "guru" },
        { kelas: "Kelas 2B", isi: "Pak, boleh minta waktu tambahan untuk tugas?", user_id: 12, user_role: "siswa" },
        { kelas: "Kelas 3C", isi: "Eksperimen hari ini sangat menarik!", user_id: 17, user_role: "siswa" }
      ];

      for (const [index, diskusi] of diskusiKelasData.entries()) {
        await query(
          `INSERT INTO diskusi (kelas, isi, user_id, user_role, created_at) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            diskusi.kelas,
            diskusi.isi,
            diskusi.user_id,
            diskusi.user_role,
            new Date(Date.now() - (index * 2 * 60 * 60 * 1000))
          ]
        );
      }

      // Create Material Discussions (contextual to materials)
      const diskusiMateriData = [
        { materi_id: 1, user_id: 8, user_role: "siswa", isi: "Bagaimana cara mudah menghafal tabel perkalian?", parent_id: null },
        { materi_id: 1, user_id: 2, user_role: "guru", isi: "Coba gunakan lagu atau pola untuk mengingatnya.", parent_id: 1 },
        { materi_id: 4, user_id: 9, user_role: "siswa", isi: "Artikel yang dibaca cukup panjang, boleh minta tips?", parent_id: null },
        { materi_id: 6, user_id: 10, user_role: "siswa", isi: "Eksperimen ini aman dilakukan di rumah tidak?", parent_id: null },
        { materi_id: 6, user_id: 4, user_role: "guru", isi: "Ya aman, tapi tetap harus didampingi orang tua.", parent_id: 4 }
      ];

      for (const [index, diskusi] of diskusiMateriData.entries()) {
        await query(
          `INSERT INTO diskusi_materi (materi_id, user_id, user_role, isi, parent_id, created_at) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            diskusi.materi_id,
            diskusi.user_id,
            diskusi.user_role,
            diskusi.isi,
            diskusi.parent_id,
            new Date(Date.now() - (index * 3 * 60 * 60 * 1000))
          ]
        );
      }

      console.log("Database seeded successfully with realistic data!");
      console.log("- Each student assigned to only ONE class");
      console.log("- Materials properly distributed to relevant classes");
      console.log("- Submissions only for students with access to materials");
      console.log("- Realistic completion and grading rates");
    } else {
      console.log("Database already has data, skipping seed.");
    }
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log("Database connection closed.");
  }
}

async function initializeApp() {
  try {
    initializeDatabase();
    await initializeTables();
    await seed();
  } catch (error) {
    console.error('Error initializing app:', error);
    throw error;
  }
}

initializeApp().catch(console.error)