import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { getSessionClient } from "@/lib/auth/insforge-ssr";

/**
 * Data Access Layer untuk otorisasi admin (PRD FR-07 dan §10).
 *
 * Dokumentasi Next.js 16 menegaskan bahwa Proxy (dulu bernama Middleware)
 * "is not intended for full session management or authorization" dan hanya
 * layak untuk pemeriksaan optimistis. Batas keamanan yang sebenarnya ada di
 * sini: setiap pembacaan dan penulisan data admin WAJIB melewati
 * `requireAdmin()`.
 *
 * Konsekuensi praktisnya, dan ini yang diminta FR-07: menyembunyikan tombol
 * atau mengalihkan halaman di proxy bukan pengamanan. Kalau seseorang memanggil
 * Server Action atau Route Handler admin secara langsung tanpa sesi, yang
 * menolaknya adalah fungsi di bawah, bukan tampilan.
 *
 * `cache()` dari React membuat pemeriksaan ini dijalankan sekali saja per
 * render, walau dipanggil dari banyak komponen. Itu penting karena setiap
 * pemanggilan menyentuh jaringan dua kali (verifikasi token dan pengecekan
 * daftar admin).
 */

export type AdminSession = {
  userId: string;
  email: string;
};

/**
 * Membaca sesi dari cookie dan memastikan tokennya benar-benar sah menurut
 * backend, bukan sekadar ada. Mengembalikan `null` kalau tidak ada sesi valid.
 */
export const getSession = cache(async (): Promise<AdminSession | null> => {
  const client = await getSessionClient();
  const { data, error } = await client.auth.getCurrentUser();

  const user = data?.user;
  if (error || !user?.id) return null;

  return { userId: user.id, email: String(user.email ?? "") };
});

/**
 * Apakah pemilik sesi terdaftar sebagai admin.
 *
 * Pengecekan memakai kunci admin server (melewati RLS) karena tabel
 * `admin_users` memang tidak boleh terbaca oleh klien mana pun. Tidak ada
 * jalur di mana browser menanyakan "apakah saya admin" dan dipercaya
 * jawabannya.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await getInsforgeAdminClient()
    .database.from("admin_users")
    .select("user_id")
    .eq("user_id", session.userId)
    .limit(1);

  if (error) {
    // Gagal memeriksa berarti TIDAK berwenang. Jangan pernah membuka akses
    // hanya karena pengecekannya bermasalah.
    console.error("[auth] gagal memeriksa daftar admin:", error);
    return null;
  }

  return (data ?? []).length > 0 ? session : null;
});

/**
 * Gerbang untuk halaman dan aksi admin. Mengalihkan ke halaman masuk bila
 * tidak berwenang, dan tidak pernah mengembalikan sesi setengah valid.
 *
 * Pengguna yang sudah masuk tetapi bukan admin dialihkan dengan alasan berbeda,
 * supaya mereka tahu akunnya dikenali tetapi tidak diberi akses, bukan mengira
 * kata sandinya salah.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login?alasan=bukan-admin");

  return admin;
}

/**
 * Versi untuk Route Handler: mengembalikan sesi atau `null`, tanpa redirect,
 * sehingga pemanggil bisa membalas 401/403 sesuai konteks API.
 */
export async function getAdminOrNull(): Promise<AdminSession | null> {
  return getAdminSession();
}
