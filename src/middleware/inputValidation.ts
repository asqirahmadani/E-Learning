import { Elysia } from "elysia";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid").min(5).max(100),
  password: z.string().min(6, "Password minimal 6 karakter").max(100)
});

export const registerSchema = z.object({
  nama: z.string().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().email("Email tidak valid").min(5).max(100),
  password: z.string().min(6, "Password minimal 6 karakter").max(100),
  confirmPassword: z.string().min(6, "Konfirmasi password minimal 6 karakter").max(100),
  kelas_id: z.coerce.number().int().positive("Pilih kelas yang valid").optional(),
});

export const addGuruSchema = z.object({
  nama: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  bidang: z.string().min(3)
});

export const updateUserStatusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["active", "inactive"])
});

export const inputValidation = new Elysia().derive(async ({ request }) => {
  async function parseFormData() {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const fd = await request.formData();
      return Object.fromEntries(fd.entries());
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      return Object.fromEntries(new URLSearchParams(text).entries());
    } else if (ct.includes("application/json")) {
      return await request.json();
    }
    return {};
  }
  return { parseFormData };
});
