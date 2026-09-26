/**
 * Penulisan merek resmi dan pembentukan slug produk.
 *
 * Satu tempat untuk semua jalur impor (CSV spesifikasi, tarik otomatis,
 * pencocokan penawaran). Sumber data menulis merek sesukanya ("Oppo",
 * "Realme", iQOO di bawah "vivo"), jadi merek selalu dikanonkan dulu sebelum
 * slug dibentuk. Keputusan pemilik produk 2026-09-24: OPPO dan realme mengikuti
 * penulisan resmi, dan iQOO berdiri sebagai merek sendiri.
 *
 * Modul murni (tanpa server-only) supaya bisa dipakai dan diuji di mana saja.
 */

/** Kunci huruf kecil → penulisan resmi. Merek di luar daftar dibiarkan apa adanya. */
const OFFICIAL_BRAND_NAMES: Record<string, string> = {
  apple: "Apple",
  honor: "HONOR",
  huawei: "Huawei",
  infinix: "Infinix",
  iqoo: "iQOO",
  itel: "itel",
  motorola: "Motorola",
  oppo: "OPPO",
  realme: "realme",
  samsung: "Samsung",
  tecno: "TECNO",
  vivo: "vivo",
  xiaomi: "Xiaomi",
};

/**
 * Sub-merek yang di sumber tercatat di bawah merek induk tetapi dijual dan
 * dikenal sebagai merek sendiri. GSMArena menulis "vivo iQOO 13".
 */
const SUB_BRANDS: { parent: string; prefix: RegExp; brand: string }[] = [
  { parent: "vivo", prefix: /^iqoo\b\s*/i, brand: "iQOO" },
];

export function officialBrandName(brand: string): string {
  const trimmed = brand.trim();
  return OFFICIAL_BRAND_NAMES[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Membuang nama merek yang sudah menempel di depan nama model.
 *
 * Sumbernya menulis `brand: "Oppo"` dan `model_name: "Oppo Reno16 Pro"`, jadi
 * menggabungkan keduanya begitu saja menghasilkan "Oppo Oppo Reno16 Pro" dan
 * slug "oppo-oppo-reno16-pro".
 */
export function stripBrandPrefix(brand: string, model: string): string {
  const prefix = brand.trim().toLowerCase();
  const text = model.trim();
  if (prefix && text.toLowerCase().startsWith(prefix + " ")) {
    return text.slice(prefix.length).trim();
  }
  return text;
}

/** Merek resmi + nama model tanpa awalan merek, termasuk pemisahan sub-merek. */
export function canonicalBrandModel(
  rawBrand: string,
  rawModel: string
): { brand: string; model: string } {
  const brand = officialBrandName(rawBrand);
  const model = stripBrandPrefix(brand, rawModel);
  for (const sub of SUB_BRANDS) {
    if (brand.toLowerCase() === sub.parent && sub.prefix.test(model)) {
      const rest = model.replace(sub.prefix, "").trim();
      if (rest) return { brand: sub.brand, model: rest };
    }
  }
  return { brand, model };
}

/**
 * Slug kebab-case dari merek dan model. Tanda "+" ditulis "plus": tanpa itu
 * "Galaxy S25" dan "Galaxy S25+" berebut slug yang sama.
 */
export function toSlug(brand: string, model: string): string {
  return `${brand} ${stripBrandPrefix(brand, model)}`
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}
