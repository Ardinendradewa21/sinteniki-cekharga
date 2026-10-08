import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

/**
 * 404 khusus halaman detail produk (PRD FR-03: "slug tidak ditemukan mempunyai
 * state 404 yang benar").
 *
 * Pesannya sengaja spesifik: pengguna yang sampai di sini kemungkinan mengikuti
 * tautan lama atau salah ketik slug, jadi jalan keluarnya adalah katalog, bukan
 * beranda.
 */
export default function ProductNotFound() {
  return (
    <Container className="py-16 md:py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-muted-foreground">404</p>
        <h1 className="mt-2 heading-page text-foreground">
          Produk tidak ditemukan
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Tidak ada produk terpublikasi dengan alamat itu. Bisa jadi tautannya
          sudah lama, atau produknya belum dipublikasikan di katalog.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/products">Buka katalog</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Kembali ke beranda</Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}
