import { getInsforgePublicClient } from "@/lib/backend/insforge";
import { getDataSourceMode } from "@/lib/config";

/**
 * ads.txt (IAB Tech Lab): daftar penjual iklan yang sah untuk domain ini.
 * Isinya dikelola di Admin > Iklan > ads.txt. Tanpa entri, file tetap ada
 * dengan komentar saja, yang sah menurut spesifikasi.
 */

export const revalidate = 3600;

export async function GET() {
  const lines = ["# ads.txt CekHarga"];
  if (getDataSourceMode() === "live") {
    const { data, error } = await getInsforgePublicClient().database.rpc("ad_ads_txt");
    if (error) {
      console.error("[iklan] ads.txt gagal dibaca:", error);
    } else {
      for (const row of (data ?? []) as Record<string, string | null>[]) {
        lines.push(
          [row.ad_system_domain, row.publisher_id, row.relationship, row.cert_authority_id]
            .filter((part): part is string => Boolean(part))
            .join(", ")
        );
      }
    }
  }
  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
