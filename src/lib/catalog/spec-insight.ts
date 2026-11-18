import { CHIPSET_TIER_LABELS, chipsetTier } from "@/lib/assistant/chipset-tiers";
import type { ProductSpecs } from "@/lib/catalog/schema";

/**
 * Arah faktual baris perbandingan (keputusan PO 18 Nov 2026: "arah faktual +
 * artinya"). Modul murni.
 *
 * Untuk baris yang nilainya BERBEDA, menyusun:
 * - `fact`: mana yang lebih besar/kecil/baru dan selisihnya, dihitung dari
 *   angka tercatat (mis. "Galaxy A56 600 mAh (12%) lebih besar dari ...").
 * - `meaning`: arti singkat selisih itu bagi pengguna, diambil dari realita di
 *   bank materi (`spec-guide.ts`).
 *
 * Batasan (PRD §3, FR-04, FR-06):
 * - Bukan pemenang, skor, atau rekomendasi. Kalimat hanya menyebut arah
 *   angka; tidak ada "lebih baik" atau "terbaik".
 * - Tidak menyimpulkan pengalaman (daya tahan baterai, game, kualitas foto)
 *   dari angka; artinya selalu menyebut batasnya.
 * - Nilai yang tidak diketahui tidak pernah dihitung: bila satu saja kosong,
 *   tidak ada insight (baris itu `incomplete`).
 */

export type InsightSubject = {
  /** Nama pendek untuk kalimat, mis. model tanpa merek. */
  name: string;
  specs: ProductSpecs;
  ramGb: number | null;
  storageGb: number | null;
  warranty: string | null;
};

export type SpecInsight = { fact: string; meaning: string | null };

const id = (value: number, digits = 0) =>
  value.toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

function formatStorage(gb: number): string {
  return gb >= 1024 && gb % 1024 === 0 ? `${id(gb / 1024)} TB` : `${id(gb)} GB`;
}

/** "A", "A dan B", "A, B, dan C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} dan ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, dan ${names[names.length - 1]}`;
}

type Known<T> = { name: string; value: T }[];

/** Nilai semua subjek, atau `null` bila ada yang belum diketahui. */
function allKnown<T>(subjects: readonly InsightSubject[], pick: (subject: InsightSubject) => T | null | undefined): Known<T> | null {
  const values = subjects.map((subject) => ({ name: subject.name, value: pick(subject) }));
  return values.every((entry) => entry.value !== null && entry.value !== undefined) ? (values as Known<T>) : null;
}

type NumericResult = { fact: string; diff: number; high: number; low: number };

/**
 * Kalimat arah untuk angka. Dua produk: "A 600 mAh lebih besar dari B (6.000
 * vs 5.400 mAh)". Tiga produk: "Paling besar: A (...); paling kecil: C (...).
 * Selisih ...". `preferLower` membalik subjek kalimat (bobot: "lebih ringan").
 */
function numeric(
  known: Known<number>,
  options: {
    format: (value: number) => string;
    more: string;
    less: string;
    preferLower?: boolean;
    percent?: boolean;
    minDiff?: number;
  }
): NumericResult | null {
  const values = known.map((entry) => entry.value);
  const high = Math.max(...values);
  const low = Math.min(...values);
  const diff = high - low;
  if (diff <= (options.minDiff ?? 0)) return null;

  const top = known.filter((entry) => entry.value === high).map((entry) => entry.name);
  const bottom = known.filter((entry) => entry.value === low).map((entry) => entry.name);
  const percent = options.percent && low > 0 ? ` (${id(Math.round((diff / low) * 100))}%)` : "";

  if (known.length === 2) {
    const fact = options.preferLower
      ? `${bottom[0]} ${options.format(diff)} lebih ${options.less} dari ${top[0]} (${options.format(low)} vs ${options.format(high)}).`
      : `${top[0]} ${options.format(diff)}${percent} lebih ${options.more} dari ${bottom[0]} (${options.format(high)} vs ${options.format(low)}).`;
    return { fact, diff, high, low };
  }

  const highPart = `paling ${options.more}: ${joinNames(top)} (${options.format(high)})`;
  const lowPart = `paling ${options.less}: ${joinNames(bottom)} (${options.format(low)})`;
  const [first, second] = options.preferLower ? [lowPart, highPart] : [highPart, lowPart];
  const fact = `${first.charAt(0).toUpperCase()}${first.slice(1)}; ${second}. Selisih ${options.format(diff)}${percent}.`;
  return { fact, diff, high, low };
}

/** "Hanya A yang ..." atau "A dan B ...; C tidak." */
function feature(known: Known<boolean>, phrase: string): string | null {
  const have = known.filter((entry) => entry.value).map((entry) => entry.name);
  const lack = known.filter((entry) => !entry.value).map((entry) => entry.name);
  if (have.length === 0 || lack.length === 0) return null;
  if (have.length === 1) return `Hanya ${have[0]} yang ${phrase}.`;
  return `${joinNames(have)} ${phrase}; ${joinNames(lack)} tidak.`;
}

/** "A: x; B: y." untuk nilai kategori. */
function listing(known: Known<string>): string {
  return `${known.map((entry) => `${entry.name}: ${entry.value}`).join("; ")}.`;
}

function panelKind(technology: string | null): "OLED" | "LCD" | null {
  if (!technology) return null;
  if (/oled/i.test(technology)) return "OLED";
  if (/lcd|ips/i.test(technology)) return "LCD";
  return null;
}

const WATER: Record<string, string> = {
  "0": "tanpa perlindungan air",
  "1": "tahan tetesan air",
  "2": "tahan tetesan air",
  "3": "tahan semprotan air",
  "4": "tahan cipratan air",
  "5": "tahan semburan air",
  "6": "tahan semburan air kuat",
  "7": "tahan terendam sampai 1 meter",
  "8": "tahan terendam lebih dari 1 meter",
  "9": "tahan semburan air panas bertekanan",
};

/** Kode IP dengan perlindungan air tertinggi, mis. "IP68/IP69" -> IP69. */
function parseIp(rating: string): { code: string; water: number } | null {
  const matches = [...rating.toUpperCase().matchAll(/IP([0-6X])([0-9])/g)];
  if (matches.length === 0) return null;
  const best = matches.reduce((a, b) => (Number(b[2]) > Number(a[2]) ? b : a));
  return { code: `IP${best[1]}${best[2]}`, water: Number(best[2]) };
}

function androidVersion(os: string): number | null {
  const match = /android\s*(\d{1,2})/i.exec(os);
  return match ? Number(match[1]) : null;
}

const sentence = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" ") || null;

/**
 * Insight untuk satu baris perbandingan berlabel `label`. Mengembalikan
 * `null` bila nilainya sama, ada yang belum diketahui, atau atribut itu tidak
 * punya arah yang jujur (mis. pilihan warna).
 */
export function specInsight(label: string, subjects: readonly InsightSubject[]): SpecInsight | null {
  if (subjects.length < 2) return null;

  switch (label) {
    case "Baterai": {
      const known = allKnown(subjects, (s) => s.specs.batteryMah);
      const result = known && numeric(known, { format: (v) => `${id(v)} mAh`, more: "besar", less: "kecil", percent: true });
      if (!result) return null;
      const small = result.diff / result.low < 0.1;
      return {
        fact: result.fact,
        meaning: small
          ? "Selisih di bawah 10% jarang terasa; efisiensi chipset dan layar lebih menentukan."
          : "Cadangan energi lebih banyak, tetapi daya tahan nyata tetap bergantung pada efisiensi chipset dan layar. Cek ulasan untuk daya tahan nyata.",
      };
    }
    case "Pengisian": {
      const known = allKnown(subjects, (s) => s.specs.chargingWatt);
      const result = known && numeric(known, { format: (v) => `${id(v)} W`, more: "tinggi", less: "rendah" });
      if (!result) return null;
      return {
        fact: result.fact,
        meaning: "Watt lebih tinggi umumnya lebih cepat terisi bila memakai charger dan kabel yang mendukung.",
      };
    }
    case "Kamera utama": {
      const known = allKnown(subjects, (s) => s.specs.mainCameraMp);
      const result = known && numeric(known, { format: (v) => `${id(v)} MP`, more: "tinggi", less: "rendah" });
      if (!result) return null;
      return {
        fact: result.fact,
        meaning: "MP lebih tinggi memberi ruang crop lebih besar, bukan jaminan foto lebih bagus. Cek ulasan kamera.",
      };
    }
    case "Susunan kamera": {
      const facts: string[] = [];
      const meanings: string[] = [];
      const tele = allKnown(subjects, (s) => s.specs.cameraHasTelephoto);
      const teleFact = tele && feature(tele, "tercatat punya telefoto (zoom optik)");
      if (teleFact) {
        facts.push(teleFact);
        meanings.push("Telefoto berguna untuk memotret objek jauh tanpa memotong gambar.");
      } else if (tele?.every((entry) => entry.value)) {
        const zoom = allKnown(subjects, (s) => s.specs.cameraOpticalZoomX);
        const result = zoom && numeric(zoom, { format: (v) => `${id(v, 1)}x`, more: "jauh", less: "dekat" });
        if (result && zoom) facts.push(`Zoom optik ${listing(zoom.map((e) => ({ name: e.name, value: `${id(e.value, 1)}x` })))}`);
      }
      const wide = allKnown(subjects, (s) => s.specs.cameraHasUltrawide);
      const wideFact = wide && feature(wide, "tercatat punya kamera ultrawide");
      if (wideFact) {
        facts.push(wideFact);
        meanings.push("Ultrawide berguna untuk foto ruangan dan pemandangan.");
      }
      if (facts.length === 0) {
        const count = allKnown(subjects, (s) => s.specs.cameraLensCount);
        if (count && new Set(count.map((e) => e.value)).size > 1) {
          facts.push(`Jumlah kamera belakang ${listing(count.map((e) => ({ name: e.name, value: String(e.value) })))}`);
          meanings.push("Jumlah lensa bukan ukuran kualitas; yang menentukan jenis lensanya.");
        }
      }
      return facts.length > 0 ? { fact: facts.join(" "), meaning: sentence(...meanings) } : null;
    }
    case "Layar": {
      const facts: string[] = [];
      let meaning: string | null = null;
      const size = allKnown(subjects, (s) => s.specs.displayInches);
      const sizeResult = size && numeric(size, { format: (v) => `${id(v, 2)} inci`, more: "besar", less: "kecil", minDiff: 0.04 });
      if (sizeResult) facts.push(sizeResult.fact);
      const panel = allKnown(subjects, (s) => panelKind(s.specs.displayTechnology));
      if (panel && new Set(panel.map((e) => e.value)).size > 1) {
        facts.push(`Panel ${listing(panel)}`);
        meaning = "Panel OLED menampilkan hitam lebih pekat dan kontras lebih tinggi daripada LCD.";
      } else if (sizeResult && sizeResult.diff < 0.2) {
        meaning = "Selisih ukuran sekecil ini hampir tidak terasa; bentuk bodi lebih menentukan.";
      }
      return facts.length > 0 ? { fact: facts.join(" "), meaning } : null;
    }
    case "Refresh rate": {
      const known = allKnown(subjects, (s) => s.specs.refreshRateHz);
      const result = known && numeric(known, { format: (v) => `${id(v)} Hz`, more: "tinggi", less: "rendah" });
      if (!result) return null;
      return {
        fact: result.fact,
        meaning: "Gulir dan animasi tampak lebih halus pada refresh rate lebih tinggi; manfaatnya bergantung pada aplikasi.",
      };
    }
    case "Chipset": {
      const known = allKnown(subjects, (s) => chipsetTier(s.specs.chipset));
      if (!known) return null;
      const tiers = new Set(known.map((entry) => entry.value));
      const note = "Kelas adalah perkiraan CekHarga menurut seri dan generasi pabrikan, bukan benchmark.";
      if (tiers.size === 1) {
        return {
          fact: `Chipset berbeda, tetapi sama-sama tergolong kelas ${CHIPSET_TIER_LABELS[known[0]!.value]}.`,
          meaning: `${note} Bedanya dalam pemakaian perlu dicek di ulasan.`,
        };
      }
      return {
        fact: `Kelas chipset ${listing(known.map((e) => ({ name: e.name, value: CHIPSET_TIER_LABELS[e.value] })))}`,
        meaning: `${note} Kelas lebih tinggi umumnya lebih kencang; untuk game, cek ulasan.`,
      };
    }
    case "Sistem operasi": {
      const known = allKnown(subjects, (s) => (s.specs.osVersion ? androidVersion(s.specs.osVersion) : null));
      if (!known || new Set(known.map((e) => e.value)).size === 1) return null;
      return {
        fact: `Tercatat dengan ${listing(known.map((e) => ({ name: e.name, value: `Android ${e.value}` })))}`,
        meaning: "Yang lebih menentukan umur pakai: berapa tahun pabrikan menjanjikan pembaruan OS dan keamanan.",
      };
    }
    case "RAM": {
      const known = allKnown(subjects, (s) => s.ramGb);
      const result = known && numeric(known, { format: (v) => `${id(v)} GB`, more: "besar", less: "kecil" });
      if (!result) return null;
      return { fact: result.fact, meaning: "RAM lebih besar membuat lebih banyak aplikasi tetap terbuka di latar tanpa dimuat ulang." };
    }
    case "Penyimpanan": {
      const known = allKnown(subjects, (s) => s.storageGb);
      const result = known && numeric(known, { format: formatStorage, more: "besar", less: "kecil" });
      if (!result) return null;
      return {
        fact: result.fact,
        meaning: "Ruang lebih banyak untuk aplikasi, foto, dan video. Kapasitas tidak bisa ditambah setelah membeli, kecuali ada slot microSD.",
      };
    }
    case "Bobot": {
      const known = allKnown(subjects, (s) => s.specs.weightGrams);
      const result = known && numeric(known, { format: (v) => `${id(v)} gram`, more: "berat", less: "ringan", preferLower: true });
      if (!result) return null;
      return {
        fact: result.fact,
        meaning: result.diff < 15 ? "Selisih di bawah 15 gram jarang terasa." : "Selisih sebesar ini terasa saat dipakai satu tangan dalam waktu lama.",
      };
    }
    case "Ketahanan (IP rating)": {
      const known = allKnown(subjects, (s) => (s.specs.ipRating ? parseIp(s.specs.ipRating) : null));
      if (!known || new Set(known.map((e) => e.value.water)).size === 1) return null;
      return {
        fact: listing(known.map((e) => ({ name: e.name, value: `${e.value.code}, ${WATER[String(e.value.water)]}` }))),
        meaning: "Uji pabrikan memakai air tawar di laboratorium; kerusakan karena air sering tidak ditanggung garansi.",
      };
    }
    case "Jaringan": {
      const known = allKnown(subjects, (s) => s.specs.is5G);
      const fact = known && feature(known, "mendukung 5G");
      return fact ? { fact, meaning: "Terasa bila area dan operator Anda sudah terjangkau 5G." } : null;
    }
    case "NFC": {
      const known = allKnown(subjects, (s) => s.specs.hasNfc);
      const fact = known && feature(known, "tercatat punya NFC");
      return fact ? { fact, meaning: "NFC dipakai untuk cek dan isi saldo kartu uang elektronik lewat aplikasi bank." } : null;
    }
    case "Jack headphone 3.5mm": {
      const known = allKnown(subjects, (s) => s.specs.has35mmJack);
      const fact = known && feature(known, "punya jack headphone 3.5 mm");
      return fact ? { fact, meaning: "Tanpa jack, earphone kabel butuh adaptor USB-C." } : null;
    }
    case "Tahun rilis": {
      const known = allKnown(subjects, (s) => s.specs.releaseYear);
      if (!known) return null;
      const result = numeric(known, { format: (v) => String(v), more: "baru", less: "lama" });
      if (!result) return null;
      const newest = known.filter((e) => e.value === result.high).map((e) => e.name);
      const oldest = known.filter((e) => e.value === result.low).map((e) => e.name);
      const fact =
        known.length === 2
          ? `${newest[0]} dirilis ${result.high}, ${result.diff} tahun setelah ${oldest[0]} (${result.low}).`
          : `Paling baru: ${joinNames(newest)} (${result.high}); paling lama: ${joinNames(oldest)} (${result.low}).`;
      return { fact, meaning: "Model lebih baru umumnya punya sisa jatah pembaruan OS dan keamanan lebih panjang." };
    }
    case "Garansi": {
      const known = allKnown(subjects, (s) => s.warranty);
      if (!known || new Set(known.map((e) => e.value)).size === 1) return null;
      return {
        fact: `Jenis garansi berbeda. ${listing(known)}`,
        meaning: "Garansi resmi dilayani pusat servis merek di Indonesia; garansi toko hanya dilayani penjualnya.",
      };
    }
    default:
      return null;
  }
}
