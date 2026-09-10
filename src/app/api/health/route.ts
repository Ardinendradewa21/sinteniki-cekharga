import { checkBackendHealth } from "@/lib/backend/health";
import { getDataSourceMode } from "@/lib/config";

/**
 * Health check (PRD §13).
 *
 * Route Handler di Next 16 tidak di-cache secara default, jadi jawabannya
 * selalu menggambarkan keadaan saat diminta. Tidak ada `force-static` di sini,
 * dan itu memang yang diinginkan: health check yang di-cache adalah health
 * check yang berbohong.
 *
 * Kode status dipilih supaya bisa dipakai monitoring tanpa membaca isi badan
 * respons:
 * - 200 saat aplikasi benar-benar bisa melayani permintaan pada mode yang
 *   sedang aktif.
 * - 503 saat mode live dipilih tetapi backend belum siap. Ini SENGAJA gagal,
 *   bukan diam-diam turun ke fixture (PRD §9).
 *
 * Mode demo mengembalikan 200 karena aplikasinya memang sehat: menyajikan
 * fixture berlabel adalah perilaku yang diniatkan, bukan kegagalan.
 */
export async function GET() {
  const dataSource = getDataSourceMode();
  const backend = await checkBackendHealth();

  const liveReady =
    backend.status === "reachable" && backend.catalogSchemaReady;

  const healthy = dataSource === "demo" ? true : liveReady;

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      dataSource,
      backend,
      checkedAt: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        // Jangan pernah disimpan proxy atau CDN mana pun.
        "Cache-Control": "no-store",
      },
    }
  );
}
