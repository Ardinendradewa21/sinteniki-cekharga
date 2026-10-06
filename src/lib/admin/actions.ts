"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { invalidateCatalogCache } from "@/lib/backend/catalog-repository";
import { recordAudit } from "@/lib/admin/audit";
import {
  formToNestedObject,
  offerInput,
  priceInput,
  productInput,
  reviewInput,
  variantInput,
} from "@/lib/admin/schema";
import { officialBrandName } from "@/lib/catalog/brands";
import { loadStoreResolver } from "@/lib/import/stores";

/**
 * Aksi tulis untuk admin (PRD FR-07).
 *
 * Setiap fungsi di berkas ini mengikuti urutan yang sama, dan urutannya bukan
 * gaya penulisan melainkan syarat keamanan:
 *
 *   1. requireStaff([]) — dokumentasi Next.js menegaskan Server Action adalah
 *                         endpoint POST yang bisa dipanggil siapa pun tanpa
 *                         melewati antarmuka. Form yang hanya dirender di
 *                         halaman terlindungi BUKAN batas keamanan.
 *   2. validasi Zod     — FormData adalah masukan tidak tepercaya.
 *   3. tulis ke database
 *   4. catat audit      — FR-07 menuntut perubahan bisa ditelusuri.
 *   5. revalidatePath   — supaya tampilan admin dan publik ikut segar.
 *
 * Nilai yang dikembalikan sengaja hanya berupa pesan, bukan baris database
 * mentah, sesuai anjuran "constrain return values".
 */

export type ActionState = { error: string | null; message?: string };

function fail(error: string): ActionState {
  return { error };
}

/** Menyegarkan tampilan admin sekaligus halaman publik yang ikut berubah. */
function revalidateCatalog(slug?: string) {
  invalidateCatalogCache();
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  if (slug) revalidatePath(`/products/${slug}`);
}

function adminProductsResultHref(
  formData: FormData,
  result: Record<string, string | number>
): string {
  const requested = String(formData.get("returnTo") ?? "");
  let params = new URLSearchParams();

  try {
    const url = new URL(requested, "https://cekharga.local");
    if (url.pathname === "/admin/products") params = url.searchParams;
  } catch {
    // URL hasil manipulasi klien diabaikan; tujuan aman dipakai di bawah.
  }

  for (const key of ["pesan", "galat", "jumlah", "status"]) params.delete(key);
  for (const [key, value] of Object.entries(result)) params.set(key, String(value));

  const search = params.toString();
  return search ? `/admin/products?${search}` : "/admin/products";
}

/* ------------------------------------------------------------------ produk */

export async function createProductAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireStaff([]);

  const parsed = productInput.safeParse(formToNestedObject(formData));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Masukan tidak valid.");
  }
  const input = parsed.data;

  const { data, error } = await getInsforgeAdminClient()
    .database.from("products")
    .insert([
      {
        // Jejak asal (Fase 4): dibuat langsung di admin, bukan oleh batch impor.
        last_source: "manual",
        slug: input.slug,
        brand: officialBrandName(input.brand),
        model: input.model,
        specs: input.specs,
        specs_source: input.specsSource,
        specs_source_url: input.specsSourceUrl,
        specs_retrieved_at: new Date().toISOString(),
        source_key: input.sourceKey,
        // Produk baru SELALU draft. PRD FR-07: data tidak langsung
        // dipublikasikan tanpa peninjauan.
        status: "draft",
      },
    ])
    .select();

  if (error) {
    const duplicate = JSON.stringify(error).includes("23505");
    return fail(
      duplicate
        ? "Slug atau kunci sumber itu sudah dipakai produk lain."
        : "Gagal menyimpan produk."
    );
  }

  const created = (data ?? [])[0] as { id: string } | undefined;
  if (!created) return fail("Produk tersimpan tetapi tidak bisa dibaca kembali.");

  await recordAudit(admin, "produk.buat", "product", created.id, {
    slug: input.slug,
  });
  revalidateCatalog();
  redirect(`/admin/products/${created.id}`);
}

export async function updateProductAction(
  productId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireStaff([]);

  const parsed = productInput.safeParse(formToNestedObject(formData));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Masukan tidak valid.");
  }
  const input = parsed.data;
  const db = getInsforgeAdminClient().database;

  const previous = await db.from("products").select("slug").eq("id", productId).limit(1);
  const previousSlug = ((previous.data ?? [])[0] as { slug: string } | undefined)?.slug;

  const { error } = await db
    .from("products")
    .update({
      // Disunting manual: batch impor yang membuatnya tidak lagi boleh
      // menghapusnya lewat undo (updated_at ikut maju).
      last_source: "manual",
      updated_by_batch_id: null,
      slug: input.slug,
      brand: officialBrandName(input.brand),
      model: input.model,
      specs: input.specs,
      specs_source: input.specsSource,
      specs_source_url: input.specsSourceUrl,
      source_key: input.sourceKey,
      // specs_retrieved_at TIDAK ikut diperbarui di sini. Menyunting teks
      // bukan berarti data sumbernya baru diambil ulang; memajukan waktu itu
      // akan membuat data lama terlihat lebih segar dari kenyataannya.
    })
    .eq("id", productId);

  if (error) return fail("Gagal menyimpan perubahan.");

  // Slug yang diganti tetap bisa dibuka: URL lama diarahkan permanen ke produk
  // ini. Kalau slug lama itu nanti dipakai produk lain, produk itu didahulukan.
  if (previousSlug && previousSlug !== input.slug) {
    await db
      .from("product_slug_redirects")
      .upsert([{ old_slug: previousSlug, product_id: productId }], { onConflict: "old_slug" });
    // Slug baru bukan lagi slug lama siapa pun.
    await db.from("product_slug_redirects").delete().eq("old_slug", input.slug);
  }

  await recordAudit(admin, "produk.sunting", "product", productId, {
    slug: input.slug,
    ...(previousSlug && previousSlug !== input.slug ? { slug_lama: previousSlug } : {}),
  });
  revalidateCatalog(input.slug);
  return { error: null, message: "Perubahan tersimpan." };
}

export async function setProductStatusAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const productId = String(formData.get("productId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!productId || (status !== "draft" && status !== "published")) return;

  const db = getInsforgeAdminClient().database;

  // Menerbitkan produk tanpa varian akan menghasilkan halaman publik yang tidak
  // bisa menampilkan harga sama sekali, karena harga selalu terikat varian
  // (PRD §7). Lebih baik ditolak di sini daripada terbit setengah jadi.
  if (status === "published") {
    const { data } = await db
      .from("variants")
      .select("id")
      .eq("product_id", productId)
      .limit(1);
    if ((data ?? []).length === 0) {
      redirect(`/admin/products/${productId}?galat=tanpa-varian`);
    }
  }

  const { error } = await db.from("products").update({ status }).eq("id", productId);
  if (error) redirect(`/admin/products/${productId}?galat=status`);

  await recordAudit(
    admin,
    status === "published" ? "produk.terbitkan" : "produk.tarik",
    "product",
    productId
  );
  revalidateCatalog();
  redirect(`/admin/products/${productId}`);
}

export async function setProductsStatusBulkAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const productIds = [
    ...new Set(
      formData
        .getAll("productIds")
        .map(String)
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];
  const status = String(formData.get("status") ?? "");

  if (
    productIds.length === 0 ||
    productIds.length > 50 ||
    (status !== "draft" && status !== "published")
  ) {
    redirect(adminProductsResultHref(formData, { galat: "pilihan-status" }));
  }

  const db = getInsforgeAdminClient().database;
  const selected = await db
    .from("products")
    .select("id, slug, status")
    .in("id", productIds)
    .limit(50);

  if (selected.error) {
    redirect(adminProductsResultHref(formData, { galat: "status-banyak" }));
  }

  const rows = (selected.data ?? []) as {
    id: string;
    slug: string;
    status: "draft" | "published";
  }[];
  if (rows.length === 0) {
    redirect(adminProductsResultHref(formData, { galat: "pilihan-status" }));
  }

  // Aturan yang sama dengan penerbitan satu produk: setiap produk wajib punya
  // sedikitnya satu varian. Seluruh operasi dibatalkan bila ada yang belum
  // memenuhi syarat, supaya hasil bulk update tidak setengah berhasil.
  if (status === "published") {
    const variants = await db
      .from("variants")
      .select("product_id")
      .in(
        "product_id",
        rows.map((row) => row.id)
      )
      .limit(1000);

    if (variants.error) {
      redirect(adminProductsResultHref(formData, { galat: "status-banyak" }));
    }

    const productIdsWithVariants = new Set(
      ((variants.data ?? []) as { product_id: string }[]).map(
        (variant) => variant.product_id
      )
    );
    const withoutVariants = rows.filter(
      (row) => !productIdsWithVariants.has(row.id)
    );

    if (withoutVariants.length > 0) {
      redirect(
        adminProductsResultHref(formData, {
          galat: "tanpa-varian-banyak",
          jumlah: withoutVariants.length,
        })
      );
    }
  }

  const changedRows = rows.filter((row) => row.status !== status);
  if (changedRows.length > 0) {
    const { error } = await db
      .from("products")
      .update({ status })
      .in(
        "id",
        changedRows.map((row) => row.id)
      );

    if (error) {
      redirect(adminProductsResultHref(formData, { galat: "status-banyak" }));
    }

    await recordAudit(
      admin,
      status === "published" ? "produk.terbitkan-banyak" : "produk.tarik-banyak",
      "product",
      null,
      {
        count: changedRows.length,
        products: changedRows,
        status,
      }
    );
    revalidateCatalog();
  }

  redirect(
    adminProductsResultHref(formData, {
      pesan: "status",
      status,
      jumlah: changedRows.length,
    })
  );
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const productId = String(formData.get("productId") ?? "");
  const confirmSlug = String(formData.get("konfirmasi") ?? "").trim();
  const actualSlug = String(formData.get("slug") ?? "").trim();

  // Penghapusan menghanyutkan varian, penawaran, dan seluruh riwayat harganya
  // lewat ON DELETE CASCADE. Karena itu admin harus mengetik ulang slug-nya;
  // satu klik tidak cukup untuk operasi yang tidak bisa dibatalkan.
  if (!productId || confirmSlug !== actualSlug) {
    redirect(`/admin/products/${productId}?galat=konfirmasi`);
  }

  const { error } = await getInsforgeAdminClient()
    .database.from("products")
    .delete()
    .eq("id", productId);

  if (error) redirect(`/admin/products/${productId}?galat=hapus`);

  await recordAudit(admin, "produk.hapus", "product", productId, { slug: actualSlug });
  revalidateCatalog();
  redirect("/admin/products");
}

export async function deleteProductsBulkAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const productIds = [
    ...new Set(
      formData
        .getAll("productIds")
        .map(String)
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];

  // Pilihan massal dibatasi satu halaman. Selain mencegah permintaan yang
  // terlalu besar, batas ini memastikan satu kesalahan klik tidak dapat
  // menghapus seluruh katalog yang kelak berisi ratusan produk.
  if (productIds.length === 0 || productIds.length > 50) {
    redirect(adminProductsResultHref(formData, { galat: "pilihan-hapus" }));
  }

  const db = getInsforgeAdminClient().database;
  const selected = await db
    .from("products")
    .select("id, slug")
    .in("id", productIds)
    .limit(50);

  if (selected.error) {
    redirect(adminProductsResultHref(formData, { galat: "hapus-banyak" }));
  }

  const rows = (selected.data ?? []) as { id: string; slug: string }[];
  if (rows.length === 0) {
    redirect(adminProductsResultHref(formData, { galat: "pilihan-hapus" }));
  }

  // Relasi varian, penawaran, harga, aset, dan review memakai ON DELETE
  // CASCADE, sama seperti penghapusan satu produk di halaman detail.
  const { error } = await db
    .from("products")
    .delete()
    .in(
      "id",
      rows.map((row) => row.id)
    );

  if (error) {
    redirect(adminProductsResultHref(formData, { galat: "hapus-banyak" }));
  }

  await recordAudit(admin, "produk.hapus-banyak", "product", null, {
    count: rows.length,
    products: rows,
  });
  revalidateCatalog();
  redirect(
    adminProductsResultHref(formData, {
      pesan: "dihapus",
      jumlah: rows.length,
    })
  );
}

/* ------------------------------------------------------------------ varian */

export async function addVariantAction(
  productId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireStaff([]);

  const parsed = variantInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Masukan varian tidak valid.");
  }

  const { error } = await getInsforgeAdminClient()
    .database.from("variants")
    .insert([
      {
        product_id: productId,
        ram_gb: parsed.data.ramGb,
        storage_gb: parsed.data.storageGb,
        region: parsed.data.region,
      },
    ]);

  if (error) {
    const duplicate = JSON.stringify(error).includes("23505");
    return fail(
      duplicate
        ? "Varian dengan RAM, penyimpanan, dan region itu sudah terdaftar."
        : "Gagal menambah varian."
    );
  }

  await recordAudit(admin, "varian.tambah", "variant", null, {
    productId,
    ram: parsed.data.ramGb,
    storage: parsed.data.storageGb,
  });
  revalidatePath(`/admin/products/${productId}`);
  revalidateCatalog();
  return { error: null, message: "Varian ditambahkan." };
}

export async function deleteVariantAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const variantId = String(formData.get("variantId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!variantId) return;

  const { error } = await getInsforgeAdminClient()
    .database.from("variants")
    .delete()
    .eq("id", variantId);

  if (!error) {
    await recordAudit(admin, "varian.hapus", "variant", variantId, { productId });
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidateCatalog();
  redirect(`/admin/products/${productId}`);
}

/* -------------------------------------------------------------- penawaran */

export async function addOfferAction(
  productId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireStaff([]);

  const parsed = offerInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Masukan penawaran tidak valid.");
  }
  const input = parsed.data;

  let storeId: string | null = null;
  try {
    storeId = (await loadStoreResolver())(input.url);
  } catch {
    // Toko hanya pelengkap (logo, jenis toko); penawaran tetap boleh disimpan.
  }

  const { error } = await getInsforgeAdminClient()
    .database.from("offers")
    .insert([
      {
        last_source: "manual",
        variant_id: input.variantId,
        store_id: storeId,
        marketplace: input.marketplace,
        seller_name: input.sellerName,
        url: input.url,
        warranty: input.warranty,
        listing_status: input.listingStatus,
        seller_verified: input.sellerVerified,
      },
    ]);

  if (error) {
    return fail(
      JSON.stringify(error).includes("23505")
        ? "Penawaran dengan URL listing itu sudah terdaftar untuk varian ini."
        : "Gagal menambah penawaran."
    );
  }

  await recordAudit(admin, "penawaran.tambah", "offer", null, {
    productId,
    marketplace: input.marketplace,
  });
  revalidatePath(`/admin/products/${productId}`);
  revalidateCatalog();
  return { error: null, message: "Penawaran ditambahkan." };
}

export async function deleteOfferAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const offerId = String(formData.get("offerId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!offerId) return;

  const { error } = await getInsforgeAdminClient()
    .database.from("offers")
    .delete()
    .eq("id", offerId);

  if (!error) {
    await recordAudit(admin, "penawaran.hapus", "offer", offerId, { productId });
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidateCatalog();
  redirect(`/admin/products/${productId}`);
}

/* ------------------------------------------------------- pencatatan harga */

export async function recordPriceAction(
  productId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireStaff([]);

  const parsed = priceInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Harga tidak valid.");
  }
  const { offerId, priceIdr } = parsed.data;

  const db = getInsforgeAdminClient().database;
  const now = new Date().toISOString();

  // DUA baris ditulis, dan keduanya wajib.
  //
  // `price_observations` menyimpan angkanya. `price_checks` menyimpan fakta
  // bahwa pemeriksaan berhasil pada waktu tersebut, dan itulah yang dibaca UI
  // sebagai "terakhir diperiksa" (PRD §7 butir 6). Menulis harga tanpa mencatat
  // pemeriksaannya akan membuat harga baru tampil dengan waktu pemeriksaan lama.
  const observation = await db.from("price_observations").insert([
    { offer_id: offerId, price_idr: priceIdr, observed_at: now, origin: "manual" },
  ]);
  if (observation.error) return fail("Gagal menyimpan harga.");

  // Penawaran yang harganya dicatat manual ditandai manual, supaya undo batch
  // impor tidak menghapus penawaran yang sudah dirawat admin.
  await db.from("offers").update({ last_source: "manual", updated_by_batch_id: null }).eq("id", offerId);

  const check = await db.from("price_checks").insert([
    { offer_id: offerId, attempted_at: now, outcome: "success", error_summary: null },
  ]);
  if (check.error) {
    console.error("[harga] observasi tersimpan tetapi pemeriksaan gagal dicatat", check.error);
  }

  await recordAudit(admin, "harga.catat", "offer", offerId, { productId, priceIdr });
  revalidatePath(`/admin/products/${productId}`);
  revalidateCatalog();
  return { error: null, message: "Harga tercatat." };
}

/* --------------------------------------------------------------- review */

export async function addReviewAction(
  productId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireStaff([]);

  const parsed = reviewInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Masukan review tidak valid.");
  }
  const input = parsed.data;

  const { error } = await getInsforgeAdminClient()
    .database.from("review_summaries")
    .insert([
      {
        product_id: productId,
        variant_id: input.variantId,
        channel_name: input.channelName,
        video_url: input.videoUrl,
        published_at: input.publishedAt,
        timestamp_seconds: input.timestampSeconds,
        aspect: input.aspect,
        summary: input.summary,
        strengths: input.strengths,
        limitations: input.limitations,
        test_context: input.testContext,
        // Review baru selalu draft. Ringkasan pendapat orang lain harus
        // ditinjau dulu sebelum tampil membawa nama channel mereka.
        status: "draft",
      },
    ]);

  if (error) return fail("Gagal menyimpan review.");

  await recordAudit(admin, "review.tambah", "review", null, {
    productId,
    channel: input.channelName,
  });
  revalidatePath(`/admin/products/${productId}`);
  revalidateCatalog();
  return { error: null, message: "Review tersimpan sebagai draft." };
}

export async function setReviewStatusAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const reviewId = String(formData.get("reviewId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!reviewId || (status !== "draft" && status !== "published")) return;

  const { error } = await getInsforgeAdminClient()
    .database.from("review_summaries")
    .update({ status })
    .eq("id", reviewId);

  if (!error) {
    await recordAudit(
      admin,
      status === "published" ? "review.terbitkan" : "review.tarik",
      "review",
      reviewId,
      { productId }
    );
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidateCatalog();
  redirect(`/admin/products/${productId}`);
}

export async function deleteReviewAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const reviewId = String(formData.get("reviewId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!reviewId) return;

  const { error } = await getInsforgeAdminClient()
    .database.from("review_summaries")
    .delete()
    .eq("id", reviewId);

  if (!error) {
    await recordAudit(admin, "review.hapus", "review", reviewId, { productId });
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidateCatalog();
  redirect(`/admin/products/${productId}`);
}

/* ------------------------------------------- pemeriksaan harga yang gagal */

export async function recordFailedCheckAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const offerId = String(formData.get("offerId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const reason = String(formData.get("alasan") ?? "").trim();
  if (!offerId || !reason) {
    redirect(`/admin/products/${productId}?galat=alasan-kosong`);
  }

  /*
   * HANYA satu baris yang ditulis: price_checks dengan outcome "failure".
   *
   * TIDAK ada price_observations, dan itu inti dari PRD §7 butir 6:
   * "Percobaan gagal tidak boleh memperbarui waktu keberhasilan." Kalau
   * pemeriksaan gagal ikut menulis observasi, harga lama akan tampak baru
   * diperiksa padahal justru sedang tidak bisa dipastikan.
   */
  const { error } = await getInsforgeAdminClient()
    .database.from("price_checks")
    .insert([
      {
        offer_id: offerId,
        attempted_at: new Date().toISOString(),
        outcome: "failure",
        error_summary: reason.slice(0, 300),
      },
    ]);

  if (!error) {
    await recordAudit(admin, "harga.periksa-gagal", "offer", offerId, {
      productId,
      alasan: reason.slice(0, 120),
    });
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidateCatalog();
  redirect(`/admin/products/${productId}`);
}
