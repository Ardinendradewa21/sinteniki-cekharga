import Link from "next/link";
import type { Metadata } from "next";

import { ProductForm } from "@/components/admin/product-form";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { createProductAction } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Tambah Produk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  // Gerbang tetap dipanggil walau form-nya sendiri juga memeriksa saat dikirim.
  await requireAdmin();

  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Tambah Produk
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Produk baru selalu tersimpan sebagai draft dan tidak langsung tampil
            ke publik. Terbitkan setelah variannya lengkap dan datanya ditinjau.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/products">Kembali</Link>
        </Button>
      </div>

      <div className="mt-8">
        <ProductForm action={createProductAction} submitLabel="Simpan sebagai draft" />
      </div>
    </Container>
  );
}
