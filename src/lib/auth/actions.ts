"use server";

import { redirect } from "next/navigation";

import { getAuthActions } from "@/lib/auth/insforge-ssr";

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
