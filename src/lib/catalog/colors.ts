/**
 * Pilihan warna di halaman detail produk (2026-10-12).
 *
 * Warna diambil dari data yang benar-benar tercatat: warna foto produk dan
 * warna listing toko. Daftar warna spesifikasi GSMArena sengaja tidak dipakai
 * untuk pilihan, karena itu daftar global dan belum tentu dijual di Indonesia.
 *
 * Warna hanya mengganti foto yang tampil. Harga tetap per varian memori
 * (PRD §7), jadi memilih warna tidak pernah mengubah harga atau penawaran.
 *
 * Modul murni.
 */

export type ColorPhoto = { src: string; alt: string; source: string; color: string | null };

export type ProductColorOption = {
  /** Nama apa adanya dari sumber, mis. "Lotus Purple". */
  name: string;
  /** Bentuk URL, mis. "lotus-purple". */
  key: string;
  isSelected: boolean;
  /** Foto pertama warna ini, untuk ikon pilihan; null bila belum ada foto warna ini. */
  thumbnail: { src: string; alt: string } | null;
  /** Perkiraan warna untuk titik penanda bila tidak ada foto; null bila nama tidak dikenali. */
  swatch: string | null;
  /** Jumlah penawaran varian terpilih yang mencatat warna ini. */
  offerCount: number;
};

export function colorUrlKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * Kata kunci nama warna -> perkiraan warna titik penanda. Urutan penting:
 * warna dasar dicek lebih dulu ("Oak Green" -> hijau, bukan cokelat dari "oak").
 * Hanya penanda visual; nama warna selalu ditulis di sebelahnya.
 */
const SWATCHES: readonly [RegExp, string][] = [
  [/\b(?:black|hitam|onyx|obsidian|midnight|phantom)\b/i, "#1f1f22"],
  [/\b(?:white|putih|snow|pearl|ivory)\b/i, "#f4f4f2"],
  [/\b(?:silver|perak)\b/i, "#c3c6cb"],
  [/\b(?:gr[ae]y|abu|graphite|titanium|space)\b/i, "#7d8087"],
  [/\b(?:green|hijau|mint|emerald|olive|sage|jade)\b/i, "#3f7d4e"],
  [/\b(?:blue|biru|navy|ocean|sky|azure|denim)\b/i, "#3866c9"],
  [/\b(?:purple|ungu|violet|lavender|lilac|lotus)\b/i, "#7d5bb5"],
  [/\b(?:pink|blush|rose|merah muda|sakura)\b/i, "#efc0cc"],
  [/\b(?:red|merah|crimson|ruby)\b/i, "#c3352e"],
  [/\b(?:gold|emas|champagne)\b/i, "#d2b06a"],
  [/\b(?:yellow|kuning|lemon)\b/i, "#efcd4a"],
  [/\b(?:orange|oranye|jingga|sunset)\b/i, "#e8823a"],
  [/\b(?:cyan|teal|tosca|aqua|turquoise)\b/i, "#2a9897"],
  [/\b(?:brown|cokelat|coklat|bronze|copper|oak|mocha)\b/i, "#8a5d3b"],
  [/\b(?:cream|krem|beige|sand|latte)\b/i, "#e8dcc4"],
  [/\b(?:palm|forest|leaf)\b/i, "#3f7d4e"],
  [/\b(?:cloud|mist)\b/i, "#e9e9ec"],
];

export function colorSwatch(name: string): string | null {
  return SWATCHES.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}

/**
 * Menyusun pilihan warna, warna terpilih, dan galeri yang tampil.
 *
 * - Urutan warna: warna foto (foto utama dulu), lalu warna listing toko.
 * - Warna terpilih: permintaan URL bila dikenal; selain itu warna foto utama;
 *   selain itu warna pertama yang punya foto. Bila tidak ada warna yang punya
 *   foto, tidak ada warna yang dipilih otomatis (judul tidak mengklaim warna).
 * - Galeri: foto warna terpilih bila ada; selain itu semua foto.
 */
export function buildColorOptions({
  photos,
  offerColors,
  selectedVariantOfferColors,
  requestedKey,
}: {
  photos: readonly ColorPhoto[];
  /** Warna listing semua varian produk. */
  offerColors: readonly (readonly string[])[];
  /** Warna listing varian terpilih saja, untuk menghitung penawaran per warna. */
  selectedVariantOfferColors: readonly (readonly string[])[];
  requestedKey: string | undefined;
}): { options: ProductColorOption[]; selected: ProductColorOption | null; gallery: ColorPhoto[] } {
  const names = new Map<string, string>();
  const add = (name: string | null) => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    const key = colorUrlKey(trimmed);
    if (key && !names.has(key)) names.set(key, trimmed);
  };
  for (const photo of photos) add(photo.color);
  for (const list of offerColors) for (const color of list) add(color);

  const photosByKey = new Map<string, ColorPhoto[]>();
  for (const photo of photos) {
    if (!photo.color) continue;
    const key = colorUrlKey(photo.color);
    photosByKey.set(key, [...(photosByKey.get(key) ?? []), photo]);
  }

  const primaryKey = photos[0]?.color ? colorUrlKey(photos[0].color) : null;
  const requested = requestedKey && names.has(requestedKey) ? requestedKey : null;
  const selectedKey = requested ?? primaryKey ?? [...names.keys()].find((key) => photosByKey.has(key)) ?? null;

  const options: ProductColorOption[] = [...names].map(([key, name]) => {
    const first = photosByKey.get(key)?.[0];
    return {
      name,
      key,
      isSelected: key === selectedKey,
      thumbnail: first ? { src: first.src, alt: first.alt } : null,
      swatch: colorSwatch(name),
      offerCount: selectedVariantOfferColors.filter((list) => list.some((color) => colorUrlKey(color) === key)).length,
    };
  });

  const colorPhotos = selectedKey ? photosByKey.get(selectedKey) : undefined;
  return {
    options,
    selected: options.find((option) => option.isSelected) ?? null,
    gallery: colorPhotos?.length ? colorPhotos : [...photos],
  };
}
