import type { Metadata } from "next";

import { ScrapeWorkbench } from "@/components/admin/scrape-workbench";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Tarik Data Otomatis",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ScrapePage() {
  await requireAdmin();

  return (
    <Container className="py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
        Tarik Data Otomatis
      </h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Daftar model dan harga per varian diambil dari situs resmi merek,
        spesifikasinya dari GSMArena. Semua hasil dicek di pratinjau lebih dulu,
        lalu dikirim ke Pusat Impor sebagai batch pratinjau: tidak ada yang ditulis ke
        katalog sebelum kamu menerapkannya, dan produk baru tetap draft.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-warning-muted p-5">
        <p className="text-sm font-semibold text-warning">Batasan yang perlu diketahui</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground">
          <li>
            Harga berasal dari teks di situs resmi pada saat diambil. Situs resmi
            juga memuat model lama; harganya bisa jadi harga peluncuran, jadi
            periksa temuan kuning sebelum menyimpan.
          </li>
          <li>
            Pengambilan sengaja pelan dan berhenti bila situs sumber meminta
            verifikasi anti-bot. Verifikasi itu tidak ditembus.
          </li>
          <li>
            Produk yang sudah terbit tidak diturunkan menjadi draft; hanya
            spesifikasinya yang diperbarui.
          </li>
        </ul>
      </div>

      <div className="mt-6">
        <ScrapeWorkbench />
      </div>
    </Container>
  );
}
