import * as React from "react";

import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

/**
 * Kerangka bagian halaman: judul, deskripsi opsional, aksi opsional, isi.
 *
 * CD-04: kepala seksi naik-pudar saat masuk layar (pola Calda: judul muncul
 * lebih dulu, isi menyusul lewat stagger-nya sendiri). `Reveal` tidak
 * menyembunyikan apa pun di HTML server, melewati elemen yang sudah terlihat
 * saat halaman dibuka (tidak menunda LCP), dan diam saat reduced motion.
 */
export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("py-14 md:py-20", className)}>
      <Container>
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="heading-section-lg text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </Reveal>
        <div className="mt-8">{children}</div>
      </Container>
    </section>
  );
}
