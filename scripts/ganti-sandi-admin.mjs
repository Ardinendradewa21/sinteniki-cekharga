/**
 * Mengganti kata sandi akun admin CekHarga (PB-11).
 *
 * Memakai alur reset kata sandi InsForge dengan metode `code` (konfigurasi
 * proyek saat ini): InsForge mengirim kode 6 digit ke email akun, kode itu
 * ditukar menjadi token reset, lalu token dipakai untuk menyimpan kata sandi
 * baru. Hanya pemilik kotak masuk email yang bisa menyelesaikannya.
 *
 * Kode dan kata sandi diketik saat diminta (kata sandi tidak tampil di layar),
 * bukan dioper sebagai argumen, supaya tidak tersimpan di riwayat terminal.
 *
 * Pemakaian:
 *   node --env-file=.env.local scripts/ganti-sandi-admin.mjs email@contoh.com
 */

import readline from "node:readline";

const MIN_LENGTH = 12;

const [email] = process.argv.slice(2);
if (!email) {
  console.error("Pemakaian: node --env-file=.env.local scripts/ganti-sandi-admin.mjs <email>");
  process.exit(1);
}

const BASE = process.env.INSFORGE_URL;
const ANON = process.env.INSFORGE_ANON_KEY;
if (!BASE || !ANON) {
  console.error("INSFORGE_URL dan INSFORGE_ANON_KEY wajib ada di .env.local.");
  process.exit(1);
}

async function post(path, body) {
  const response = await fetch(new URL(path, BASE), {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text.slice(0, 200) };
  }
  if (!response.ok) {
    const message = data?.message ?? data?.error ?? `HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return data;
}

/** Bertanya di terminal; `hidden` menyembunyikan ketikan (untuk kata sandi). */
function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

try {
  await post("/api/auth/email/send-reset-password", { email });
  console.log(`Bila email terdaftar, kode 6 digit sudah dikirim ke ${email}. Cek juga folder spam.`);

  const code = await ask("Kode dari email: ");
  if (!/^\d{6}$/.test(code)) throw new Error("Kode harus 6 digit angka.");
  const exchanged = await post("/api/auth/email/exchange-reset-password-token", { email, code });
  if (!exchanged?.token) throw new Error("Kode salah atau kedaluwarsa.");

  const password = await ask(`Kata sandi baru (minimal ${MIN_LENGTH} karakter): `, { hidden: true });
  if (password.length < MIN_LENGTH) throw new Error(`Kata sandi minimal ${MIN_LENGTH} karakter.`);
  const repeat = await ask("Ulangi kata sandi baru: ", { hidden: true });
  if (repeat !== password) throw new Error("Kedua kata sandi tidak sama.");

  await post("/api/auth/email/reset-password", { newPassword: password, otp: exchanged.token });
  console.log("Kata sandi berhasil diganti. Keluar dari admin lalu masuk lagi dengan kata sandi baru.");
} catch (error) {
  console.error("Gagal:", error instanceof Error ? error.message : error);
  process.exit(1);
}
