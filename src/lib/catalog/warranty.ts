/**
 * Teks garansi penawaran (PB-27). Modul murni, dipakai impor dan tampilan.
 *
 * Toko menulis garansi dengan banyak cara ("Resmi SEIN 1 thn", "garansi
 * resmi indonesia", "Inter", "Garansi toko 7 hari"). Saat impor, teks yang
 * jelas maknanya dibakukan ke label tetap beserta durasinya, supaya filter
 * "hanya garansi resmi" di halaman produk bisa diandalkan. Teks yang tidak
 * jelas disimpan apa adanya dan TIDAK dihitung sebagai garansi resmi.
 */

const WARRANTY_LABELS = {
  official: "Garansi resmi Indonesia",
  distributor: "Garansi distributor",
  store: "Garansi toko",
  international: "Tanpa garansi resmi (internasional)",
} as const;

const INTERNATIONAL = /\b(inter|internasional|international|global|ex[- ]?inter|tanpa garansi|no warranty|bukan resmi)\b/i;
const OFFICIAL = /\b(resmi|official|sein|tam|ibox|erajaya|digimap|garansi (indonesia|nasional))\b/i;
const DISTRIBUTOR = /\bdistributor\b/i;
const STORE = /\b(toko|seller|store)\b/i;

function duration(text: string): string | null {
  const match = text.match(/(\d{1,2})\s*(tahun|thn|th|bulan|bln|bl|hari)\b/i);
  if (!match) return null;
  const unit = /^(tahun|thn|th)$/i.test(match[2]!) ? "tahun" : /^(bulan|bln|bl)$/i.test(match[2]!) ? "bulan" : "hari";
  return `${Number(match[1])} ${unit}`;
}

/** Teks garansi baku; null bila kosong. Urutan cek penting: "bukan resmi" bukan resmi. */
export function normalizeWarranty(raw: string | null | undefined): string | null {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text || text === "-") return null;
  const label = INTERNATIONAL.test(text)
    ? WARRANTY_LABELS.international
    : OFFICIAL.test(text)
      ? WARRANTY_LABELS.official
      : DISTRIBUTOR.test(text)
        ? WARRANTY_LABELS.distributor
        : STORE.test(text)
          ? WARRANTY_LABELS.store
          : null;
  if (!label) return text.slice(0, 120);
  const length = label === WARRANTY_LABELS.international ? null : duration(text);
  return length ? `${label}, ${length}` : label;
}

export function isOfficialWarranty(warranty: string | null | undefined): boolean {
  return Boolean(warranty && warranty.startsWith(WARRANTY_LABELS.official));
}
