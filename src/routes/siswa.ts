import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import {
  getUsers, getKelasForSiswa, getMateriForKelas, getKelasForMateri,
  getSubmissionForSiswa, getMateriProgressForSiswa, getTugasWithStatus,
  getTugasForSiswa, getMateriById, submitTugas, getTugasForKelas, updateMateriProgress,
  query, getUserById, updateUserActivity, markMateriAsCompleted, createDiskusiMateri
} from "../db";

export const siswaRoutes = new Elysia({ prefix: "/siswa" })
  .derive(authMiddleware as any)

  .onBeforeHandle(({ user, set }) => {
    if (!user || !user.id) {
      set.status = 401;
      return { success: false, error: "Silakan login terlebih dahulu" };
    }

    if (user.role !== "siswa") {
      set.status = 403;
      return { success: false, error: "Akses ditolak. Hanya siswa yang dapat mengakses endpoint ini." };
    }
  })

  .get("/dashboard-stats", async ({ user }) => {
    try {
      const siswaId = user.id
      const siswa = await getUserById(siswaId)

      if (!siswa) {
        return { success: false, error: 'Siswa tidak ditemukan' }
      }

      const kelasSiswa = await getKelasForSiswa(siswaId)
      if (kelasSiswa.length === 0) {
        return { success: false, error: 'Siswa belum terdaftar di kelas manapun' }
      }

      // get all materials for student's classes
      const semuaMateriPromises = kelasSiswa.map(k => getMateriForKelas(k.id))
      const semuaMateriArrays = await Promise.all(semuaMateriPromises)
      const semuaMateri = semuaMateriArrays.flat()

      // remove duplicate materials
      const uniqueMateri = semuaMateri.filter((materi, index, self) =>
        index === self.findIndex(m => m.id === materi.id)
      )

      const totalMateri = uniqueMateri.length

      // get all assignment for student
      const semuaTugas = await getTugasForSiswa(siswaId)
      const totalTugas = semuaTugas.length

      // get submissions with proper status filtering
      const siswaTugas = await getSubmissionForSiswa(siswaId) as any[]

      // only count submitted tasks
      const tugasDikerjakan = siswaTugas.filter(st =>
        st.status === 'dikerjakan' || st.status === 'selesai'
      ).length

      // Only count graded tasks
      const tugasSelesai = siswaTugas.filter(st =>
        st.status === 'selesai' && st.nilai !== null && st.nilai !== undefined
      ).length

      // Calculate average grade from graded tasks only
      const nilaiSiswa = siswaTugas
        .filter(st => st.nilai !== null && st.nilai !== undefined)
        .map(st => Number(st.nilai));

      const rataNilai = nilaiSiswa.length > 0
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;

      const tugasProgress = totalTugas > 0
        ? Math.min(Math.round((tugasDikerjakan / totalTugas) * 100), 100)
        : 0;

      // Get material progress
      const siswaMateri = await getMateriProgressForSiswa(siswaId) as any[];
      const materiDipelajari = siswaMateri.filter(sm => sm.is_completed).length;
      const materiProgress = totalMateri > 0
        ? Math.min(Math.round((materiDipelajari / totalMateri) * 100), 100)
        : 0;

      const overallProgress = Math.min(Math.round((tugasProgress + materiProgress) / 2), 100);

      return {
        success: true,
        data: {
          total_materi: totalMateri,
          materi_dipelajari: materiDipelajari,
          progress_materi: materiProgress,
          total_tugas: totalTugas,
          tugas_dikerjakan: tugasDikerjakan,
          tugas_selesai: tugasSelesai,
          tugas_pending: tugasDikerjakan - tugasSelesai,
          rata_nilai: rataNilai,
          overall_progress: overallProgress,
          kelas: kelasSiswa.map(k => `${k.nama} (Tingkat ${k.tingkat})`)
        }
      };

    } catch (error) {
      console.error("Error loading dashboard stats:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat statistik dashboard" };
    }
  })

  .get("/materi", async ({ user }) => {
    try {
      const siswaId = user.id;
      const siswa = await getUserById(siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = await getKelasForSiswa(siswaId);
      if (kelasSiswa.length === 0) {
        return { success: false, error: "Siswa belum terdaftar di kelas manapun" };
      }

      // Get all materials for student's classes
      const semuaMateriPromises = kelasSiswa.map(k => getMateriForKelas(k.id));
      const semuaMateriArrays = await Promise.all(semuaMateriPromises);
      const semuaMateri = semuaMateriArrays.flat();

      // Remove duplicates
      const uniqueMateri = semuaMateri.filter((materi, index, self) =>
        index === self.findIndex(m => m.id === materi.id)
      );

      const materiSiswa = await Promise.all(uniqueMateri.map(async (m) => {
        const users = await getUsers();
        const guru = users.find(u => u.id === m.guru_id);
        const progress = await getMateriProgressForSiswa(siswaId, m.id) as any;

        const konten = m.konten || "Tidak ada konten yang tersedia";
        const preview = konten.length > 200 ? konten.substring(0, 200) + "..." : konten;

        const kelasMateri = await getKelasForMateri(m.id);

        return {
          id: m.id,
          judul: m.judul || "Judul tidak tersedia",
          deskripsi: m.deskripsi || "Tidak ada deskripsi",
          konten: konten,
          konten_preview: preview,
          guru_nama: guru?.nama || "Tidak diketahui",
          kelas: kelasMateri.map(k => k.nama).join(", "),
          created_at: m.created_at,
          updated_at: m.updated_at,
          last_accessed: progress?.last_accessed,
          is_completed: progress?.is_completed || false,
          progress: progress ? (progress.is_completed ? 100 : 50) : 0
        };
      }));

      return {
        success: true,
        data: materiSiswa
      };

    } catch (error) {
      console.error("Error loading materi:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat materi" };
    }
  })

  .get("/tugas", async ({ user }) => {
    try {
      const siswaId = user.id;
      const siswa = await getUserById(siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const tugasSiswa = await getTugasWithStatus(siswaId);
      const tugasAktif = tugasSiswa.filter(tugas =>
        tugas.status !== 'selesai' || tugas.nilai === null || tugas.nilai === undefined
      );

      return {
        success: true,
        data: tugasAktif
      };

    } catch (error) {
      console.error("Error loading tugas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat tugas" };
    }
  })

  .get("/tugas-recent", async ({ user }) => {
    try {
      const siswaId = user.id;
      const siswa = await getUserById(siswaId);
      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const tugasSiswa = await getTugasWithStatus(siswaId);

      const recentTugas = tugasSiswa
        .filter(tugas =>
          tugas.status !== 'selesai' || tugas.nilai === null || tugas.nilai === undefined
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);

      return {
        success: true,
        data: recentTugas
      };

    } catch (error) {
      console.error("Error loading recent tugas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat tugas terbaru" };
    }
  })

  .post("/tugas/:id/submit", async ({ user, params, body, set }) => {
    try {
      const siswaId = user.id;
      const tugasId = parseInt(params.id);

      if (isNaN(tugasId)) {
        set.status = 400;
        return { success: false, error: "ID tugas tidak valid" };
      }

      const tugasResult = await query("SELECT * FROM tugas WHERE id = ?", [tugasId]) as any[];
      const tugasItem = tugasResult[0];
      if (!tugasItem) {
        set.status = 404;
        return { success: false, error: "Tugas tidak ditemukan" };
      }

      // Check if student has access to this assignment
      const kelasSiswa = await getKelasForSiswa(siswaId);
      const materiKelas = await getKelasForMateri(tugasItem.materi_id);
      const hasAccess = kelasSiswa.some(ks =>
        materiKelas.some(mk => mk.id === ks.id)
      );

      if (!hasAccess) {
        set.status = 403;
        return { success: false, error: "Anda tidak memiliki akses ke tugas ini" };
      }

      const { jawaban } = body as any;
      if (!jawaban || jawaban.trim().length === 0) {
        set.status = 400;
        return { success: false, error: "Jawaban tidak boleh kosong" };
      }

      await submitTugas(siswaId, tugasId, jawaban.trim());
      await updateMateriProgress(siswaId, tugasItem.materi_id, false);
      await updateUserActivity(siswaId);

      return {
        success: true,
        message: "Tugas berhasil dikumpulkan"
      };

    } catch (error) {
      console.error("Error submitting tugas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat mengumpulkan tugas" };
    }
  })

  .get("/nilai", async ({ user }) => {
    try {
      const siswaId = user.id;

      const siswaTugas = await getSubmissionForSiswa(siswaId) as any[];
      const nilaiSiswa = siswaTugas
        .filter(st => st.status === 'selesai' && st.nilai !== null && st.nilai !== undefined)
        .map(st => ({
          id: st.id,
          tugas_id: st.tugas_id,
          nilai: st.nilai,
          feedback: st.feedback,
          submitted_at: st.submitted_at,
          graded_at: st.graded_at,
          jawaban: st.jawaban
        }));

      // Get task and material details
      const nilaiWithDetails = await Promise.all(nilaiSiswa.map(async (nilai) => {
        const tugasResult = await query("SELECT * FROM tugas WHERE id = ?", [nilai.tugas_id]) as any[];
        const tugasItem = tugasResult[0];

        if (!tugasItem) {
          return {
            ...nilai,
            tugas_judul: "Tugas tidak ditemukan",
            materi_judul: "Materi tidak ditemukan",
            kelas: "Tidak diketahui"
          };
        }

        const materiResult = await query("SELECT * FROM materi WHERE id = ?", [tugasItem.materi_id]) as any[];
        const materiItem = materiResult[0];
        const kelasMateri = await getKelasForMateri(tugasItem.materi_id);

        return {
          ...nilai,
          tugas_judul: tugasItem.judul || "Tugas tidak ditemukan",
          materi_judul: materiItem?.judul || "Materi tidak ditemukan",
          kelas: kelasMateri.map(k => k.nama).join(", ")
        };
      }));

      return {
        success: true,
        data: nilaiWithDetails
      };

    } catch (error) {
      console.error("Error loading nilai:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat nilai" };
    }
  })

  .get("/diskusi-kelas", async ({ user }) => {
    try {
      const siswaId = user.id;
      const siswa = await getUserById(siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = await getKelasForSiswa(siswaId);
      const namaKelas = kelasSiswa.map(k => k.nama);

      if (namaKelas.length === 0) {
        return { success: true, data: [] };
      }

      const placeholders = namaKelas.map(() => '?').join(',');
      const diskusiResult = await query(
        `SELECT d.*, u.nama as user_name 
         FROM diskusi d
         JOIN users u ON d.user_id = u.id
         WHERE d.kelas IN (${placeholders}) 
         ORDER BY d.created_at DESC`,
        namaKelas
      ) as any[];

      const diskusiKelasSiswa = diskusiResult.map(d => ({
        id: d.id,
        kelas: d.kelas,
        isi: d.isi,
        user_name: d.user_name,
        user_role: d.user_role,
        created_at: d.created_at
      }));

      return {
        success: true,
        data: diskusiKelasSiswa
      };

    } catch (error) {
      console.error("Error loading diskusi kelas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat diskusi kelas" };
    }
  })

  .get("/diskusi-materi", async ({ user }) => {
    try {
      const siswaId = user.id;
      const siswa = await getUserById(siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = await getKelasForSiswa(siswaId);
      const materiSiswaPromises = kelasSiswa.map(k => getMateriForKelas(k.id));
      const materiSiswaArrays = await Promise.all(materiSiswaPromises);
      const materiSiswa = materiSiswaArrays.flat();

      // Remove duplicates
      const uniqueMateri = materiSiswa.filter((materi, index, self) =>
        index === self.findIndex(m => m.id === materi.id)
      );

      const materiIds = uniqueMateri.map(m => m.id);
      if (materiIds.length === 0) {
        return { success: true, data: [] };
      }

      const placeholders = materiIds.map(() => '?').join(',');
      const diskusiResult = await query(
        `SELECT dm.*, u.nama as user_name, m.judul as materi_judul
         FROM diskusi_materi dm
         JOIN users u ON dm.user_id = u.id
         JOIN materi m ON dm.materi_id = m.id
         WHERE dm.materi_id IN (${placeholders}) 
         ORDER BY dm.created_at DESC`,
        materiIds
      ) as any[];

      const diskusiSiswa = diskusiResult.map(d => ({
        id: d.id,
        materi_id: d.materi_id,
        materi_judul: d.materi_judul,
        isi: d.isi,
        user_name: d.user_name,
        user_role: d.user_role,
        created_at: d.created_at
      }));

      return {
        success: true,
        data: diskusiSiswa
      };

    } catch (error) {
      console.error("Error loading diskusi materi:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat diskusi materi" };
    }
  })

  .post("/diskusi-materi", async ({ user, body, set }) => {
    try {
      const siswaId = user.id;
      const { materi_id, isi } = body as any;

      if (!materi_id || !isi) {
        set.status = 400;
        return { success: false, error: "Materi dan isi diskusi harus diisi" };
      }

      if (isi.length < 5) {
        set.status = 400;
        return { success: false, error: "Isi diskusi terlalu pendek" };
      }

      // Check if student has access to this material
      const kelasSiswa = await getKelasForSiswa(siswaId);
      const materiKelas = await getKelasForMateri(parseInt(materi_id));
      const hasAccess = kelasSiswa.some(ks =>
        materiKelas.some(mk => mk.id === ks.id)
      );

      if (!hasAccess) {
        set.status = 403;
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
      }

      const diskusiId = await createDiskusiMateri(parseInt(materi_id), siswaId, 'siswa', isi.trim());

      return {
        success: true,
        message: "Diskusi berhasil ditambahkan",
        data: {
          id: diskusiId
        }
      };

    } catch (error) {
      console.error("Error adding diskusi:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat menambah diskusi" };
    }
  })

  .get("/progress-detail", async ({ user }) => {
    try {
      const siswaId = user.id;
      const siswa = await getUserById(siswaId);

      if (!siswa) {
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const kelasSiswa = await getKelasForSiswa(siswaId);

      const materiSiswaPromises = kelasSiswa.map(k => getMateriForKelas(k.id));
      const materiSiswaArrays = await Promise.all(materiSiswaPromises);
      const allMateri = materiSiswaArrays.flat();

      const materiSiswa = allMateri.filter((materi, index, self) =>
        index === self.findIndex(m => m.id === materi.id)
      );

      const semuaTugas = await getTugasForSiswa(siswaId);
      const submissionsSiswa = await getSubmissionForSiswa(siswaId) as any[];
      const materiProgress = await getMateriProgressForSiswa(siswaId) as any[];

      const materiDipelajari = materiProgress.filter(mp => mp.is_completed).length;

      // Only count submitted/graded tasks
      const tugasDikerjakan = submissionsSiswa.filter(s =>
        s.status === 'dikerjakan' || s.status === 'selesai'
      ).length;

      const nilaiSiswa = submissionsSiswa
        .filter(s => s.nilai !== null && s.nilai !== undefined)
        .map(s => Number(s.nilai));

      const rataNilai = nilaiSiswa.length > 0
        ? Math.round(nilaiSiswa.reduce((a, b) => a + b, 0) / nilaiSiswa.length)
        : 0;

      return {
        success: true,
        data: {
          total_materi: materiSiswa.length,
          materi_dipelajari: materiDipelajari,
          total_tugas: semuaTugas.length,
          tugas_dikerjakan: tugasDikerjakan,
          rata_nilai: rataNilai,
          progress_materi: materiSiswa.length > 0
            ? Math.min(Math.round((materiDipelajari / materiSiswa.length) * 100), 100)
            : 0,
          progress_tugas: semuaTugas.length > 0
            ? Math.min(Math.round((tugasDikerjakan / semuaTugas.length) * 100), 100)
            : 0,

          detail_kelas: await Promise.all(kelasSiswa.map(async (k) => {
            const materiKelas = await getMateriForKelas(k.id);
            const tugasKelas = await getTugasForKelas(k.id);

            const tugasDikerjakanKelas = submissionsSiswa.filter(s =>
              tugasKelas.some(t => t.id === s.tugas_id) && (s.status === 'dikerjakan' || s.status === 'selesai')
            ).length;

            const materiDipelajariKelas = materiProgress.filter(mp =>
              materiKelas.some(m => m.id === mp.materi_id) && mp.is_completed
            ).length;

            return {
              id: k.id,
              nama: k.nama,
              total_materi: materiKelas.length,
              materi_dipelajari: materiDipelajariKelas,
              total_tugas: tugasKelas.length,
              tugas_dikerjakan: tugasDikerjakanKelas,
              progress_materi: materiKelas.length > 0
                ? Math.min(Math.round((materiDipelajariKelas / materiKelas.length) * 100), 100)
                : 0,
              progress_tugas: tugasKelas.length > 0
                ? Math.min(Math.round((tugasDikerjakanKelas / tugasKelas.length) * 100), 100)
                : 0
            };
          }))
        }
      };
    } catch (error) {
      console.error("Error loading progress detail:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat detail progress" };
    }
  })

  .get("/materi/:id", async ({ user, params, set }) => {
    try {
      const siswaId = user.id;
      const materiId = parseInt(params.id);

      if (isNaN(materiId)) {
        set.status = 400;
        return { success: false, error: "ID materi tidak valid" };
      }

      const materiItem = await getMateriById(materiId);
      if (!materiItem) {
        set.status = 404;
        return { success: false, error: "Materi tidak ditemukan" };
      }

      // Check if student has access to this material
      const kelasSiswa = await getKelasForSiswa(siswaId);
      const materiKelas = await getKelasForMateri(materiId);
      const hasAccess = kelasSiswa.some(ks =>
        materiKelas.some(mk => mk.id === ks.id)
      );

      if (!hasAccess) {
        set.status = 403;
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
      }

      const users = await getUsers();
      const guru = users.find(u => u.id === materiItem.guru_id);

      // Update access time using new function
      await updateMateriProgress(siswaId, materiId, false);

      // Update user activity
      await updateUserActivity(siswaId);

      return {
        success: true,
        data: {
          id: materiItem.id,
          judul: materiItem.judul || "Judul tidak tersedia",
          deskripsi: materiItem.deskripsi || "Tidak ada deskripsi",
          konten: materiItem.konten || "Tidak ada konten yang tersedia",
          guru_nama: guru?.nama || "Tidak diketahui",
          kelas: materiKelas.map(k => k.nama).join(", "),
          created_at: materiItem.created_at,
          updated_at: materiItem.updated_at
        }
      };

    } catch (error) {
      console.error("Error loading materi detail:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat memuat detail materi" };
    }
  })

  .post("/materi/:id/complete", async ({ user, params, set }) => {
    try {
      const siswaId = user.id;
      const materiId = parseInt(params.id);

      if (isNaN(materiId)) {
        set.status = 400;
        return { success: false, error: "ID materi tidak valid" };
      }

      // Check if student has access to this material
      const kelasSiswa = await getKelasForSiswa(siswaId);
      const materiKelas = await getKelasForMateri(materiId);
      const hasAccess = kelasSiswa.some(ks =>
        materiKelas.some(mk => mk.id === ks.id)
      );

      if (!hasAccess) {
        set.status = 403;
        return { success: false, error: "Anda tidak memiliki akses ke materi ini" };
      }

      // Mark as completed using updated function
      await markMateriAsCompleted(siswaId, materiId);

      // Update user activity
      await updateUserActivity(siswaId);

      return {
        success: true,
        message: "Materi berhasil ditandai sebagai selesai"
      };

    } catch (error) {
      console.error("Error completing materi:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan saat menandai materi sebagai selesai" };
    }
  });