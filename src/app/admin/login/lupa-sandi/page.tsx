import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/admin/reset-password-form";
import { Container } from "@/components/layout/container";

export const metadata: Metadata = {
  title: "Lupa Kata Sandi Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Lupa kata sandi admin (PB-48): kode ke email, lalu kata sandi baru. */
export default function AdminForgotPasswordPage() {
  return (
    <main id="konten-utama" className="flex min-h-svh flex-1 items-center bg-muted/40">
      <Container className="flex justify-center py-12">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <p className="mb-6 text-sm font-extrabold tracking-tight text-brand">CekHarga · Admin workspace</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Lupa kata sandi</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Kami kirim kode 6 digit ke email akunmu. Kode itu dipakai sekali untuk membuat kata sandi baru.
          </p>
          <div className="mt-6">
            <ResetPasswordForm />
          </div>
          <p className="mt-6 text-sm">
            <Link href="/admin/login" className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4">
              Kembali ke halaman masuk
            </Link>
          </p>
        </div>
      </Container>
    </main>
  );
}
