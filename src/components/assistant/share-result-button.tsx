"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Menyalin tautan hasil. Tautannya hanya berisi kebutuhan terstruktur (budget,
 * kegiatan, syarat), tidak pernah isi percakapan (PRD §10).
 */
export function ShareResultButton({ href }: { href: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
          setState("copied");
        } catch {
          setState("failed");
        }
      }}
    >
      <span aria-live="polite">
        {state === "copied" ? "Tautan disalin" : state === "failed" ? "Gagal menyalin" : "Salin tautan hasil"}
      </span>
    </Button>
  );
}
