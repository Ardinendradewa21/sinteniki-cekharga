import Link from "next/link";
import type { Metadata } from "next";

import { ImportForm } from "@/components/admin/import-form";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Impor Dataset",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireAdmin();

  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Impor Dataset
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Mengisi spesifikasi produk dari berkas CSV. Semua hasil impor masuk
            sebagai draft dan tidak langsung tampil ke publik.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/products">Kelola produk</Link>
        </Button>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-warning-muted p-5">
        <p className="text-sm font-semibold text-warning">
          Yang tidak ikut diimpor
        </p>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground">
          <li>
            Harga. Kolom harga di dataset ini berisi harga referensi
            internasional dengan mata uang campur, termasuk Rupee India yang
            simbolnya mirip Rupiah. Harga hanya boleh berasal dari penawaran
            marketplace yang dicatat beserta waktu pemeriksaannya.
          </li>
          <li>
            Perangkat selain smartphone. Tablet dan jam tangan dilewati dengan
            alasan yang dinyatakan, bukan disimpan diam-diam.
          </li>
          <li>
            Ulasan reviewer. Kurasinya manual dari channel pilihan, tidak pernah
            ditarik otomatis.
          </li>
        </ul>
      </div>

      <div className="mt-8">
        <ImportForm />
      </div>
    </Container>
  );
}
