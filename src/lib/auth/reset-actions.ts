"use server";

import { redirect } from "next/navigation";

import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/**
 * Lupa kata sandi admin (PB-48, 11 November 2026).
 *
 * Alurnya sama dengan `scripts/ganti-sandi-admin.mjs` (PB-11), tetapi lewat
 * browser: InsForge mengirim kode 6 digit ke email akun (metode `code` di
 * konfigurasi auth proyek), kode ditukar menjadi token reset, lalu token
 * dipakai menyimpan kata sandi baru. Hanya pemilik kotak masuk yang bisa
 * menyelesaikannya, dan kata sandi tidak pernah lewat chat atau berkas.
 *
 * - Pesan langkah 1 seragam, terdaftar atau tidak, supaya halaman publik ini
 *   tidak bisa dipakai menebak email staf.
 * - Rate limit per IP + email dan per instance (aturan 1 dan 7 berlaku juga di
 *   sini: kode 6 digit tidak boleh bisa ditebak cepat). Batas ini di memori
 *   proses, jadi di banyak instance hanya meredam; InsForge punya batasnya
 *   sendiri untuk kode reset.
 * - Setiap panggilan ke InsForge memakai batas waktu dan TIDAK diulang, karena
 *   semuanya mengubah keadaan (mengirim email, memakai kode).
 */

const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;
const TIMEOUT_MS = 15_000;

const sendLimiter = createRateLimiter({ limit: 3, windowMs: 15 * 60_000 });
const verifyLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });
const globalLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export type ResetState = {
  step: "email" | "code";
  email: string;
  /** Kode yang terakhir dikirim, supaya kolomnya tidak kosong setelah error (React mereset form). */
  code?: string;
  error: string | null;
  notice: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function limited(key: string, limiter: ReturnType<typeof createRateLimiter>): Promise<string | null> {
  const own = limiter.check(`${await clientIp()}|${key}`);
  const result = own.allowed ? globalLimiter.check("global") : own;
  return result.allowed ? null : `Terlalu banyak percobaan. Coba lagi dalam ${result.retryAfterSec} detik.`;
}

/** POST ke endpoint auth InsForge dengan kunci anon; tidak pernah diulang. */
async function postAuth(path: string, body: Record<string, string>): Promise<{ ok: boolean; data: Record<string, unknown> | null }> {
  const base = process.env.INSFORGE_URL;
  const anon = process.env.INSFORGE_ANON_KEY;
  if (!base || !anon) throw new Error("INSFORGE_URL atau INSFORGE_ANON_KEY belum diisi.");
  try {
    const response = await fetch(new URL(path, base), {
      method: "POST",
      headers: { Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: response.ok, data };
  } catch (error) {
    console.error("[auth] permintaan reset kata sandi gagal:", path, error instanceof Error ? error.message : error);
    return { ok: false, data: null };
  }
}

/** Langkah 1: kirim kode ke email. */
export async function requestResetCodeAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const base: ResetState = { step: "email", email, error: null, notice: null };
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return { ...base, error: "Tulis alamat email yang valid." };

  const blocked = await limited(`send|${email}`, sendLimiter);
  if (blocked) return { ...base, error: blocked };

  const sent = await postAuth("/api/auth/email/send-reset-password", { email });
  if (!sent.ok && sent.data === null) {
    return { ...base, error: "Layanan akun sedang tidak bisa dihubungi. Coba lagi beberapa menit lagi." };
  }
  // Jawaban sama untuk email terdaftar maupun tidak.
  return {
    step: "code",
    email,
    error: null,
    notice: `Bila ${email} terdaftar, kode 6 digit sudah dikirim ke sana. Cek juga folder spam.`,
  };
}

/** Langkah 2: tukar kode, lalu simpan kata sandi baru. */
export async function completeResetAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");
  const base: ResetState = { step: "code", email, code: code.slice(0, 6), error: null, notice: null };

  if (!EMAIL_PATTERN.test(email)) return { ...base, error: "Email tidak terbaca. Muat ulang halaman lalu mulai lagi." };
  if (!/^\d{6}$/.test(code)) return { ...base, error: "Kode terdiri dari 6 angka." };
  if (password.length < PASSWORD_MIN) return { ...base, error: `Kata sandi baru minimal ${PASSWORD_MIN} karakter.` };
  if (password.length > PASSWORD_MAX) return { ...base, error: `Kata sandi baru maksimal ${PASSWORD_MAX} karakter.` };
  if (password !== repeat) return { ...base, error: "Kedua kata sandi tidak sama." };

  const blocked = await limited(`verify|${email}`, verifyLimiter);
  if (blocked) return { ...base, error: blocked };

  const exchanged = await postAuth("/api/auth/email/exchange-reset-password-token", { email, code });
  const token = typeof exchanged.data?.token === "string" ? exchanged.data.token : null;
  if (!exchanged.ok || !token) return { ...base, error: "Kode salah atau sudah kedaluwarsa. Minta kode baru bila perlu." };

  const reset = await postAuth("/api/auth/email/reset-password", { newPassword: password, otp: token });
  if (!reset.ok) {
    return { ...base, error: "Kata sandi belum tersimpan. Minta kode baru lalu coba lagi." };
  }

  redirect("/admin/login?alasan=sandi-diganti");
}
