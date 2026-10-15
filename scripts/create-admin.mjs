/**
 * Membuat akun admin CekHarga (PRD FR-07).
 *
 * Dipisah menjadi skrip, bukan halaman pendaftaran, dengan alasan sederhana:
 * halaman "daftar jadi admin" yang bisa diakses publik adalah pintu belakang.
 * Pemberian akses admin harus dilakukan orang yang sudah memegang kunci server.
 *
 * Skrip ini melakukan dua hal terpisah yang sama pentingnya:
 *   1. Membuat akun di InsForge Auth (langsung terverifikasi).
 *   2. Mendaftarkannya ke tabel admin_users.
 * Akun tanpa langkah kedua tetap tidak punya akses apa pun.
 *
 * Pemakaian:
 *   node scripts/create-admin.mjs email@contoh.com
 *
 * Kata sandi diketik saat diminta (tidak tampil di layar), bukan dioper sebagai
 * argumen, supaya tidak tersimpan di riwayat terminal maupun berkas mana pun.
 */

import fs from "node:fs";
import readline from "node:readline";
import { createAdminClient } from "@insforge/sdk";

const MIN_LENGTH = 12;

const [email, ...rest] = process.argv.slice(2);

if (!email || rest.length > 0) {
  console.error("Pemakaian: node scripts/create-admin.mjs <email>");
  if (rest.length > 0) console.error("Kata sandi tidak lagi dioper lewat argumen; ketik saat diminta.");
  process.exit(1);
}

/** Bertanya di terminal tanpa menampilkan ketikan. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

const password = await askHidden(`Kata sandi untuk ${email} (minimal ${MIN_LENGTH} karakter): `);
if (password.length < MIN_LENGTH) {
  console.error(`Kata sandi minimal ${MIN_LENGTH} karakter.`);
  process.exit(1);
}
if ((await askHidden("Ulangi kata sandi: ")) !== password) {
  console.error("Kedua kata sandi tidak sama.");
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(".insforge/project.json", "utf8"));
const BASE = cfg.oss_host;
const KEY = cfg.api_key;

const api = (path, init = {}) =>
  fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

// 1. Buat akun kalau belum ada. autoConfirm melewati verifikasi email, dan itu
//    hanya boleh karena pemanggilnya memegang kunci admin proyek.
const created = await api("/api/auth/users", {
  method: "POST",
  body: JSON.stringify({ email, password, autoConfirm: true }),
});

if (!created.ok) {
  const detail = await created.text();
  // Akun yang sudah ada bukan kegagalan; lanjut ke pemberian akses.
  if (!detail.includes("already") && !detail.includes("exists")) {
    console.error("Gagal membuat akun:", created.status, detail.slice(0, 200));
    process.exit(1);
  }
  console.log("Akun sudah ada, lanjut memberi akses.");
} else {
  console.log("Akun dibuat.");
}

// 2. Ambil id pengguna.
const listed = await api(`/api/auth/users?search=${encodeURIComponent(email)}`);
const payload = await listed.json();
const rows = payload.data ?? payload.users ?? payload;
const user = (Array.isArray(rows) ? rows : []).find((u) => u.email === email);

if (!user) {
  console.error("Akun tidak ditemukan setelah dibuat. Periksa dashboard InsForge.");
  process.exit(1);
}

// 3. Daftarkan ke allowlist admin.
const db = createAdminClient({ baseUrl: BASE, apiKey: KEY }).database;
const existing = await db
  .from("admin_users")
  .select("user_id")
  .eq("user_id", user.id)
  .limit(1);

if ((existing.data ?? []).length > 0) {
  console.log(`${email} sudah terdaftar sebagai admin.`);
} else {
  const granted = await db
    .from("admin_users")
    .insert([{ user_id: user.id, email, note: "dibuat lewat scripts/create-admin.mjs" }]);
  if (granted.error) {
    console.error("Gagal memberi akses admin:", granted.error);
    process.exit(1);
  }
  console.log(`${email} sekarang admin.`);
}

console.log("Masuk lewat /admin/login");
