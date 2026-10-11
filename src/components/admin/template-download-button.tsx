"use client";

import { Button } from "@/components/ui/button";

/**
 * Tombol unduh templat CSV. Isinya dibuat di server (fungsi `template*` di
 * `src/lib/import`) dan dikirim sebagai teks, jadi templat selalu mengikuti
 * kolom yang benar-benar dibaca importer.
 */
export function TemplateDownloadButton({
  content,
  filename,
  children,
  variant = "outline",
}: {
  content: string;
  filename: string;
  children: React.ReactNode;
  /** "default" untuk templat utama, "link" untuk format lama. */
  variant?: "default" | "outline" | "link";
}) {
  const unduh = () => {
    // BOM supaya Excel membaca UTF-8 dengan benar; parser CSV kita mengabaikannya.
    const blob = new Blob(["﻿", content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button type="button" variant={variant} onClick={unduh}>
      {children}
    </Button>
  );
}
