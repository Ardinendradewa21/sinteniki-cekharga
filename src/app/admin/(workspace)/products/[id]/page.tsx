import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { OfferPanel, VariantPanel } from "@/components/admin/product-editor";
import { ProductPhotoJobs } from "@/components/admin/product-photo-jobs";
import { ReviewPanel } from "@/components/admin/review-panel";
import { ProductForm } from "@/components/admin/product-form";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import {
  addOfferAction,
  addReviewAction,
  addVariantAction,
  deleteOfferAction,
  deleteProductAction,
  deleteReviewAction,
  deleteVariantAction,
  recordFailedCheckAction,
  recordPriceAction,
  setProductStatusAction,
  setReviewStatusAction,
  updateProductAction,
  type ActionState,
} from "@/lib/admin/actions";
import { getAdminProduct } from "@/lib/admin/queries";
import { productPhotoJobs } from "@/lib/import/photo-jobs";
import { getProductLineage } from "@/lib/import/batches";

export const metadata: Metadata = {
  title: "Sunting Produk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const GALAT: Record<string, string> = {
  "tanpa-varian":
    "Produk belum bisa diterbitkan karena belum punya varian. Harga selalu terikat varian.",
  konfirmasi: "Penghapusan dibatalkan karena slug yang diketik tidak cocok.",
  status: "Gagal mengubah status produk.",
  "alasan-kosong": "Pemeriksaan gagal harus disertai alasan, supaya riwayatnya bisa dibaca ulang.",
  hapus: "Gagal menghapus produk.",
};

export default async function AdminProductDetailPage({
  params,
  searchParams,
}: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const product = await getAdminProduct(id);
  if (!product) notFound();
  const [photoJobs, lineage] = await Promise.all([productPhotoJobs(product.id), getProductLineage(product.id)]);
  const SOURCE_LABEL = { import: "impor CSV", scrape: "tarik otomatis", manual: "suntingan manual" } as const;

  const galat = typeof query.galat === "string" ? GALAT[query.galat] : null;
  const published = product.status === "published";

  // Aksi yang butuh id produk dibungkus di server, jadi id-nya tidak pernah
  // dikirim dari klien sebagai field yang bisa diubah.
  const update = async (prev: ActionState, formData: FormData) => {
    "use server";
    return updateProductAction(id, prev, formData);
  };
  const addVariant = async (prev: ActionState, formData: FormData) => {
    "use server";
    return addVariantAction(id, prev, formData);
  };
  const addOffer = async (prev: ActionState, formData: FormData) => {
    "use server";
    return addOfferAction(id, prev, formData);
  };
  const recordPrice = async (prev: ActionState, formData: FormData) => {
    "use server";
    return recordPriceAction(id, prev, formData);
  };
  const addReview = async (prev: ActionState, formData: FormData) => {
    "use server";
    return addReviewAction(id, prev, formData);
  };

  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/admin/products" className="underline underline-offset-4">
              Kelola Produk
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
            {product.brand} {product.model}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.slug} ·{" "}
            <span className={published ? "text-success" : "text-warning"}>
              {published ? "Terbit" : "Draft"}
            </span>
          </p>
          {lineage ? (
            <p className="mt-1 text-xs text-muted-foreground" data-testid="product-lineage">
              Asal data:{" "}
              {lineage.createdBy ? (
                <Link href={`/admin/import/batch/${lineage.createdBy.id}`} className="underline underline-offset-2">
                  dibuat oleh {lineage.createdBy.label}
                </Link>
              ) : (
                "dibuat sebelum jejak impor dicatat"
              )}
              {lineage.updatedBy && lineage.updatedBy.id !== lineage.createdBy?.id ? (
                <>
                  {" · diperbarui oleh "}
                  <Link href={`/admin/import/batch/${lineage.updatedBy.id}`} className="underline underline-offset-2">
                    {lineage.updatedBy.label}
                  </Link>
                </>
              ) : null}
              {lineage.lastSource ? ` · terakhir dari ${SOURCE_LABEL[lineage.lastSource]}` : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          {published ? (
            <Button asChild variant="outline">
              <Link href={`/products/${product.slug}`}>Lihat halaman publik</Link>
            </Button>
          ) : null}
          <form action={setProductStatusAction}>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="status" value={published ? "draft" : "published"} />
            <Button type="submit" variant={published ? "outline" : "default"}>
              {published ? "Tarik dari publik" : "Terbitkan"}
            </Button>
          </form>
        </div>
      </div>

      {galat ? (
        <p role="alert" className="mt-6 rounded-xl border border-border bg-warning-muted p-4 text-sm text-foreground">
          {galat}
        </p>
      ) : null}

      <div className="mt-8 space-y-8">
        <ProductPhotoJobs productId={product.id} jobs={photoJobs} />

        <VariantPanel
          product={product}
          addAction={addVariant}
          deleteAction={deleteVariantAction}
        />

        <OfferPanel
          product={product}
          addAction={addOffer}
          deleteAction={deleteOfferAction}
          priceAction={recordPrice}
          failedCheckAction={recordFailedCheckAction}
        />

        <ReviewPanel
          product={product}
          addAction={addReview}
          statusAction={setReviewStatusAction}
          deleteAction={deleteReviewAction}
        />

        <ProductForm
          action={update}
          submitLabel="Simpan perubahan"
          values={{
            slug: product.slug,
            brand: product.brand,
            model: product.model,
            specsSource: product.specsSource,
            specsSourceUrl: product.specsSourceUrl,
            sourceKey: product.sourceKey,
            specs: product.specs,
          }}
        />

        <section className="rounded-xl border border-destructive/40 bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Hapus produk</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Menghapus produk ikut menghapus seluruh varian, penawaran, dan
            riwayat harganya. Tidak bisa dibatalkan. Ketik slug produk untuk
            memastikan kamu menghapus yang benar.
          </p>
          <form action={deleteProductAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="slug" value={product.slug} />
            <div className="space-y-2">
              <label htmlFor="konfirmasi" className="text-sm font-medium text-foreground">
                Ketik <span className="font-mono">{product.slug}</span>
              </label>
              <input
                id="konfirmasi"
                name="konfirmasi"
                required
                className="flex min-h-11 w-full min-w-64 rounded-lg border border-border-strong bg-card px-3 text-base text-foreground"
              />
            </div>
            <Button type="submit" variant="destructive">
              Hapus permanen
            </Button>
          </form>
        </section>
      </div>
    </Container>
  );
}
