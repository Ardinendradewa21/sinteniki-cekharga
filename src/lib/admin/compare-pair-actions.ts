"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";

/**
 * Aksi admin pasangan "A vs B" (PB-28). Hanya peran admin, tercatat di audit.
 * Pasangan adalah pengaturan tampilan, bukan data katalog, jadi dihapus
 * permanen; produk dan harganya tidak tersentuh.
 */

const PAGE = "/admin/products/perbandingan";
const pairInput = z.object({ productA: z.uuid(), productB: z.uuid() }).refine((value) => value.productA !== value.productB);

function refreshPublicPages() {
  revalidatePath("/bandingkan/[pasangan]", "page");
  revalidatePath("/compare");
  revalidatePath("/sitemap.xml");
  revalidatePath(PAGE);
}

export async function addComparePairAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const parsed = pairInput.safeParse({ productA: formData.get("productA"), productB: formData.get("productB") });
  if (!parsed.success) redirect(`${PAGE}?galat=pilihan`);
  const { productA, productB } = parsed.data;

  const db = getInsforgeAdminClient().database;
  const { data: products } = await db
    .from("products")
    .select("id, status")
    .in("id", [productA, productB])
    .is("deleted_at", null);
  const published = ((products ?? []) as { id: string; status: string }[]).filter((row) => row.status === "published");
  if (published.length !== 2) redirect(`${PAGE}?galat=belum-terbit`);

  const { data, error } = await db
    .from("compare_pairs")
    .insert([{ product_a: productA, product_b: productB, created_by: admin.userId || null, created_by_email: admin.email }])
    .select("id");
  if (error) redirect(`${PAGE}?galat=${/duplicate|unique/i.test(error.message ?? "") ? "sudah-ada" : "simpan"}`);
  const id = ((data ?? []) as { id: string }[])[0]?.id ?? null;
  await recordAudit(admin, "perbandingan.tambah", "compare_pair", id, { product_a: productA, product_b: productB });
  refreshPublicPages();
  redirect(`${PAGE}?ok=tambah`);
}

export async function removeComparePairAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) redirect(`${PAGE}?galat=pilihan`);
  const { error } = await getInsforgeAdminClient().database.from("compare_pairs").delete().eq("id", id.data);
  if (error) redirect(`${PAGE}?galat=hapus`);
  await recordAudit(admin, "perbandingan.hapus", "compare_pair", id.data);
  refreshPublicPages();
  redirect(`${PAGE}?ok=hapus`);
}
