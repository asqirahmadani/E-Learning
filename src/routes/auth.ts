import { Elysia } from "elysia";
import ejs from "ejs";
import { getUsers, loginAttempts, getKelas, query } from "../db";
import { verifyPassword, hashPassword } from "../utils/hash";
import { signSession } from "../utils/session";
import { loginSchema, registerSchema, inputValidation } from "../middleware/inputValidation";
import type { Role } from "../db";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

const view = (tpl: string, data: Record<string, any> = {}) =>
  ejs.render(tpl, data, { rmWhitespace: true });

export const authRoutes = new Elysia()
  .use(inputValidation)

  .get("/login", async ({ set, query }) => {
    const fs = await Bun.file("views/login.ejs").text();
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return view(fs, {
      error: query.error ?? "",
      message: query.message ?? ""
    });
  })

  .get("/register", async ({ set, query }) => {
    const fs = await Bun.file("views/register.ejs").text();
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return view(fs, {
      error: query.error ?? "",
      message: query.message ?? "",
      formData: query.formData ? JSON.parse(query.formData) : {}
    });
  })

  .get('/register-guru', async ({ set, query }) => {
    const fs = await Bun.file("views/register-guru.ejs").text();
    set.headers["Content-Type"] = "text/html; charset=utf-8";
    return view(fs, {
      error: query.error ?? "",
      message: query.message ?? "",
      formData: query.formData ? JSON.parse(query.formData) : {}
    });
  })

  .get('/kelas', async ({ set }) => {
    try {
      const kelasData = await getKelas();
      return {
        success: true,
        data: kelasData
      }
    } catch (error) {
      console.error("Error fetching kelas:", error);
      set.status = 500;
      return {
        success: false,
        error: "Gagal memuat data kelas"
      }
    }
  })

  .post("/register", async ({ request, set }) => {
    const formData = await request.formData();
    const body: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      body[key] = String(value);
    }

    // Basic validation for student registration
    const requiredFields = ['nama', 'email', 'password', 'confirmPassword'];
    const missingFields = requiredFields.filter(field => !body[field] || !body[field].trim());

    if (missingFields.length > 0) {
      set.status = 302;
      set.headers.Location = `/register?error=${encodeURIComponent("Mohon lengkapi semua field yang diperlukan")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }

    const { email, password, nama, confirmPassword, kelas_id } = body;

    if (password !== confirmPassword) {
      set.status = 302;
      set.headers.Location = `/register?error=${encodeURIComponent("Password dan konfirmasi password tidak cocok")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      set.status = 302;
      set.headers.Location = `/register?error=${encodeURIComponent("Format email tidak valid")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }

    const users = await getUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      set.status = 302;
      set.headers.Location = `/register?error=${encodeURIComponent("Email sudah terdaftar")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }

    // Validate class exists if provided
    if (kelas_id && kelas_id.trim()) {
      const kelasExists = await query("SELECT id FROM kelas WHERE id = ?", [parseInt(kelas_id)]);
      if ((kelasExists as any[]).length === 0) {
        set.status = 302;
        set.headers.Location = `/register?error=${encodeURIComponent("Kelas yang dipilih tidak valid")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
        return;
      }
    }

    try {
      const passwordHash = await hashPassword(password);
      const now = new Date();

      // Create user
      const result = await query(
        `INSERT INTO users (nama, email, password_hash, role, status, created_at, last_login, login_count, last_activity) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nama.trim(),
          email.toLowerCase().trim(),
          passwordHash,
          "siswa",
          "active",
          now,
          now,
          0,
          now
        ]
      );

      const userId = (result as any).insertId;

      // Add student to selected class if provided
      if (kelas_id && kelas_id.trim()) {
        await query(
          `INSERT INTO siswa_kelas (siswa_id, kelas_id, created_at) 
           VALUES (?, ?, ?)`,
          [userId, parseInt(kelas_id), now]
        );
      }

      set.status = 302;
      set.headers.Location = "/login?message=Registrasi berhasil. Silakan login.";
      return;

    } catch (error) {
      console.error("Registration error:", error);
      set.status = 500;
      set.headers.Location = `/register?error=${encodeURIComponent("Terjadi kesalahan server")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }
  })

  .post("/register-guru", async ({ request, set }) => {
    const formData = await request.formData();
    const body: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      if (key === 'kelas_ids') {
        // Handle multiple class selection
        if (!body[key]) body[key] = '';
        body[key] += (body[key] ? ',' : '') + String(value);
      } else {
        body[key] = String(value);
      }
    }

    // Basic validation for teacher registration
    const requiredFields = ['nama', 'email', 'password', 'confirmPassword', 'bidang'];
    const missingFields = requiredFields.filter(field => !body[field] || !body[field].trim());

    if (missingFields.length > 0) {
      set.status = 302;
      set.headers.Location = `/register-guru?error=${encodeURIComponent("Mohon lengkapi semua field yang diperlukan")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }

    const { email, password, nama, confirmPassword, bidang, kelas_ids, wali_kelas_id } = body;

    if (password !== confirmPassword) {
      set.status = 302;
      set.headers.Location = `/register-guru?error=${encodeURIComponent("Password dan konfirmasi password tidak cocok")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      set.status = 302;
      set.headers.Location = `/register-guru?error=${encodeURIComponent("Format email tidak valid")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }

    const users = await getUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      set.status = 302;
      set.headers.Location = `/register-guru?error=${encodeURIComponent("Email sudah terdaftar")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }

    try {
      const passwordHash = await hashPassword(password);
      const now = new Date();

      // Create teacher user
      const result = await query(
        `INSERT INTO users (nama, email, password_hash, role, status, created_at, last_login, login_count, last_activity, bidang) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nama.trim(),
          email.toLowerCase().trim(),
          passwordHash,
          "guru",
          "active",
          now,
          now,
          0,
          now,
          bidang.trim()
        ]
      );

      const guruId = (result as any).insertId;

      // Handle class assignments if provided
      if (kelas_ids && kelas_ids.trim()) {
        const kelasIdArray = kelas_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

        for (const kelasId of kelasIdArray) {
          // Verify class exists
          const kelasExists = await query("SELECT id FROM kelas WHERE id = ?", [kelasId]);
          if ((kelasExists as any[]).length > 0) {
            // Add guru to class with their bidang as mata_pelajaran
            await query(
              `INSERT INTO guru_kelas (guru_id, kelas_id, mata_pelajaran) 
               VALUES (?, ?, ?)`,
              [guruId, kelasId, bidang.trim()]
            );
          }
        }
      }

      // Handle wali kelas assignment if provided
      if (wali_kelas_id && wali_kelas_id.trim()) {
        const waliKelasId = parseInt(wali_kelas_id);
        if (!isNaN(waliKelasId)) {
          // Update the class to set this teacher as wali kelas
          await query(
            `UPDATE kelas SET wali_kelas_id = ? WHERE id = ?`,
            [guruId, waliKelasId]
          );
        }
      }

      set.status = 302;
      set.headers.Location = "/login?message=Registrasi guru berhasil. Silakan login.";
      return;

    } catch (error) {
      console.error("Teacher registration error:", error);
      set.status = 500;
      set.headers.Location = `/register-guru?error=${encodeURIComponent("Terjadi kesalahan server")}&formData=${encodeURIComponent(JSON.stringify(body))}`;
      return;
    }
  })

  .post("/login", async ({ request, set, cookie }) => {
    const formData = await request.formData();
    const body: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      body[key] = String(value);
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return parsed.error.issues.map((i) => i.message).join(", ");
    }

    const email = String(parsed.data.email).toLowerCase().trim();
    const password = String(parsed.data.password);
    const key = `login:${email}`;
    const now = Date.now();
    const bucket = loginAttempts.get(key);

    if (bucket && now < bucket.unlockTime) {
      set.status = 429;
      const sisa = Math.ceil((bucket.unlockTime - now) / 1000);
      return `Akun dikunci sementara. Coba lagi dalam ${sisa} detik.`;
    }

    const users = await getUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === email && u.status === "active"
    );
    if (!user) {
      hit();
      set.status = 401;
      return "Email atau password salah.";
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      hit();
      set.status = 401;
      return "Email atau password salah.";
    }

    loginAttempts.delete(key);


    const { query } = await import("../db");
    await query(
      "UPDATE users SET last_login = ?, login_count = login_count + 1 WHERE id = ?",
      [new Date(), user.id]
    );

    user.last_login = new Date();

    const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
    const token = signSession(
      { userId: user.id, role: user.role, issuedAt: Math.floor(now / 1000) },
      secret
    );

    cookie.session.set({
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 60 * 60 * 8
    });

    set.status = 302;
    set.headers.Location = "/dashboard";
    return;

    function hit() {
      if (!bucket || now > bucket.unlockTime) {
        loginAttempts.set(key, { count: 1, unlockTime: 0 });
      } else {
        bucket.count++;
        if (bucket.count >= MAX_ATTEMPTS) {
          bucket.unlockTime = now + LOCK_MINUTES * 60_000;
          bucket.count = 0;
        }
        loginAttempts.set(key, bucket);
      }
    }
  })

  .post("/logout", ({ set, cookie }) => {
    if (cookie.session) cookie.session.set({ value: "", maxAge: 0 });
    set.status = 302;
    set.headers.Location = "/login?message=Berhasil logout";
  });