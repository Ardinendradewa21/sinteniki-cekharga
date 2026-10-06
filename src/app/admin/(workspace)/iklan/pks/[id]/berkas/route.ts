import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/admin/audit";
import { getContract } from "@/lib/ads/admin-queries";
import { CONTRACT_BUCKET } from "@/lib/ads/admin-storage";
import { getStaffOrNull } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";

/**
 * Membuka berkas PKS dari bucket privat lewat signed URL berumur 5 menit.
 * Tautan tidak pernah disimpan atau ditampilkan permanen.
 */
export async function GET(_request: Request, ctx: RouteContext<"/admin/iklan/pks/[id]/berkas">) {
  const staff = await getStaffOrNull(["legal", "sales", "finance"]);
  if (!staff) return new Response("Tidak berwenang.", { status: 403 });

  const { id } = await ctx.params;
  const contract = await getContract(id).catch(() => null);
  if (!contract?.signed_file_key) return new Response("Berkas tidak ditemukan.", { status: 404 });

  const { data, error } = await getInsforgeAdminClient()
    .storage.from(CONTRACT_BUCKET)
    .createSignedUrl(contract.signed_file_key, 300);
  if (error || !data?.signedUrl) return new Response("Berkas gagal dibuka.", { status: 502 });
  // Dokumen kontrak bersifat rahasia: setiap pembukaan tercatat di audit.
  await recordAudit(staff, "view", "contract_file", contract.id);
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
