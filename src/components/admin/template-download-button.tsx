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
}: {
  content: string;
  filename: string;
  children: React.ReactNode;
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
    <Button type="button" variant="outline" onClick={unduh}>
      {children}
    </Button>
  );
}
