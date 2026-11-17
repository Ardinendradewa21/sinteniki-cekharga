import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Tiket tahap tulis Tanya AI (VD-08 lanjutan). Modul murni (rahasia dari
 * pemanggil) supaya bisa diuji.
 *
 * Giliran pencarian dan pertanyaan produk dibagi dua tahap: tahap 1
 * (pemahaman + data) langsung menampilkan kartu, tahap 2 menulis penjelasan.
 * Tahap 2 tidak memakai kuota harian lagi, jadi harus dibuktikan berasal dari
 * tahap 1 yang sudah membayar kuota: tiket ini ditandatangani HMAC, berlaku
 * 2 menit, sekali pakai (dicatat pemanggil), dan terikat pada kebutuhan yang
 * dipakai mencari (hash) serta pesan pengguna.
 */

export type WriteKind = "hasil" | "produk";

export type WriteTicket = {
  kind: WriteKind;
  /** Produk yang ditanyakan (mode produk). */
  slugs: string[];
  /** Pesan pengguna giliran ini. */
  text: string;
  /** Hash kebutuhan tercatat saat tahap 1. */
  needsHash: string;
  nonce: string;
  expiresAt: number;
};

export const WRITE_TICKET_TTL_MS = 2 * 60 * 1000;

export function hashNeeds(collected: unknown): string {
  return createHash("sha256").update(JSON.stringify(collected)).digest("hex").slice(0, 32);
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(`ai-write:${body}`).digest("base64url");
}

export function signWriteTicket(
  input: Pick<WriteTicket, "kind" | "slugs" | "text" | "needsHash">,
  secret: string,
  now = Date.now()
): string {
  const ticket: WriteTicket = { ...input, nonce: randomUUID(), expiresAt: now + WRITE_TICKET_TTL_MS };
  const body = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifyWriteTicket(token: string, secret: string, now = Date.now()): WriteTicket | null {
  if (typeof token !== "string" || token.length > 4000) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const ticket = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as WriteTicket;
    if (ticket.kind !== "hasil" && ticket.kind !== "produk") return null;
    if (!Array.isArray(ticket.slugs) || typeof ticket.text !== "string" || typeof ticket.needsHash !== "string") return null;
    if (typeof ticket.expiresAt !== "number" || ticket.expiresAt < now) return null;
    return ticket;
  } catch {
    return null;
  }
}
