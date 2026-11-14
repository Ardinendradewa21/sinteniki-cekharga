"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { pasteSpecAction } from "@/lib/scrape/actions";
import { SCRAPE_BRAND_LABELS, SCRAPE_BRANDS, type ScrapeBrand } from "@/lib/scrape/types";

const FIELD = "min-h-11 w-full rounded-lg border border-border-strong bg-card px-3 py-2 text-base text-foreground";

/**
 * Kotak tempel "Salin spesifikasi": menerima salinan dari bookmarklet
 * (spec-helper.ts), mengirimnya ke pasteSpecAction, lalu membuka sesi satu
 * model yang terbentuk supaya admin meninjau dan mengirimnya seperti hasil
 * tarik otomatis biasa.
 */
export function SpecPasteForm({ initialBrand }: { initialBrand: ScrapeBrand | null }) {
  const router = useRouter();
  const [brand, setBrand] = useState<ScrapeBrand>(initialBrand ?? "vivo");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await pasteSpecAction({ brand, text });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setText("");
      router.push(`/admin/import?tab=tarik&sesi=${result.sessionId}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="spec-paste-brand" className="block text-sm font-semibold text-foreground">
          Merek
        </label>
        <select
          id="spec-paste-brand"
          value={brand}
          onChange={(event) => setBrand(event.target.value as ScrapeBrand)}
          className={`${FIELD} sm:max-w-xs`}
        >
          {SCRAPE_BRANDS.map((key) => (
            <option key={key} value={key}>
              {SCRAPE_BRAND_LABELS[key].split(" (")[0]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="spec-paste-text" className="block text-sm font-semibold text-foreground">
          Hasil salinan
        </label>
        <textarea
          id="spec-paste-text"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="CEKHARGA-SPEK/1 …"
          spellCheck={false}
          aria-describedby={error ? "spec-paste-error" : undefined}
          aria-invalid={error ? true : undefined}
          className={`${FIELD} font-mono text-xs`}
        />
      </div>
      {error ? (
        <p id="spec-paste-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || text.trim().length === 0}>
        {pending ? "Membaca spesifikasi…" : "Baca spesifikasi"}
      </Button>
    </form>
  );
}
