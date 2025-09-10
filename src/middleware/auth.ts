import type { Context } from "elysia";
import { verifySession } from "../utils/session";
import { users } from "../db";

export async function authMiddleware({ cookie, set, request }: Context) {
  const token = cookie?.session?.value;
  if (!token) {
    return { user: null };
  }

  const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
  const data = verifySession(token, secret);
  if (!data) {
    if (cookie?.session) cookie.session.set({ value: "", maxAge: 0 });
    return { user: null };
  }
  
  const userData = users.find(u => u.id === data.userId);
  
  if (!userData) {
    if (cookie?.session) cookie.session.set({ value: "", maxAge: 0 });
    return { user: null };
  }
  
  return { 
    user: {
      userId: data.userId,
      nama: userData.nama,
      email: userData.email,
      role: data.role,
      bidang: userData.bidang
    } 
  };
}