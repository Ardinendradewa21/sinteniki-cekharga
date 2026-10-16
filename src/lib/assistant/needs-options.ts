/**
 * Pilihan kebutuhan konsultasi (PRD FR-06) beserta labelnya. Modul ini
 * sengaja tanpa zod karena dipakai komponen klien; validasi URL tetap di
 * needs.ts.
 */

export const ACTIVITIES = [
  "sosial-media",
  "foto",
  "game",
  "kerja",
  "baterai",
] as const;

export const ACTIVITY_LABELS: Record<(typeof ACTIVITIES)[number], string> = {
  "sosial-media": "Media sosial dan pesan",
  foto: "Foto dan video",
  game: "Main game",
  kerja: "Kerja dan multitasking",
  baterai: "Tahan lama tanpa mengisi",
};

/**
 * Syarat wajib. Setiap nilai di sini harus bisa diperiksa dari data tercatat
 * (varian atau spesifikasi) oleh `recommend()`, bukan dari tebakan model.
 */
export const REQUIREMENTS = [
  "garansi-resmi",
  "ram-8",
  "storage-256",
  "5g",
  "nfc",
  "tahan-air",
  "jack-audio",
  "telefoto",
  "charging-cepat",
] as const;
export type Requirement = (typeof REQUIREMENTS)[number];

export const REQUIREMENT_LABELS: Record<Requirement, string> = {
  "garansi-resmi": "Harus bergaransi resmi Indonesia",
  "ram-8": "RAM minimal 8 GB",
  "storage-256": "Penyimpanan minimal 256 GB",
  "5g": "Harus mendukung 5G",
  nfc: "Harus ada NFC",
  "tahan-air": "Tahan air dan debu (IP67 atau lebih)",
  "jack-audio": "Ada colokan audio 3,5 mm",
  telefoto: "Ada lensa telefoto (zoom optik)",
  "charging-cepat": "Pengisian cepat minimal 33 W",
};

export const PRIORITIES = [
  "harga",
  "baterai",
  "kamera",
  "performa",
  "ringan",
  "layar",
] as const;

export const PRIORITY_LABELS: Record<(typeof PRIORITIES)[number], string> = {
  harga: "Harga semurah mungkin",
  baterai: "Daya tahan baterai",
  kamera: "Kemampuan kamera",
  performa: "Performa dan kelancaran",
  ringan: "Bodi ringan",
  layar: "Layar besar dan mulus",
};

/** Prioritas berperingkat paling banyak tiga. */
export const MAX_PRIORITIES = 3;
