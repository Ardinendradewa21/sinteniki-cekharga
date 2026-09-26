import "server-only";

export { selectAll, selectWhereIn } from "@/lib/backend/paged-read";

/**
 * Utilitas tulis/baca massal untuk importer.
 *
 * Importer dulu menjalankan beberapa query BERURUTAN per baris CSV (cek ada,
 * lalu insert/update, lalu cek harga, lalu cek pemeriksaan). Untuk 500 baris
 * itu ribuan round-trip dan rawan timeout di tengah jalan. Pola penggantinya:
 * baca data yang sudah ada sekaligus per kelompok, sisipkan baris baru secara
 * massal, dan jalankan pembaruan yang tersisa paralel dengan batas.
 *
 * Tidak bergantung pada constraint unik di database (upsert ON CONFLICT),
 * sehingga tetap benar di database yang migrasi constraint-nya belum
 * diterapkan. Constraint itu menjadi lapis pengaman tambahan, bukan syarat.
 */

/** Baris per insert massal. */
export const INSERT_CHUNK = 200;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

export function isUniqueViolation(error: unknown): boolean {
  return JSON.stringify(error ?? "").includes("23505");
}

/** Kunci waktu yang kebal perbedaan format ("Z" vs "+00:00"). */
export function timeKey(value: unknown): number {
  return new Date(String(value)).getTime();
}
