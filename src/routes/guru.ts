import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import {
  addMateriToKelas, getKelasForGuru, updateMateri, getKelasForMateri,
  getSiswaForKelas, deleteMateri, getMateriById, getPendingSubmissions,
  query, createMateri, createTugas, submitTugas, gradeTugas, getGuruSiswaProgress
} from "../db";

export const guruRoutes = new Elysia({ prefix: "/guru" })
  .derive(authMiddleware as any)

  .onBeforeHandle(({ user, set }) => {
    if (!user || !user.id) {
      set.status = 401;
      return { success: false, error: "Silakan login terlebih dahulu" };
    }

    if (user.role !== "guru") {
      set.status = 403;
      return { success: false, error: "Akses ditolak. Hanya guru yang dapat mengakses endpoint ini." };
    }
  })

  .get("/dashboard/stats", async ({ user }) => {
    try {
      const guruId = user.id;

      const [materiCount, tugasCount, pendingCount, avgGradeResult, studentCount, guruProfile] = await Promise.all([
        query("SELECT COUNT(*) as count FROM materi WHERE guru_id = ?", [guruId]),
        query("SELECT COUNT(*) as count FROM tugas WHERE guru_id = ?", [guruId]),
        query(`
          SELECT COUNT(*) as count FROM siswa_tugas st 
          JOIN tugas t ON st.tugas_id = t.id 
          WHERE t.guru_id = ? AND st.status = 'dikerjakan' AND st.nilai IS NULL
        `, [guruId]),
        query(`
          SELECT AVG(st.nilai) as rata FROM siswa_tugas st 
          JOIN tugas t ON st.tugas_id = t.id 
          WHERE t.guru_id = ? AND st.nilai IS NOT NULL
        `, [guruId]),
        // Count students who have access to guru's materials (more accurate)
        query(`
          SELECT COUNT(DISTINCT u.id) as count FROM users u
          JOIN siswa_kelas sk ON u.id = sk.siswa_id
          JOIN materi_kelas mk ON sk.kelas_id = mk.kelas_id
          JOIN materi m ON mk.materi_id = m.id
          WHERE m.guru_id = ? AND u.role = 'siswa' AND u.status = 'active'
        `, [guruId]),
        // Get guru profile with class info
        query(`
          SELECT u.*, 
                 GROUP_CONCAT(CONCAT(k.nama, ' (', gk.mata_pelajaran, ')') SEPARATOR ', ') as kelas_mengajar,
                 COUNT(DISTINCT gk.kelas_id) as total_kelas,
                 GROUP_CONCAT(DISTINCT k.id) as kelas_ids,
                 MAX(CASE WHEN k.wali_kelas_id = u.id THEN k.nama END) as wali_kelas
          FROM users u
          LEFT JOIN guru_kelas gk ON u.id = gk.guru_id
          LEFT JOIN kelas k ON gk.kelas_id = k.id
          WHERE u.id = ? AND u.role = 'guru'
          GROUP BY u.id
        `, [guruId])
      ]);

      const profile = (guruProfile as any[])[0];

      return {
        success: true,
        data: {
          total_materi: (materiCount as any[])[0].count || 0,
          total_tugas: (tugasCount as any[])[0].count || 0,
          tugas_pending: (pendingCount as any[])[0].count || 0,
          rata_nilai: Math.round((avgGradeResult as any[])[0].rata || 0),
          total_siswa: (studentCount as any[])[0].count || 0,
          total_kelas: profile?.total_kelas || 0,
          guru_info: {
            nama: profile?.nama || "",
            bidang: profile?.bidang || "",
            kelas_mengajar: profile?.kelas_mengajar || "Belum mengajar",
            is_wali_kelas: !!profile?.wali_kelas,
            wali_kelas_nama: profile?.wali_kelas || null,
            email: profile?.email || "",
            last_login: profile?.last_login,
            login_count: profile?.login_count || 0
          }
        }
      };
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat statistik" };
    }
  })

  // Get guru's class information
  .get("/kelas/info", async ({ user }) => {
    try {
      const guruId = user.id;

      const kelasInfo = await query(`
        SELECT k.*, gk.mata_pelajaran, 
               COUNT(DISTINCT sk.siswa_id) as jumlah_siswa,
               COUNT(DISTINCT m.id) as jumlah_materi,
               COUNT(DISTINCT t.id) as jumlah_tugas,
               (k.wali_kelas_id = ?) as is_wali_kelas
        FROM kelas k
        JOIN guru_kelas gk ON k.id = gk.kelas_id
        LEFT JOIN siswa_kelas sk ON k.id = sk.kelas_id
        LEFT JOIN materi_kelas mk ON k.id = mk.kelas_id
        LEFT JOIN materi m ON mk.materi_id = m.id AND m.guru_id = ?
        LEFT JOIN tugas t ON m.id = t.materi_id AND t.guru_id = ?
        WHERE gk.guru_id = ?
        GROUP BY k.id, gk.mata_pelajaran
        ORDER BY k.nama
      `, [guruId, guruId, guruId, guruId]) as any[];

      return {
        success: true,
        data: kelasInfo
      };
    } catch (error) {
      console.error("Error getting kelas info:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat info kelas" };
    }
  })

  // Get class-specific statistics for wali kelas
  .get("/wali-kelas/stats", async ({ user }) => {
    try {
      const guruId = user.id;

      // Check if user is wali kelas
      const waliKelasInfo = await query(`
        SELECT k.*, COUNT(DISTINCT sk.siswa_id) as total_siswa
        FROM kelas k
        LEFT JOIN siswa_kelas sk ON k.id = sk.kelas_id
        WHERE k.wali_kelas_id = ?
        GROUP BY k.id
      `, [guruId]) as any[];

      if (waliKelasInfo.length === 0) {
        return {
          success: true,
          data: { is_wali_kelas: false }
        };
      }

      const kelas = waliKelasInfo[0];

      // Get detailed class statistics
      const [attendanceStats, gradeStats, activityStats] = await Promise.all([
        // Student activity stats
        query(`
          SELECT 
            COUNT(DISTINCT u.id) as total_siswa,
            COUNT(DISTINCT CASE WHEN u.last_activity >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN u.id END) as active_week,
            COUNT(DISTINCT CASE WHEN u.last_activity >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN u.id END) as active_today
          FROM users u
          JOIN siswa_kelas sk ON u.id = sk.siswa_id
          WHERE sk.kelas_id = ? AND u.role = 'siswa' AND u.status = 'active'
        `, [kelas.id]),

        // Grade statistics across all subjects
        query(`
          SELECT 
            AVG(st.nilai) as rata_nilai_kelas,
            COUNT(DISTINCT st.tugas_id) as total_tugas_dinilai,
            COUNT(DISTINCT CASE WHEN st.nilai >= 80 THEN st.siswa_id END) as siswa_nilai_baik
          FROM siswa_tugas st
          JOIN users u ON st.siswa_id = u.id
          JOIN siswa_kelas sk ON u.id = sk.siswa_id
          WHERE sk.kelas_id = ? AND st.nilai IS NOT NULL
        `, [kelas.id]),

        // Recent activity in class
        query(`
          SELECT 
            COUNT(DISTINCT CASE WHEN st.submitted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN st.id END) as submissions_week,
            COUNT(DISTINCT CASE WHEN sm.last_accessed >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN sm.id END) as materials_accessed_week
          FROM siswa_kelas sk
          LEFT JOIN siswa_tugas st ON sk.siswa_id = st.siswa_id
          LEFT JOIN siswa_materi sm ON sk.siswa_id = sm.siswa_id
          WHERE sk.kelas_id = ?
        `, [kelas.id])
      ]);

      return {
        success: true,
        data: {
          is_wali_kelas: true,
          kelas_info: kelas,
          attendance: (attendanceStats as any[])[0],
          grades: (gradeStats as any[])[0],
          activity: (activityStats as any[])[0]
        }
      };
    } catch (error) {
      console.error("Error getting wali kelas stats:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat statistik wali kelas" };
    }
  })

  // Get upcoming deadlines for guru's classes
  .get("/deadlines/upcoming", async ({ user }) => {
    try {
      const guruId = user.id;

      const upcomingDeadlines = await query(`
        SELECT t.*, m.judul as materi_judul,
               GROUP_CONCAT(k.nama SEPARATOR ', ') as kelas_names,
               COUNT(DISTINCT st.siswa_id) as total_submissions,
               COUNT(DISTINCT CASE WHEN st.status = 'dikerjakan' THEN st.siswa_id END) as pending_grading
        FROM tugas t
        JOIN materi m ON t.materi_id = m.id
        JOIN materi_kelas mk ON m.id = mk.materi_id
        JOIN kelas k ON mk.kelas_id = k.id
        LEFT JOIN siswa_tugas st ON t.id = st.tugas_id
        WHERE t.guru_id = ? 
          AND t.deadline >= NOW() 
          AND t.deadline <= DATE_ADD(NOW(), INTERVAL 7 DAY)
        GROUP BY t.id
        ORDER BY t.deadline ASC
        LIMIT 5
      `, [guruId]) as any[];

      return {
        success: true,
        data: upcomingDeadlines
      };
    } catch (error) {
      console.error("Error getting upcoming deadlines:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat deadline yang akan datang" };
    }
  })

  // Get students by class for better organization
  .get("/siswa/by-kelas", async ({ user }) => {
    try {
      const guruId = user.id;

      // Get classes where this guru teaches
      const kelasGuru = await getKelasForGuru(guruId);

      const siswaByKelas = await Promise.all(
        kelasGuru.map(async (kelas) => {
          const siswaList = await getSiswaForKelas(kelas.id);

          const siswaWithProgress = await Promise.all(
            siswaList.map(async (siswa) => {
              // Get progress for this guru's assignments only
              const tugasGuru = await query("SELECT * FROM tugas WHERE guru_id = ?", [guruId]) as any[];
              const submissions = tugasGuru.length > 0 ? await query(`
                SELECT * FROM siswa_tugas 
                WHERE siswa_id = ? AND tugas_id IN (${tugasGuru.map(() => '?').join(',')})
              `, [siswa.id, ...tugasGuru.map(t => t.id)]) as any[] : [];

              const tugasDikerjakan = submissions.filter(s => s.status !== 'belum_dikerjakan').length;
              const nilaiList = submissions.filter(s => s.nilai !== null).map(s => s.nilai);
              const rataNilai = nilaiList.length > 0 ? Math.round(nilaiList.reduce((a, b) => a + b, 0) / nilaiList.length) : 0;

              return {
                ...siswa,
                progress: tugasGuru.length > 0 ? Math.round((tugasDikerjakan / tugasGuru.length) * 100) : 0,
                rata_nilai: rataNilai,
                tugas_dikerjakan: tugasDikerjakan,
                total_tugas: tugasGuru.length
              };
            })
          );

          return {
            kelas: kelas,
            siswa: siswaWithProgress,
            statistik: {
              total_siswa: siswaWithProgress.length,
              avg_progress: siswaWithProgress.length > 0 ?
                Math.round(siswaWithProgress.reduce((sum, s) => sum + s.progress, 0) / siswaWithProgress.length) : 0,
              avg_grade: siswaWithProgress.length > 0 ?
                Math.round(siswaWithProgress.reduce((sum, s) => sum + s.rata_nilai, 0) / siswaWithProgress.length) : 0
            }
          };
        })
      );

      return {
        success: true,
        data: siswaByKelas
      };
    } catch (error) {
      console.error("Error getting siswa by kelas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat siswa per kelas" };
    }
  })

  .get("/dashboard/recent-activity", async ({ user }) => {
    try {
      const guruId = user.id;

      // Recent materials
      const aktivitasMateri = (await query(
        "SELECT * FROM materi WHERE guru_id = ? ORDER BY created_at DESC LIMIT 5",
        [guruId]
      ) as any[]).map(m => ({
        type: "materi",
        title: `Materi "${m.judul}" dibuat`,
        description: m.deskripsi || "Tidak ada deskripsi",
        created_at: m.created_at
      }));

      // Recent assignments
      const aktivitasTugas = (await query(
        "SELECT * FROM tugas WHERE guru_id = ? ORDER BY created_at DESC LIMIT 5",
        [guruId]
      ) as any[]).map(t => ({
        type: "tugas",
        title: `Tugas "${t.judul}" dibuat`,
        description: t.deskripsi || "Tidak ada deskripsi",
        created_at: t.created_at
      }));

      // Recent grading
      const aktivitasNilai = (await query(`
        SELECT st.*, u.nama as siswa_nama, t.judul as tugas_judul
        FROM siswa_tugas st
        JOIN users u ON st.siswa_id = u.id
        JOIN tugas t ON st.tugas_id = t.id
        WHERE t.guru_id = ? AND st.graded_at IS NOT NULL
        ORDER BY st.graded_at DESC LIMIT 5
      `, [guruId]) as any[]).map(st => ({
        type: "nilai",
        title: `Nilai diberikan untuk ${st.siswa_nama}`,
        description: `Tugas: ${st.tugas_judul}, Nilai: ${st.nilai}`,
        created_at: st.graded_at
      }));

      const semuaAktivitas = [
        ...aktivitasMateri,
        ...aktivitasTugas,
        ...aktivitasNilai
      ].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 10);

      return {
        success: true,
        data: semuaAktivitas
      };
    } catch (error) {
      console.error("Error getting recent activity:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat aktivitas terbaru" };
    }
  })

  .get("/materi", async ({ user }) => {
    try {
      const guruId = user.id;
      const materiGuru = await query("SELECT * FROM materi WHERE guru_id = ? ORDER BY created_at DESC", [guruId]) as any[];

      const materiWithKelas = await Promise.all(materiGuru.map(async (m) => {
        const kelasMateri = await getKelasForMateri(m.id);
        const kelasNames = kelasMateri.map(k => k.nama).join(", ");

        return {
          id: m.id,
          judul: m.judul || "Judul tidak tersedia",
          deskripsi: m.deskripsi || "Tidak ada deskripsi",
          kelas: kelasNames,
          created_at: m.created_at,
          updated_at: m.updated_at
        };
      }));

      return {
        success: true,
        data: materiWithKelas
      };
    } catch (error) {
      console.error("Error getting materi:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat materi" };
    }
  })

  .post("/materi", async ({ user, body, set }) => {
    try {
      const guruId = user.id;
      const { judul, deskripsi, konten, kelas_ids } = body as any;

      if (!judul || !konten || !kelas_ids || !Array.isArray(kelas_ids) || kelas_ids.length === 0) {
        set.status = 400;
        return { success: false, error: "Judul, konten, dan minimal satu kelas harus diisi" };
      }

      const newMateriId = await createMateri({
        judul: judul.trim(),
        deskripsi: deskripsi?.trim() || "",
        konten: konten.trim(),
        guru_id: guruId
      });

      // Add to classes
      for (const kelasId of kelas_ids) {
        await addMateriToKelas(newMateriId, kelasId);
      }

      return {
        success: true,
        message: "Materi berhasil dibuat",
        data: {
          id: newMateriId,
          judul: judul.trim()
        }
      };
    } catch (error) {
      console.error("Error creating materi:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat membuat materi" };
    }
  })

  .put("/materi/:id", async ({ user, params, body, set }) => {
    try {
      const guruId = user.id;
      const materiId = parseInt(params.id);

      if (isNaN(materiId)) {
        set.status = 400;
        return { success: false, error: "ID materi tidak valid" };
      }

      const materiResult = await query("SELECT * FROM materi WHERE id = ? AND guru_id = ?", [materiId, guruId]) as any[];
      if (materiResult.length === 0) {
        set.status = 404;
        return { success: false, error: "Materi tidak ditemukan" };
      }

      const { judul, deskripsi, konten, kelas_ids } = body as any;
      if (!judul || !konten) {
        set.status = 400;
        return { success: false, error: "Judul dan konten materi harus diisi" };
      }

      // Update materi using new function
      await updateMateri(materiId, guruId, {
        judul: judul.trim(),
        deskripsi: deskripsi?.trim() || "",
        konten: konten.trim()
      });

      if (kelas_ids && Array.isArray(kelas_ids)) {
        // Remove all existing class assignments
        await query("DELETE FROM materi_kelas WHERE materi_id = ?", [materiId]);

        // Add new class assignments
        for (const kelasId of kelas_ids) {
          await addMateriToKelas(materiId, kelasId);
        }
      }

      return {
        success: true,
        message: "Materi berhasil diupdate"
      };
    } catch (error) {
      console.error("Error updating materi:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat mengupdate materi" };
    }
  })

  .delete("/materi/:id", async ({ user, params, set }) => {
    try {
      const guruId = user.id;
      const materiId = parseInt(params.id);

      if (isNaN(materiId)) {
        set.status = 400;
        return { success: false, error: "ID materi tidak valid" };
      }

      const success = await deleteMateri(materiId, guruId);
      if (!success) {
        set.status = 404;
        return { success: false, error: "Materi tidak ditemukan" };
      }

      return {
        success: true,
        message: "Materi berhasil dihapus"
      };
    } catch (error) {
      console.error("Error deleting materi:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat menghapus materi" };
    }
  })

  .get("/tugas", async ({ user }) => {
    try {
      const guruId = user.id;
      const tugasGuru = await query("SELECT * FROM tugas WHERE guru_id = ? ORDER BY deadline ASC", [guruId]) as any[];

      const tugasWithCounts = await Promise.all(tugasGuru.map(async (t) => {
        const submissionCountResult = await query(
          "SELECT COUNT(*) as count FROM siswa_tugas WHERE tugas_id = ?",
          [t.id]
        ) as any[];
        const submissionCount = submissionCountResult[0].count;

        const gradedCountResult = await query(
          "SELECT COUNT(*) as count FROM siswa_tugas WHERE tugas_id = ? AND nilai IS NOT NULL",
          [t.id]
        ) as any[];
        const gradedCount = gradedCountResult[0].count;

        const getMateri = await getMateriById(t.materi_id)
        const kelasMateri = await getKelasForMateri(t.materi_id);
        const kelasNames = kelasMateri.map(k => k.nama).join(", ");

        return {
          ...t,
          materi_judul: getMateri?.judul,
          submissions_count: submissionCount,
          graded_count: gradedCount,
          kelas: kelasNames
        };
      }));

      return {
        success: true,
        data: tugasWithCounts
      };
    } catch (error) {
      console.error("Error getting tugas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat tugas" };
    }
  })

  // Updated to handle deletion properly
  .delete("/tugas/:id", async ({ user, params, set }) => {
    try {
      const guruId = user.id;
      const tugasId = parseInt(params.id);

      if (isNaN(tugasId)) {
        set.status = 400;
        return { success: false, error: "ID tugas tidak valid" };
      }

      // Verify ownership before deleting
      const tugasResult = await query("SELECT * FROM tugas WHERE id = ? AND guru_id = ?", [tugasId, guruId]) as any[];
      if (tugasResult.length === 0) {
        set.status = 404;
        return { success: false, error: "Tugas tidak ditemukan atau tidak memiliki akses" };
      }

      // Delete the assignment
      const deleteResult = await query("DELETE FROM tugas WHERE id = ? AND guru_id = ?", [tugasId, guruId]) as any;

      if (deleteResult.affectedRows > 0) {
        return {
          success: true,
          message: "Tugas berhasil dihapus"
        };
      } else {
        set.status = 404;
        return { success: false, error: "Tugas tidak ditemukan" };
      }
    } catch (error) {
      console.error("Error deleting tugas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat menghapus tugas" };
    }
  })

  // Updated to handle editing properly  
  .put("/tugas/:id", async ({ user, params, body, set }) => {
    try {
      const guruId = user.id;
      const tugasId = parseInt(params.id);

      if (isNaN(tugasId)) {
        set.status = 400;
        return { success: false, error: "ID tugas tidak valid" };
      }

      const tugasResult = await query("SELECT * FROM tugas WHERE id = ? AND guru_id = ?", [tugasId, guruId]) as any[];
      if (tugasResult.length === 0) {
        set.status = 404;
        return { success: false, error: "Tugas tidak ditemukan" };
      }

      const { judul, deskripsi, deadline } = body as any;

      let updateFields = [];
      let values = [];

      if (judul !== undefined) {
        updateFields.push('judul = ?');
        values.push(judul.trim());
      }

      if (deskripsi !== undefined) {
        updateFields.push('deskripsi = ?');
        values.push(deskripsi?.trim() || "");
      }

      if (deadline !== undefined) {
        updateFields.push('deadline = ?');
        values.push(new Date(deadline));
      }

      if (updateFields.length === 0) {
        set.status = 400;
        return { success: false, error: "Tidak ada data yang diupdate" };
      }

      updateFields.push('updated_at = NOW()');
      values.push(tugasId, guruId);

      await query(`
        UPDATE tugas 
        SET ${updateFields.join(', ')} 
        WHERE id = ? AND guru_id = ?
      `, values);

      return {
        success: true,
        message: "Tugas berhasil diupdate"
      };
    } catch (error) {
      console.error("Error updating tugas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat mengupdate tugas" };
    }
  })

  .post("/tugas", async ({ user, body, set }) => {
    try {
      const guruId = user.id;
      const { judul, deskripsi, materi_id, deadline } = body as any;

      if (!judul || !materi_id || !deadline) {
        set.status = 400;
        return { success: false, error: "Judul, materi, dan deadline harus diisi" };
      }

      const materiResult = await query("SELECT * FROM materi WHERE id = ? AND guru_id = ?", [parseInt(materi_id), guruId]) as any[];
      if (materiResult.length === 0) {
        set.status = 404;
        return { success: false, error: "Materi tidak ditemukan atau tidak memiliki akses" };
      }

      // Convert deadline to proper DATETIME format
      const deadlineDate = new Date(deadline);

      const newTugasId = await createTugas({
        judul: judul.trim(),
        deskripsi: deskripsi?.trim() || "",
        materi_id: parseInt(materi_id),
        guru_id: guruId,
        deadline: deadlineDate
      });

      return {
        success: true,
        message: "Tugas berhasil dibuat",
        data: {
          id: newTugasId,
          judul: judul.trim()
        }
      };
    } catch (error) {
      console.error("Error creating tugas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat membuat tugas" };
    }
  })

  .get("/tugas/:id/submissions", async ({ user, params, set }) => {
    try {
      const guruId = user.id;
      const tugasId = parseInt(params.id);

      if (isNaN(tugasId)) {
        set.status = 400;
        return { success: false, error: "ID tugas tidak valid" };
      }

      const tugasResult = await query("SELECT * FROM tugas WHERE id = ? AND guru_id = ?", [tugasId, guruId]) as any[];
      if (tugasResult.length === 0) {
        set.status = 404;
        return { success: false, error: "Tugas tidak ditemukan" };
      }

      const tugasItem = tugasResult[0];
      const kelasMateri = await getKelasForMateri(tugasItem.materi_id);

      // Get all students from classes that have this material
      const allStudents = [];
      for (const kelas of kelasMateri) {
        const siswaKelas = await getSiswaForKelas(kelas.id);
        allStudents.push(...siswaKelas);
      }

      // Remove duplicates
      const uniqueStudents = allStudents.filter((student, index, self) =>
        index === self.findIndex(s => s.id === student.id)
      );

      const tugasSubmissions = await Promise.all(uniqueStudents.map(async (siswa) => {
        const submissionResult = await query(
          "SELECT * FROM siswa_tugas WHERE siswa_id = ? AND tugas_id = ?",
          [siswa.id, tugasItem.id]
        ) as any[];

        const submission = submissionResult[0] || null;

        return {
          siswa_id: siswa.id,
          siswa_nama: siswa.nama,
          siswa_email: siswa.email,
          jawaban: submission?.jawaban,
          nilai: submission?.nilai,
          feedback: submission?.feedback,
          status: submission?.status || 'belum_dikerjakan',
          submitted_at: submission?.submitted_at,
          graded_at: submission?.graded_at
        };
      }));

      return {
        success: true,
        data: {
          tugas: {
            id: tugasItem.id,
            judul: tugasItem.judul,
            deskripsi: tugasItem.deskripsi,
            deadline: tugasItem.deadline,
            kelas: kelasMateri.map(k => k.nama).join(", ")
          },
          submissions: tugasSubmissions
        }
      };
    } catch (error) {
      console.error("Error getting tugas submissions:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat memuat submissions" };
    }
  })

  .get("/submissions/pending", async ({ user }) => {
    try {
      const guruId = user.id;
      const pendingSubmissions = await getPendingSubmissions(guruId);

      return {
        success: true,
        data: pendingSubmissions
      };
    } catch (error) {
      console.error("Error getting pending submissions:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat submission pending" };
    }
  })

  .post("/submissions/:id/grade", async ({ user, params, body, set }) => {
    try {
      const guruId = user.id;
      const submissionId = parseInt(params.id);

      if (isNaN(submissionId)) {
        set.status = 400;
        return { success: false, error: "ID submission tidak valid" };
      }

      const submissionResult = await query("SELECT * FROM siswa_tugas WHERE id = ?", [submissionId]) as any[];
      if (submissionResult.length === 0) {
        set.status = 404;
        return { success: false, error: "Submission tidak ditemukan" };
      }

      const submission = submissionResult[0];
      const tugasResult = await query("SELECT * FROM tugas WHERE id = ? AND guru_id = ?", [submission.tugas_id, guruId]) as any[];
      if (tugasResult.length === 0) {
        set.status = 403;
        return { success: false, error: "Anda tidak memiliki akses untuk menilai submission ini" };
      }

      const { nilai, feedback } = body as any;
      if (nilai === undefined || nilai < 0 || nilai > 100) {
        set.status = 400;
        return { success: false, error: "Nilai harus antara 0-100" };
      }

      await gradeTugas(submission.siswa_id, submission.tugas_id, parseInt(nilai), feedback?.trim() || "");

      return {
        success: true,
        message: "Nilai berhasil diberikan"
      };
    } catch (error) {
      console.error("Error grading submission:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat memberikan nilai" };
    }
  })

  .get("/siswa/progress", async ({ user }) => {
    try {
      const guruId = user.id;
      const siswaProgress = await getGuruSiswaProgress(guruId);

      return {
        success: true,
        data: siswaProgress
      };
    } catch (error) {
      console.error("Error getting siswa progress:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat progress siswa" };
    }
  })

  .get("/siswa/:id/progress", async ({ user, params, set }) => {
    try {
      const guruId = user.id;
      const siswaId = parseInt(params.id);

      if (isNaN(siswaId)) {
        set.status = 400;
        return { success: false, error: "ID siswa tidak valid" };
      }

      const siswaResult = await query("SELECT * FROM users WHERE id = ? AND role = 'siswa' AND status = 'active'", [siswaId]) as any[];
      if (siswaResult.length === 0) {
        set.status = 404;
        return { success: false, error: "Siswa tidak ditemukan" };
      }
      const siswa = siswaResult[0];

      // Check if this student has access to guru's materials
      const hasAccess = await query(`
        SELECT COUNT(*) as count FROM users u
        JOIN siswa_kelas sk ON u.id = sk.siswa_id
        JOIN materi_kelas mk ON sk.kelas_id = mk.kelas_id
        JOIN materi m ON mk.materi_id = m.id
        WHERE u.id = ? AND m.guru_id = ? AND u.role = 'siswa'
      `, [siswaId, guruId]) as any[];

      if (hasAccess[0].count === 0) {
        set.status = 403;
        return { success: false, error: "Siswa tidak memiliki akses ke materi Anda" };
      }

      const tugasGuru = await query("SELECT * FROM tugas WHERE guru_id = ?", [guruId]) as any[];
      const submissionsSiswa = await query("SELECT * FROM siswa_tugas WHERE siswa_id = ?", [siswaId]) as any[];

      const totalTugas = tugasGuru.length;
      const tugasDikerjakan = submissionsSiswa.filter(s =>
        tugasGuru.some(t => t.id === s.tugas_id) && s.status !== 'belum_dikerjakan'
      ).length;
      const tugasDinilai = submissionsSiswa.filter(s =>
        tugasGuru.some(t => t.id === s.tugas_id) && s.nilai !== undefined && s.nilai !== null
      ).length;

      const nilaiSiswa = submissionsSiswa
        .filter(s => tugasGuru.some(t => t.id === s.tugas_id) && s.nilai !== undefined && s.nilai !== null)
        .map(s => s.nilai as number);

      const rataNilai = nilaiSiswa.length > 0
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;

      const progress = totalTugas > 0
        ? Math.round((tugasDikerjakan / totalTugas) * 100)
        : 0;

      const detailTugas = await Promise.all(tugasGuru.map(async (tugasItem) => {
        const submissionResult = await query(
          "SELECT * FROM siswa_tugas WHERE siswa_id = ? AND tugas_id = ?",
          [siswaId, tugasItem.id]
        ) as any[];

        const submission = submissionResult[0];
        const materiItem = await getMateriById(tugasItem.materi_id);
        const kelasMateri = await getKelasForMateri(tugasItem.materi_id);

        return {
          id: tugasItem.id,
          judul: tugasItem.judul,
          deskripsi: tugasItem.deskripsi,
          materi: materiItem?.judul || "Tidak diketahui",
          kelas: kelasMateri.map(k => k.nama).join(", "),
          deadline: tugasItem.deadline,
          status: submission ? submission.status : 'belum_dikerjakan',
          nilai: submission?.nilai || null,
          feedback: submission?.feedback || "",
          submitted_at: submission?.submitted_at || null,
          graded_at: submission?.graded_at || null,
          jawaban: submission?.jawaban || ""
        };
      }));

      return {
        success: true,
        data: {
          siswa: {
            id: siswa.id,
            nama: siswa.nama,
            email: siswa.email,
            last_login: siswa.last_login,
            last_activity: siswa.last_activity
          },
          statistik: {
            total_tugas: totalTugas,
            tugas_dikerjakan: tugasDikerjakan,
            tugas_dinilai: tugasDinilai,
            progress: progress,
            rata_rata_nilai: rataNilai
          },
          detail_tugas: detailTugas
        }
      };
    } catch (error) {
      console.error("Error getting siswa detail progress:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat memuat detail progress siswa" };
    }
  })

  .get("/diskusi", async ({ user }) => {
    try {
      const guruId = user.id;

      const materiGuru = await query("SELECT * FROM materi WHERE guru_id = ?", [guruId]) as any[];
      const materiIds = materiGuru.map(m => m.id);

      if (materiIds.length === 0) {
        return { success: true, data: [] };
      }

      const placeholders = materiIds.map(() => '?').join(',');
      const diskusiGuru = await query(
        `SELECT dm.*, u.nama as user_name, m.judul as materi_judul
         FROM diskusi_materi dm
         JOIN users u ON dm.user_id = u.id
         JOIN materi m ON dm.materi_id = m.id
         WHERE dm.materi_id IN (${placeholders}) 
         ORDER BY dm.created_at DESC`,
        materiIds
      ) as any[];

      const diskusiWithDetails = await Promise.all(diskusiGuru.map(async (d) => {
        const kelasMateri = await getKelasForMateri(d.materi_id);

        return {
          id: d.id,
          materi_id: d.materi_id,
          materi_judul: d.materi_judul,
          kelas: kelasMateri.map(k => k.nama).join(", "),
          user_id: d.user_id,
          user_name: d.user_name,
          user_role: d.user_role,
          isi: d.isi,
          parent_id: d.parent_id,
          created_at: d.created_at
        };
      }));

      return {
        success: true,
        data: diskusiWithDetails
      };
    } catch (error) {
      console.error("Error getting diskusi:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat diskusi" };
    }
  })

  .post("/diskusi/:id/reply", async ({ user, params, body, set }) => {
    try {
      const guruId = user.id;
      const diskusiId = parseInt(params.id);

      if (isNaN(diskusiId)) {
        set.status = 400;
        return { success: false, error: "ID diskusi tidak valid" };
      }

      const diskusiResult = await query("SELECT * FROM diskusi_materi WHERE id = ?", [diskusiId]) as any[];
      if (diskusiResult.length === 0) {
        set.status = 404;
        return { success: false, error: "Diskusi tidak ditemukan" };
      }

      const diskusiAsli = diskusiResult[0];
      const materiResult = await query("SELECT * FROM materi WHERE id = ? AND guru_id = ?", [diskusiAsli.materi_id, guruId]) as any[];
      if (materiResult.length === 0) {
        set.status = 403;
        return { success: false, error: "Anda tidak memiliki akses untuk membalas diskusi ini" };
      }

      const { reply } = body as any;
      if (!reply || reply.trim().length === 0) {
        set.status = 400;
        return { success: false, error: "Balasan tidak boleh kosong" };
      }

      const result = await query(
        "INSERT INTO diskusi_materi (materi_id, user_id, user_role, isi, parent_id, created_at) VALUES (?, ?, 'guru', ?, ?, NOW())",
        [diskusiAsli.materi_id, guruId, reply.trim(), diskusiId]
      ) as any;

      return {
        success: true,
        message: "Balasan berhasil dikirim",
        data: {
          id: result.insertId,
          materi_id: diskusiAsli.materi_id
        }
      };
    } catch (error) {
      console.error("Error replying to discussion:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat mengirim balasan" };
    }
  })

  // Get available classes for adding material
  .get("/kelas/available", async ({ user }) => {
    try {
      const guruId = user.id;

      // Get classes where this guru teaches
      const guruKelas = await getKelasForGuru(guruId);

      return {
        success: true,
        data: guruKelas.map(k => ({
          id: k.id,
          nama: k.nama,
          tingkat: k.tingkat
        }))
      };
    } catch (error) {
      console.error("Error getting available classes:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat daftar kelas" };
    }
  })

  // Update materi to support kelas assignment
  .get("/materi/:id/kelas", async ({ user, params, set }) => {
    try {
      const guruId = user.id;
      const materiId = parseInt(params.id);

      if (isNaN(materiId)) {
        set.status = 400;
        return { success: false, error: "ID materi tidak valid" };
      }

      const materiResult = await query("SELECT * FROM materi WHERE id = ? AND guru_id = ?", [materiId, guruId]) as any[];
      if (materiResult.length === 0) {
        set.status = 404;
        return { success: false, error: "Materi tidak ditemukan" };
      }

      const kelasMateri = await getKelasForMateri(materiId);

      return {
        success: true,
        data: {
          materi: materiResult[0],
          assigned_kelas: kelasMateri
        }
      };
    } catch (error) {
      console.error("Error getting materi kelas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat memuat data materi" };
    }
  });