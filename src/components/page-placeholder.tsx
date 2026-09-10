import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

import { Container } from "@/components/layout/container";

/**
 * Placeholder halaman yang rutenya sudah ada tapi isinya belum dibangun.
 *
 * PRD §4: "Rekomendasi atau fitur yang belum tersedia harus dinyatakan jelas,
 * bukan dipalsukan sebagai kontrol aktif." Halaman ini menjelaskan apa yang akan
 * ada dan kapan, tanpa menampilkan kontrol yang tidak berfungsi.
 *
 * Rute-rute ini tetap dibuat sejak awal supaya navigasi di header dan footer
 * benar-benar berfungsi (PRD §4: hanya tampilkan navigasi yang punya tujuan).
 */
export function PagePlaceholder({
  title,
  intent,
  sprint,
}: {
  title: string;
  /** Apa yang akan dilakukan halaman ini, mengikuti PRD. */
  intent: string;
  /** Sprint frontend yang akan mengisinya. */
  sprint: string;
}) {
  return (
    <Container className="py-16 md:py-24">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {intent}
        </p>

        <div className="mt-8 flex items-start gap-3 rounded-xl border border-border bg-card p-5">
          <HugeiconsIcon
            icon={InformationCircleIcon}
            size={20}
            strokeWidth={1.8}
            className="mt-0.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold text-foreground">
              Halaman ini belum dibangun
            </p>
            <p className="mt-1 text-muted-foreground">
              Isinya dikerjakan pada {sprint}. Rutenya sudah ada supaya navigasi
              tidak menuju halaman yang hilang, tetapi belum ada kontrol atau
              data yang bisa dipakai di sini.
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
