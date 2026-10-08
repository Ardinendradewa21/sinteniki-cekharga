import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="py-16 md:py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-muted-foreground">404</p>
        <h1 className="mt-2 heading-page text-foreground">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Alamat yang dibuka tidak ada di CekHarga. Bisa jadi tautannya salah
          ketik, atau halamannya memang belum pernah ada.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/">Kembali ke beranda</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/products">Buka katalog</Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}
