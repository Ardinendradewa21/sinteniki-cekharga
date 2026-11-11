import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/admin/login-form";
import { Container } from "@/components/layout/container";
import { getSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Masuk Admin",
  // Halaman internal, jangan sampai terindeks.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Halaman masuk admin (PRD FR-07).
 *
 * Sengaja polos dan tidak menjelaskan apa pun tentang isi di baliknya. Halaman
 * masuk yang menceritakan fitur admin hanya membantu orang yang tidak berhak.
 */
export default async function AdminLoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  const params = await searchParams;
  const reason = typeof params.alasan === "string" ? params.alasan : null;

  // Sudah masuk dan memang admin? Tidak perlu melihat form ini lagi.
  const session = await getSession();

  return (
    <main id="konten-utama" className="flex min-h-svh flex-1 items-center bg-muted/40">
      <Container className="flex justify-center py-12">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <p className="mb-6 text-sm font-extrabold tracking-tight text-brand">
            CekHarga · Admin workspace
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Masuk Admin
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Halaman ini untuk pengelola data CekHarga.
          </p>

          {reason === "bukan-admin" && session ? (
            <div className="mt-6 rounded-xl border border-border bg-warning-muted p-4">
              <p className="text-sm font-semibold text-warning">
                Akun ini belum diberi akses admin
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                Kamu berhasil masuk sebagai {session.email}, tetapi akun itu belum
                terdaftar sebagai pengelola. Hubungi pemilik proyek untuk
                mendapatkan akses.
              </p>
            </div>
          ) : null}

          {reason === "sandi-diganti" ? (
            <p role="status" className="mt-6 rounded-xl border border-border bg-brand-muted p-4 text-sm leading-relaxed text-foreground">
              Kata sandi baru sudah tersimpan. Masuk dengan kata sandi itu.
            </p>
          ) : null}

          <div className="mt-6">
            <LoginForm />
          </div>
          <p className="mt-4 text-sm">
            <Link
              href="/admin/login/lupa-sandi"
              className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4"
            >
              Lupa kata sandi?
            </Link>
          </p>
        </div>
      </Container>
    </main>
  );
}
