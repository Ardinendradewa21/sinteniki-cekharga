"use server";

import { redirect } from "next/navigation";

import { getAuthActions } from "@/lib/auth/insforge-ssr";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/** Percobaan masuk per kombinasi IP + email, dan total per instance. */
const loginPerClientLimiter = createRateLimiter({ limit: 5, windowMs: 5 * 60_000 });
const loginGlobalLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

/**
 * Aksi masuk dan keluar (PRD FR-07).
 *
 * Keduanya berjalan di server karena hanya di sanalah cookie sesi boleh
 * ditulis. Yang dikembalikan hanya pesan yang aman ditampilkan; objek auth
 * mentah beserta tokennya tidak pernah dikirim ke klien.
 *
 * Pesan gagal sengaja seragam untuk email salah maupun kata sandi salah.
 * Membedakan keduanya memberi tahu penyerang bahwa sebuah email terdaftar.
 */

export type SignInState = { error: string | null };

export async function signInAction(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email dan kata sandi wajib diisi." };
  }

  // Dicek sebelum menyentuh backend auth, supaya tebak-tebakan kata sandi
  // tidak bisa dilakukan secepat jaringan mengizinkan.
  const limited =
    loginPerClientLimiter.check(`${await clientIp()}|${email.toLowerCase()}`);
  const allowed = limited.allowed ? loginGlobalLimiter.check("global") : limited;
  if (!allowed.allowed) {
    return {
      error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${allowed.retryAfterSec} detik.`,
    };
  }

  const auth = await getAuthActions();
  const { data, error } = await auth.signInWithPassword({ email, password });

  if (error || !data?.user) {
    return { error: "Email atau kata sandi tidak cocok." };
  }

  redirect("/admin");
}

export async function signOutAction() {
  const auth = await getAuthActions();
  await auth.signOut();
  redirect("/admin/login");
}
