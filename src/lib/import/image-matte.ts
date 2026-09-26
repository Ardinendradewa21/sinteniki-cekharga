/**
 * Menghapus latar polos (putih/abu sangat terang) dari foto produk.
 *
 * Foto toko dan GSMArena hampir selalu berupa ponsel di atas kanvas putih.
 * Di mode gelap kanvas itu tampil sebagai kotak putih. Yang dihapus HANYA
 * piksel latar yang tersambung ke tepi gambar (flood fill dari bingkai),
 * sehingga bagian putih di dalam badan ponsel, yang dikelilingi garis tepi
 * ponsel, tetap utuh.
 *
 * Gambar dibiarkan apa adanya bila:
 * - bingkainya bukan latar polos (foto suasana, latar berwarna), atau
 * - hasilnya menghapus hampir seluruh gambar (tanda ponsel putih menyatu
 *   dengan latar; lebih baik latar putih daripada ponsel yang terpotong).
 *
 * Modul ini murni (tanpa sharp, tanpa jaringan) supaya bisa diuji langsung.
 */

/**
 * Ambang "hampir putih": kanal terendah dan selisih antarkanal (kejenuhan).
 * Ketat dengan sengaja: bodi ponsel pastel (mis. lavender vivo Y19s GT,
 * ±235/230/245) tersambung ke tepi foto GSMArena dan ikut terhapus pada ambang
 * 232/20. Latar studio sendiri praktis 255 dengan derau JPEG beberapa poin.
 */
const MIN_CHANNEL = 244;
const MAX_SPREAD = 10;
/** Piksel yang sudah transparan di sumbernya juga dihitung sebagai latar. */
const TRANSPARENT_ALPHA = 16;
/**
 * Minimal porsi bingkai yang berupa latar polos. Rendah dengan sengaja: foto
 * GSMArena dipotong rapat sehingga ponselnya menyentuh tepi atas dan bawah.
 * Syarat sudut di bawah yang menyaring foto berlatar suasana.
 */
const MIN_BORDER_RATIO = 0.3;
/** Minimal jumlah sudut (dari 4) yang berupa latar polos. */
const MIN_PLAIN_CORNERS = 3;
/** Bila lebih dari ini ikut terhapus, kemungkinan besar objeknya ikut termakan. */
const MAX_REMOVED_RATIO = 0.94;
/** Tepi objek yang nyaris putih dibuat semi-transparan agar tidak ada halo. */
const EDGE_FLOOR = 200;

export type MatteResult = {
  /** false = gambar tidak diubah; alasannya ada di `reason`. */
  applied: boolean;
  reason: "matted" | "border-not-plain" | "subject-lost" | "no-background";
  removedRatio: number;
};

function isBackground(data: Uint8Array, offset: number): boolean {
  if (data[offset + 3]! < TRANSPARENT_ALPHA) return true;
  const r = data[offset]!;
  const g = data[offset + 1]!;
  const b = data[offset + 2]!;
  const min = Math.min(r, g, b);
  return min >= MIN_CHANNEL && Math.max(r, g, b) - min <= MAX_SPREAD;
}

/**
 * Mengubah `data` (RGBA, 4 kanal) di tempat. Mengembalikan apakah latar
 * benar-benar dihapus.
 */
export function removePlainBackground(
  data: Uint8Array,
  width: number,
  height: number
): MatteResult {
  const total = width * height;
  if (width < 3 || height < 3 || data.length < total * 4) {
    return { applied: false, reason: "no-background", removedRatio: 0 };
  }

  const border: number[] = [];
  for (let x = 0; x < width; x += 1) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y += 1) border.push(y * width, y * width + width - 1);

  const corners = [0, width - 1, (height - 1) * width, total - 1];
  const plainCorners = corners.filter((index) => isBackground(data, index * 4)).length;
  const plainBorder = border.filter((index) => isBackground(data, index * 4));
  if (
    plainCorners < MIN_PLAIN_CORNERS ||
    plainBorder.length / border.length < MIN_BORDER_RATIO
  ) {
    return { applied: false, reason: "border-not-plain", removedRatio: 0 };
  }

  // Flood fill 4-arah dari seluruh piksel bingkai yang polos.
  const removed = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  for (const index of plainBorder) {
    if (removed[index]) continue;
    removed[index] = 1;
    queue[tail++] = index;
  }
  while (head < tail) {
    const index = queue[head++]!;
    const x = index % width;
    const neighbours = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      index - width,
      index + width,
    ];
    for (const next of neighbours) {
      if (next < 0 || next >= total || removed[next]) continue;
      if (!isBackground(data, next * 4)) continue;
      removed[next] = 1;
      queue[tail++] = next;
    }
  }

  const removedRatio = tail / total;
  if (tail === 0) return { applied: false, reason: "no-background", removedRatio };
  if (removedRatio > MAX_REMOVED_RATIO) {
    return { applied: false, reason: "subject-lost", removedRatio };
  }

  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;
    if (removed[index]) {
      data[offset + 3] = 0;
      continue;
    }
    // Hanya piksel yang bersebelahan dengan latar: sisa antialias putih di
    // garis tepi dibuat transparan sebanding dengan tingkat putihnya.
    const x = index % width;
    const touchesBackground =
      (x > 0 && removed[index - 1]) ||
      (x < width - 1 && removed[index + 1]) ||
      (index >= width && removed[index - width]) ||
      (index + width < total && removed[index + width]);
    if (!touchesBackground) continue;
    const min = Math.min(data[offset]!, data[offset + 1]!, data[offset + 2]!);
    if (min <= EDGE_FLOOR) continue;
    const whiteness = (min - EDGE_FLOOR) / (255 - EDGE_FLOOR);
    data[offset + 3] = Math.round(data[offset + 3]! * (1 - whiteness * 0.85));
  }

  return { applied: true, reason: "matted", removedRatio };
}
