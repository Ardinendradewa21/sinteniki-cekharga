import "server-only";

import { hasInsforgeCredentials } from "@/lib/backend/insforge";

/**
 * Pemeriksaan kesehatan backend (PRD §13: "health check aman").
 *
 * "Aman" di sini berarti dua hal sekaligus:
 *
 * - Aman bagi operator: hasilnya cukup spesifik untuk membedakan "belum
 *   dikonfigurasi", "tidak bisa dihubungi", dan "siap", sehingga saat live mode
 *   gagal, penyebabnya langsung kelihatan tanpa membuka log.
 * - Aman bagi publik: tidak pernah mengembalikan URL backend, versi backend,
 *   nama tabel, kunci, atau pesan error mentah. Detail semacam itu memudahkan
 *   penyerang memetakan sistem, dan tidak berguna bagi pengunjung situs.
 *
 * Dua probe yang dipakai, dan keduanya memang perlu:
 * - `/api/health` membuktikan layanannya hidup, tanpa autentikasi.
 * - `/api/database/tables` membuktikan kredensial kita benar-benar berlaku dan
 *   jalur databasenya terbuka. Layanan bisa saja hidup sementara kunci sudah
 *   dirotasi; probe pertama saja tidak akan menangkap itu.
 */

/** Tabel yang harus ada sebelum mode live bisa menyajikan katalog (dibuat di BE-1). */
const REQUIRED_CATALOG_TABLES = [
  "products",
  "variants",
  "product_assets",
  "review_summaries",
  "offers",
  "price_observations",
  "price_checks",
] as const;

const PROBE_TIMEOUT_MS = 5000;

export type BackendHealth =
  | { status: "not-configured" }
  | { status: "unreachable"; reason: string }
  | {
      status: "reachable";
      /** Skema katalog sudah ada dan siap dipakai mode live. */
      catalogSchemaReady: boolean;
      /** Tabel katalog yang belum ada. Kosong berarti siap. */
      missingTables: string[];
    };

/** Ringkasan kegagalan yang aman ditampilkan: tanpa URL, kunci, atau stack. */
function safeReason(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `Tidak ada jawaban dalam ${PROBE_TIMEOUT_MS / 1000} detik`;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return `Tidak ada jawaban dalam ${PROBE_TIMEOUT_MS / 1000} detik`;
  }
  return "Backend tidak dapat dihubungi";
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  if (!hasInsforgeCredentials()) {
    return { status: "not-configured" };
  }

  const baseUrl = process.env.INSFORGE_URL!;
  const apiKey = process.env.INSFORGE_API_KEY!;

  try {
    const serviceResponse = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      // Health check harus selalu menggambarkan keadaan sekarang.
      cache: "no-store",
    });

    if (!serviceResponse.ok) {
      return {
        status: "unreachable",
        reason: `Layanan menjawab dengan status ${serviceResponse.status}`,
      };
    }

    const tablesResponse = await fetch(`${baseUrl}/api/database/tables`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });

    if (tablesResponse.status === 401 || tablesResponse.status === 403) {
      return {
        status: "unreachable",
        reason: "Kredensial ditolak backend. Periksa INSFORGE_API_KEY.",
      };
    }

    if (!tablesResponse.ok) {
      return {
        status: "unreachable",
        reason: `Database menjawab dengan status ${tablesResponse.status}`,
      };
    }

    const tables: unknown = await tablesResponse.json();
    const tableNames = new Set(
      Array.isArray(tables) ? tables.filter((t): t is string => typeof t === "string") : []
    );

    const missingTables = REQUIRED_CATALOG_TABLES.filter(
      (table) => !tableNames.has(table)
    );

    return {
      status: "reachable",
      catalogSchemaReady: missingTables.length === 0,
      missingTables,
    };
  } catch (error) {
    return { status: "unreachable", reason: safeReason(error) };
  }
}
