import Link from "next/link";
import type { Metadata } from "next";

import { AssistantChat } from "@/components/assistant/chat";
import { Consultation } from "@/components/assistant/consultation";
import { Container } from "@/components/layout/container";
import { hasAiCredentials } from "@/lib/assistant/ai/client";
import { isDemoData } from "@/lib/catalog/queries";
import {
  buildNeedsHref,
  nextStep,
  parseNeeds,
  type UserNeeds,
} from "@/lib/assistant/needs";

export const metadata: Metadata = {
  title: "Tanya AI",
  description:
    "Ceritakan kebutuhanmu, lalu dapatkan kandidat beserta alasan, kompromi, dan sumbernya.",
};

export const dynamic = "force-dynamic";

/**
 * Asisten (PRD FR-06).
 *
 * Bentuk utamanya percakapan, karena itu yang paling mudah dipahami orang:
 * menulis, dijawab, ditanya balik. Pertanyaan bertahap yang dulu berupa
 * formulir kini terjadi di dalam obrolan, dan pilihan cepat hanya muncul saat
 * pertanyaannya memang tertutup.
 *
 * Pembagian peran tidak berubah sedikit pun, dan inilah yang membuat bentuk
 * percakapan tetap aman dipakai:
 *
 *   Model bahasa : mengobrol dan mengumpulkan kebutuhan.
 *   Kode         : menyaring kandidat, menghitung harga, menerapkan syarat
 *                  wajib, menyusun alasan dan kompromi.
 *
 * Model tidak pernah menyebut nama produk maupun harga, sebab ia tidak punya
 * akses katalog. FR-06 mensyaratkan syarat wajib disaring lewat logika
 * terstruktur, bukan janji prompt.
 *
 * Jalur formulir tetap ada di `?tanya=form` sebagai cadangan: dipakai kalau
 * kredensial model belum terpasang, atau kalau pengguna memang lebih suka
 * memilih daripada mengetik.
 */
export default async function AssistantPage({
  searchParams,
}: PageProps<"/assistant">) {
  const params = await searchParams;
  const pakaiForm = params.tanya === "form";
  const aiReady = hasAiCredentials();

  if (aiReady && !pakaiForm) {
    return (
      <Container className="py-8 md:py-12">
        <AssistantChat isDemo={isDemoData()} />
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          Lebih suka memilih daripada mengetik?{" "}
          <Link
            href="/assistant?tanya=form"
            className="font-medium text-brand underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
          >
            Jawab pertanyaan saja
          </Link>
        </p>
      </Container>
    );
  }

  return <FormFallback params={params} aiReady={aiReady} />;
}

/**
 * Jalur formulir bertahap.
 *
 * Seluruhnya Server Component dan berjalan tanpa JavaScript, jadi ini juga yang
 * menjaga halaman tetap berguna kalau model bahasa sedang tidak tersedia.
 */
function FormFallback({
  params,
  aiReady,
}: {
  params: Record<string, string | string[] | undefined>;
  aiReady: boolean;
}) {
  const needs = parseNeeds(params);
  const step = nextStep(needs);

  const clear = (overrides: Partial<UserNeeds>) => buildNeedsHref(needs, overrides);
  const answeredHrefs = {
    budgetIdr: clear({ budgetIdr: null, budgetIsHard: null }),
    budgetIsHard: clear({ budgetIsHard: null }),
    activities: clear({ activities: [] }),
    priority: clear({ priority: null }),
    requirements: clear({ requirements: [], requirementsAnswered: false }),
  };

  return (
    <Container className="py-10 md:py-14">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          Jelaskan kebutuhanmu
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
          Saya tanya beberapa hal, lalu tunjukkan kandidat yang ada beserta
          alasan dan komprominya.
        </p>
      </div>

      <div className="mt-10">
        <Consultation needs={needs} step={step} answeredHrefs={answeredHrefs} />
      </div>

      {aiReady ? (
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          Lebih suka bercerita?{" "}
          <Link
            href="/assistant"
            className="font-medium text-brand underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
          >
            Ngobrol dengan asisten
          </Link>
        </p>
      ) : (
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          Mode percakapan sedang tidak tersedia karena kredensial model belum
          terpasang. Pertanyaan di atas tetap berfungsi penuh.
        </p>
      )}

      {isDemoData() ? (
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-warning">Data demo.</span> Produk
          dan harganya masih data contoh, jangan dipakai acuan membeli.
        </p>
      ) : null}
    </Container>
  );
}
