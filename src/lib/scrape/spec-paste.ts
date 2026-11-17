import { GSMARENA_PATH } from "@/lib/scrape/parsers";

/**
 * Salin spesifikasi (14 November 2026): cadangan saat GSMArena membatasi
 * akses tarik otomatis.
 *
 * Admin membuka halaman model GSMArena di browsernya sendiri dan menjalankan
 * bookmarklet (spec-helper.ts). Bookmarklet menyalin teks berformat:
 *
 *   CEKHARGA-SPEK/1
 *   motorola_moto_g86_power-13955.php
 *   <div id="body">…</div>
 *
 * Teks itu ditempel di tab Tarik otomatis. Server mengurainya dengan parser
 * GSMArena yang sama dengan tarik otomatis; tidak ada permintaan dari server
 * ke GSMArena (aturan system design 3). Bila GSMArena menampilkan pemeriksaan,
 * admin menyelesaikannya sebagai pengunjung biasa: tidak ada yang ditembus.
 *
 * Teks tempelan TIDAK dipercaya: header, path, ukuran, dan penanda halaman
 * spesifikasi diperiksa, dan HTML-nya hanya diurai dengan regex parser,
 * tidak pernah dirender.
 */

export const SPEC_PASTE_HEADER = "CEKHARGA-SPEK/1";
/** Bagian #body halaman model ±20–60 KB; batas longgar tapi tetap menahan tempelan raksasa. */
export const SPEC_PASTE_MAX_CHARS = 400_000;

export type SpecPaste = { path: string; html: string; modelName: string };

export function parseSpecPaste(text: string): { ok: true; paste: SpecPaste } | { ok: false; error: string } {
  const raw = text.replace(/^﻿/, "").trim();
  if (!raw) return { ok: false, error: "Tempel dulu hasil salinan dari bookmarklet." };
  if (raw.length > SPEC_PASTE_MAX_CHARS) {
    return { ok: false, error: "Tempelan terlalu besar. Salin ulang dengan bookmarklet dari halaman model GSMArena." };
  }

  const firstBreak = raw.indexOf("\n");
  const secondBreak = firstBreak < 0 ? -1 : raw.indexOf("\n", firstBreak + 1);
  if (firstBreak < 0 || secondBreak < 0 || raw.slice(0, firstBreak).trim() !== SPEC_PASTE_HEADER) {
    return {
      ok: false,
      error: "Ini bukan salinan dari bookmarklet Salin spesifikasi. Jalankan bookmarklet di halaman model GSMArena, lalu tempel lagi.",
    };
  }

  const path = raw.slice(firstBreak + 1, secondBreak).trim();
  if (!GSMARENA_PATH.test(path)) {
    return { ok: false, error: "Alamat halaman GSMArena di salinan tidak valid. Pastikan bookmarklet dijalankan di halaman spesifikasi satu model." };
  }

  const html = raw.slice(secondBreak + 1);
  const title = html.match(/data-spec="modelname"[^>]*>([\s\S]*?)<\/h1>/);
  if (!title || !/id="specs-list"/.test(html)) {
    return { ok: false, error: "Salinan tidak berisi tabel spesifikasi GSMArena. Buka halaman spesifikasi model (bukan daftar atau berita), lalu salin ulang." };
  }
  const modelName = title[1].replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  if (!modelName) return { ok: false, error: "Nama model tidak terbaca dari salinan." };

  return { ok: true, paste: { path, html, modelName } };
}
