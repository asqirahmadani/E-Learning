import { Elysia } from "elysia";
import { authMiddleware } from "../middleware/auth";
import {
  getUsers, getKelas, getMateri, getDiskusi, getDiskusiMateri,
  getUserByEmail, createDiskusi, addSiswaToKelas, isSiswaInKelas,
  getKelasForSiswa, getSiswaForKelas, getKelasForMateri, removeSiswaFromKelas,
  getGuruForKelas, getKelasForGuru, getUserById, getKelasById,
  getSubmissionForSiswa, createUser, query, getStatistics, createKelas,
  updateKelas, deleteKelas, addGuruToKelas, removeGuruFromKelas,
  getKelasDetail, getSiswaProgressInKelas, getLearningActivitySummary
} from "../db";
import { addGuruSchema, updateUserStatusSchema } from "../middleware/inputValidation";
import { hashPassword } from "../utils/hash";

export const kepsekRoutes = new Elysia({ prefix: "/kepsek" })
  .derive(authMiddleware as any)

  .onBeforeHandle(({ user, set }) => {
    if (!user || user.role !== "kepsek") {
      set.status = 403;
      return { success: false, error: "Akses ditolak. Hanya kepala sekolah yang dapat mengakses endpoint ini." };
    }
  })

  .get("/info-dasar", async () => {
    const stats = await getStatistics();

    return {
      success: true,
      data: {
        jumlah_guru: stats.totalGuru,
        jumlah_siswa: stats.totalSiswa,
        jumlah_kelas: stats.totalKelas,
        jumlah_materi: stats.totalMateri
      }
    };
  })

  .get('/aktivitas-pembelajaran', async () => {
    try {
      const activitySummary = await getLearningActivitySummary()

      const allActivities = [
        ...activitySummary.recent_materials,
        ...activitySummary.recent_assignments,
        ...activitySummary.recent_submissions,
        ...activitySummary.recent_grades
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 15)

      return {
        success: true,
        data: {
          recent_activities: allActivities,
          active_students_today: activitySummary.active_students_today,
          summary: {
            materials_created: activitySummary.recent_materials.length,
            assignments_created: activitySummary.recent_assignments.length,
            submissions_received: activitySummary.recent_submissions.length,
            grades_given: activitySummary.recent_grades.length
          }
        }
      }
    } catch (error) {
      console.error("Error getting learning activities:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat aktivitas pembelajaran" };
    }
  })

  .get("/guru/daftar", async () => {
    try {
      const users = await getUsers()
      const daftarGuru = await Promise.all(
        users
          .filter(u => u.role === 'guru')
          .map(async guru => {
            const kelasGuru = await getKelasForGuru(guru.id)
            const kelasName = kelasGuru.map(k => k.nama).join(', ')

            return {
              id: guru.id,
              nama: guru.nama,
              email: guru.email,
              bidang: guru.bidang || "-",
              kelas: kelasName || "Belum mengajar",
              status: guru.status,
              last_login: guru.last_login,
              login_count: guru.login_count
            }
          })
      )

      return {
        success: true,
        data: daftarGuru
      }
    } catch (error) {
      console.error("Error getting guru list:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat daftar guru" };
    }
  })

  .post("/guru/tambah", async ({ user, body, set }) => {
    try {
      const parsed = addGuruSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { success: false, error: "Data tidak valid", details: parsed.error.issues };
      }

      const { nama, email, password } = parsed.data;
      const bidang = (body as any).bidang || "";

      // Check if email already exists
      const existingUser = await getUserByEmail(email.toLowerCase());
      if (existingUser) {
        set.status = 400;
        return { success: false, error: "Email sudah terdaftar" };
      }

      const passwordHash = await hashPassword(password);
      const now = new Date();

      const newGuruId = await createUser({
        nama: nama.trim(),
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        role: "guru",
        status: "active",
        created_by: user.id,
        last_login: now,
        login_count: 0,
        last_activity: now,
        bidang: bidang.trim() || undefined
      });

      return {
        success: true,
        message: "Guru berhasil ditambahkan",
        data: {
          id: newGuruId,
          nama: nama.trim(),
          email: email.toLowerCase().trim(),
          bidang: bidang.trim() || undefined
        }
      };
    } catch (error) {
      console.error("Error adding guru:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .patch("/guru/status/:id", async ({ params, body, set }) => {
    try {
      const parsed = updateUserStatusSchema.safeParse({
        id: params.id,
        ...body
      });

      if (!parsed.success) {
        set.status = 400;
        return { success: false, error: "Data tidak valid", details: parsed.error.issues };
      }

      const { id, status } = parsed.data;

      await query(
        "UPDATE users SET status = ? WHERE id = ? AND role = 'guru'",
        [status, id]
      );

      const result = await query("SELECT ROW_COUNT() as affected") as any[];
      if (result[0].affected === 0) {
        set.status = 404;
        return { success: false, error: "Guru tidak ditemukan" };
      }

      return {
        success: true,
        message: `Status guru berhasil diubah menjadi ${status}`
      };
    } catch (error) {
      console.error("Error updating guru status:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .delete("/guru/hapus/:id", async ({ params, set }) => {
    try {
      const id = parseInt(params.id);
      if (isNaN(id)) {
        set.status = 400;
        return { success: false, error: "ID tidak valid" };
      }

      await query("DELETE FROM users WHERE id = ? AND role = 'guru'", [id]);

      const result = await query("SELECT ROW_COUNT() as affected") as any[];
      if (result[0].affected === 0) {
        set.status = 404;
        return { success: false, error: "Guru tidak ditemukan" };
      }

      return { success: true, message: "Guru berhasil dihapus" };
    } catch (error) {
      console.error("Error deleting guru:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .get('/kelas/daftar', async () => {
    try {
      const kelasList = await getKelas()
      const users = await getUsers()

      const kelasWithDetails = await Promise.all(
        kelasList.map(async kelas => {
          const waliKelas = users.find(u => u.id === kelas.wali_kelas_id);
          const siswaCount = (await getSiswaForKelas(kelas.id)).length;
          const guruList = await getGuruForKelas(kelas.id);

          return {
            id: kelas.id,
            nama: kelas.nama,
            tingkat: kelas.tingkat,
            wali_kelas: waliKelas?.nama || "Tidak ditentukan",
            wali_kelas_id: kelas.wali_kelas_id,
            jumlah_siswa: siswaCount,
            jumlah_guru: guruList.length,
            guru_list: guruList.map(g => ({
              nama: g.nama,
              bidang: g.bidang || "Tidak ditentukan"
            })),
            created_at: kelas.created_at
          };
        })
      )

      return {
        success: true,
        data: kelasWithDetails
      }
    } catch (error) {
      console.error("Error getting kelas list:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat daftar kelas" };
    }
  })

  .post('/kelas/tambah', async ({ body, set }) => {
    try {
      const { nama, tingkat, wali_kelas_id } = body as any

      if (!nama || !tingkat || !wali_kelas_id) {
        set.status = 400;
        return { success: false, error: "Nama kelas, tingkat, dan wali kelas harus diisi" };
      }

      const newKelasId = await createKelas(nama.trim(), tingkat.trim(), parseInt(wali_kelas_id))

      return {
        success: true,
        message: 'Kelas berhasil ditambahkan',
        data: {
          id: newKelasId,
          nama: nama.trim(),
          tingkat: tingkat.trim()
        }
      }
    } catch (error) {
      console.error("Error adding kelas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .put('/kelas/:id', async ({ params, body, set }) => {
    try {
      const kelasId = parseInt(params.id)
      if (isNaN(kelasId)) {
        set.status = 400;
        return { success: false, error: "ID kelas tidak valid" };
      }

      const { nama, tingkat, wali_kelas_id } = body as any;

      if (wali_kelas_id) {
        const waliKelas = await getUserById(parseInt(wali_kelas_id));
        if (!waliKelas || waliKelas.role !== "guru") {
          set.status = 400;
          return { success: false, error: "Wali kelas harus seorang guru" };
        }
      }

      await updateKelas(kelasId, {
        nama: nama?.trim(),
        tingkat: tingkat?.trim(),
        wali_kelas_id: wali_kelas_id ? parseInt(wali_kelas_id) : undefined
      });

      return {
        success: true,
        message: 'Kelas berhasil diupdate'
      }
    } catch (error) {
      console.error("Error updating kelas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .delete('/kelas/:id', async ({ params, set }) => {
    try {
      const kelasId = parseInt(params.id)
      if (isNaN(kelasId)) {
        set.status = 400;
        return { success: false, error: "ID kelas tidak valid" };
      }

      const success = await deleteKelas(kelasId)
      if (!success) {
        set.status = 404
        return { success: false, error: 'Kelas tidak ditemukan' }
      }

      return {
        success: true,
        message: 'Kelas berhasil dihapus'
      }
    } catch (error) {
      console.error("Error deleting kelas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .get('/kelas/:id/detail', async ({ params, set }) => {
    try {
      const kelasId = parseInt(params.id)
      if (isNaN(kelasId)) {
        set.status = 400;
        return { success: false, error: "ID kelas tidak valid" };
      }

      const kelasDetail = await getKelasDetail(kelasId)
      if (!kelasDetail) {
        set.status = 404;
        return { success: false, error: "Kelas tidak ditemukan" };
      }

      return {
        success: true,
        data: kelasDetail
      }
    } catch (error) {
      console.error("Error getting kelas detail:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .post('/kelas/:id/guru/tambah', async ({ params, body, set }) => {
    try {
      const kelasId = parseInt(params.id)
      if (isNaN(kelasId)) {
        set.status = 400;
        return { success: false, error: "ID kelas tidak valid" };
      }

      const { guru_id, mata_pelajaran } = body as any;
      if (!guru_id || !mata_pelajaran) {
        set.status = 400;
        return { success: false, error: "ID guru dan mata pelajaran harus diisi" };
      }

      const guru = await getUserById(guru_id)
      if (!guru || guru.role !== 'guru') {
        set.status = 404;
        return { success: false, error: "Guru tidak ditemukan" };
      }

      const kelas = await getKelasById(kelasId)
      if (!kelas) {
        set.status = 404;
        return { success: false, error: "Kelas tidak ditemukan" };
      }

      await addGuruToKelas(parseInt(guru_id), kelasId, mata_pelajaran.trim())

      return {
        success: true,
        message: 'Guru berhasil ditambahkan ke kelas'
      }
    } catch (error) {
      console.error("Error adding guru to kelas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .delete('/kelas/:id/guru/:guruId', async ({ params, body, set }) => {
    try {
      const kelasId = parseInt(params.id)
      const guruId = parseInt(params.guruId)

      if (isNaN(kelasId) || isNaN(guruId)) {
        set.status = 400;
        return { success: false, error: "ID tidak valid" };
      }

      const { mata_pelajaran } = body as any;

      const success = await removeGuruFromKelas(guruId, kelasId, mata_pelajaran)
      if (!success) {
        set.status = 404;
        return { success: false, error: "Guru tidak ditemukan di kelas ini" };
      }

      return {
        success: true,
        message: 'Guru berhasil dihapus dari kelas'
      }
    } catch (error) {
      console.error("Error removing guru from kelas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  // student management - organized by class
  .get('/siswa/per-kelas', async () => {
    try {
      const kelasList = await getKelas()
      const users = await getUsers()

      const siswaPerKelas = await Promise.all(
        kelasList.map(async kelas => {
          const siswaList = await getSiswaForKelas(kelas.id)
          const waliKelas = users.find(u => u.id === kelas.wali_kelas_id)
          const guruList = await getGuruForKelas(kelas.id)

          const siswaWithProgress = await Promise.all(
            siswaList.map(async siswa => {
              const progress = await getSiswaProgressInKelas(siswa.id, kelas.id)
              return {
                id: siswa.id,
                nama: siswa.nama,
                email: siswa.email,
                status: siswa.status,
                last_login: siswa.last_login,
                progress_summary: progress?.progress || null
              }
            })
          )

          return {
            kelas: {
              id: kelas.id,
              nama: kelas.nama,
              tingkat: kelas.tingkat,
              wali_kelas: waliKelas?.nama || "Tidak ditentukan"
            },
            guru_pengajar: guruList.map(g => ({
              id: g.id,
              nama: g.nama,
              bidang: g.bidang || "Tidak ditentukan",
              mata_pelajaran: (g as any).mata_pelajaran || "Tidak ditentukan"
            })),
            siswa_list: siswaWithProgress,
            statistik: {
              total_siswa: siswaWithProgress.length,
              siswa_aktif: siswaWithProgress.filter(s => s.status === 'active').length,
              avg_progress: siswaWithProgress.length > 0
                ? Math.round(
                  siswaWithProgress
                    .filter(s => s.progress_summary)
                    .reduce((sum, s) => sum + (s.progress_summary?.progress_tugas || 0), 0) /
                  siswaWithProgress.filter(s => s.progress_summary).length
                ) || 0
                : 0
            }
          }
        })
      )

      return {
        success: true,
        data: siswaPerKelas
      }
    } catch (error) {
      console.error("Error getting siswa per kelas:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat data siswa per kelas" };
    }
  })

  .get('/siswa/:siswaId/progress/:kelasId', async ({ params, set }) => {
    try {
      const siswaId = parseInt(params.siswaId)
      const kelasId = parseInt(params.kelasId)

      if (isNaN(siswaId) || isNaN(kelasId)) {
        set.status = 400;
        return { success: false, error: "ID tidak valid" };
      }

      const progressDetail = await getSiswaProgressInKelas(siswaId, kelasId);
      if (!progressDetail) {
        set.status = 404;
        return { success: false, error: "Data progress tidak ditemukan" };
      }

      return {
        success: true,
        data: progressDetail
      };
    } catch (error) {
      console.error("Error getting siswa progress detail:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .get("/siswa/daftar", async () => {
    try {
      const users = await getUsers();
      const daftarSiswa = await Promise.all(
        users
          .filter(u => u.role === "siswa")
          .map(async siswa => {
            const kelasSiswa = await getKelasForSiswa(siswa.id);
            const namaKelas = kelasSiswa.map(k => k.nama).join(", ") || "Belum ditentukan";

            return {
              id: siswa.id,
              nama: siswa.nama,
              email: siswa.email,
              kelas: namaKelas,
              status: siswa.status,
              last_login: siswa.last_login
            };
          })
      );

      return {
        success: true,
        data: daftarSiswa
      };
    } catch (error) {
      console.error("Error getting siswa list:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat daftar siswa" };
    }
  })

  .get("/siswa/tugas/:id", async ({ params, set }) => {
    try {
      const siswaId = parseInt(params.id);
      if (isNaN(siswaId)) {
        set.status = 400;
        return { success: false, error: "ID siswa tidak valid" };
      }

      const users = await getUsers();
      const siswa = users.find(u => u.id === siswaId && u.role === "siswa");
      if (!siswa) {
        set.status = 404;
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      const submissions = await getSubmissionForSiswa(siswaId) as any[];

      const tugasSiswa = await Promise.all(
        submissions.map(async submission => {
          const tugasResult = await query("SELECT * FROM tugas WHERE id = ?", [submission.tugas_id]) as any[];
          const tugasItem = tugasResult[0];

          const materiResult = await query("SELECT * FROM materi WHERE id = ?", [tugasItem?.materi_id]) as any[];
          const materiItem = materiResult[0];

          const kelasMateri = await getKelasForMateri(tugasItem?.materi_id || 0);

          return {
            id: submission.id,
            tugas: tugasItem?.judul || "Tugas tidak ditemukan",
            materi: materiItem?.judul || "Materi tidak ditemukan",
            kelas: kelasMateri.map(k => k.nama).join(", "),
            status: submission.status,
            nilai: submission.nilai,
            feedback: submission.feedback,
            submitted_at: submission.submitted_at,
            graded_at: submission.graded_at
          };
        })
      );

      return {
        success: true,
        data: tugasSiswa
      };
    } catch (error) {
      console.error("Error getting siswa tugas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .get("/materi/daftar", async () => {
    try {
      const materi = await getMateri();
      const users = await getUsers();

      const daftarMateri = await Promise.all(
        materi.map(async m => {
          const guruPengampu = users.find(u => u.id === m.guru_id);
          const kelasMateri = await getKelasForMateri(m.id);

          return {
            id: m.id,
            judul: m.judul,
            deskripsi: m.deskripsi,
            guru: guruPengampu?.nama || "Tidak diketahui",
            kelas: kelasMateri.map(k => k.nama).join(", ") || "Tidak diketahui",
            created_at: m.created_at
          };
        })
      );

      return {
        success: true,
        data: daftarMateri
      };
    } catch (error) {
      console.error("Error getting materi list:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat daftar materi" };
    }
  })

  .get("/kelas/diskusi-materi/:id", async ({ params, set }) => {
    try {
      const materiId = parseInt(params.id);
      if (isNaN(materiId)) {
        set.status = 400;
        return { success: false, error: "ID materi tidak valid" };
      }

      const materi = await getMateri();
      const materiItem = materi.find(m => m.id === materiId);
      if (!materiItem) {
        set.status = 404;
        return { success: false, error: "Materi tidak ditemukan" };
      }

      const diskusiMateri = await getDiskusiMateri();
      const users = await getUsers();

      const diskusiFiltered = diskusiMateri
        .filter(d => d.materi_id === materiId)
        .map(d => {
          const user = users.find(u => u.id === d.user_id);
          return {
            id: d.id,
            user: user?.nama || "Anonim",
            role: d.user_role,
            isi: d.isi,
            created_at: d.created_at
          };
        });

      return {
        success: true,
        data: diskusiFiltered
      };
    } catch (error) {
      console.error("Error getting diskusi materi:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .get("/kelas/diskusi", async () => {
    try {
      const diskusi = await getDiskusi();
      const users = await getUsers();

      const daftarDiskusi = diskusi.map(d => {
        const user = users.find(u => u.id === d.user_id);
        return {
          id: d.id,
          kelas: d.kelas,
          isi: d.isi.length > 100 ? d.isi.substring(0, 100) + "..." : d.isi,
          user: user?.nama || "Anonim",
          role: d.user_role,
          created_at: d.created_at
        };
      });

      return {
        success: true,
        data: daftarDiskusi
      };
    } catch (error) {
      console.error("Error getting diskusi:", error);
      return { success: false, error: "Terjadi kesalahan saat memuat diskusi" };
    }
  })

  .post("/kelas/diskusi", async ({ body, user, set }) => {
    try {
      const { kelas: namaKelas, isi } = body as any;

      if (!namaKelas || !isi) {
        set.status = 400;
        return { success: false, error: "Kelas dan isi diskusi harus diisi" };
      }

      if (isi.length < 5) {
        set.status = 400;
        return { success: false, error: "Isi diskusi terlalu pendek" };
      }

      const diskusiId = await createDiskusi(namaKelas.trim(), isi.trim(), user.id, user.role);

      return {
        success: true,
        message: "Diskusi berhasil ditambahkan",
        data: {
          id: diskusiId,
          kelas: namaKelas.trim(),
          isi: isi.trim()
        }
      };
    } catch (error) {
      console.error("Error adding diskusi:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .get("/kelas/:id/siswa", async ({ params, set }) => {
    try {
      const kelasId = parseInt(params.id);
      if (isNaN(kelasId)) {
        set.status = 400;
        return { success: false, error: "ID kelas tidak valid" };
      }

      const kelas = await getKelas();
      const kelasItem = kelas.find(k => k.id === kelasId);
      if (!kelasItem) {
        set.status = 404;
        return { success: false, error: "Kelas tidak ditemukan" };
      }

      const siswaKelas = await getSiswaForKelas(kelasId);
      const guruKelas = await getGuruForKelas(kelasId);

      return {
        success: true,
        data: {
          kelas: kelasItem,
          siswa: siswaKelas,
          guru: guruKelas
        }
      };
    } catch (error) {
      console.error("Error getting kelas siswa:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .post("/kelas/:id/siswa/tambah", async ({ params, body, set }) => {
    try {
      const kelasId = parseInt(params.id);
      if (isNaN(kelasId)) {
        set.status = 400;
        return { success: false, error: "ID kelas tidak valid" };
      }

      const { siswa_id } = body as any;
      if (!siswa_id) {
        set.status = 400;
        return { success: false, error: "ID siswa harus diisi" };
      }

      const kelasItem = await getKelasById(kelasId);
      if (!kelasItem) {
        set.status = 404;
        return { success: false, error: "Kelas tidak ditemukan" };
      }

      const siswa = await getUserById(parseInt(siswa_id));
      if (!siswa || siswa.role !== "siswa") {
        set.status = 404;
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      // Check if already enrolled
      const alreadyEnrolled = await isSiswaInKelas(siswa.id, kelasId);
      if (alreadyEnrolled) {
        set.status = 400;
        return { success: false, error: "Siswa sudah terdaftar di kelas ini" };
      }

      await addSiswaToKelas(siswa.id, kelasId);

      return {
        success: true,
        message: "Siswa berhasil ditambahkan ke kelas"
      };
    } catch (error) {
      console.error("Error adding siswa to kelas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  })

  .delete("/kelas/:id/siswa/:siswaId", async ({ params, set }) => {
    try {
      const kelasId = parseInt(params.id);
      const siswaId = parseInt(params.siswaId);

      if (isNaN(kelasId) || isNaN(siswaId)) {
        set.status = 400;
        return { success: false, error: "ID tidak valid" };
      }

      const kelasItem = await getKelasById(kelasId);
      if (!kelasItem) {
        set.status = 404;
        return { success: false, error: "Kelas tidak ditemukan" };
      }

      const siswa = await getUserById(siswaId);
      if (!siswa || siswa.role !== "siswa") {
        set.status = 404;
        return { success: false, error: "Siswa tidak ditemukan" };
      }

      // Remove from class using updated function
      const success = await removeSiswaFromKelas(siswaId, kelasId);
      if (!success) {
        set.status = 404;
        return { success: false, error: "Siswa tidak terdaftar di kelas ini" };
      }

      return {
        success: true,
        message: "Siswa berhasil dihapus dari kelas"
      };
    } catch (error) {
      console.error("Error removing siswa from kelas:", error);
      set.status = 500;
      return { success: false, error: "Terjadi kesalahan server" };
    }
  });