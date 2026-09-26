"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IMAGE_BASIS_NEEDS_NOTE,
  IMAGE_USAGE_BASES,
  IMAGE_USAGE_BASIS_LABELS,
  isImageUsageBasis,
} from "@/lib/import/image-rights";

/**
 * Pilihan dasar hak pakai foto + keterangan bukti, dipakai form impor.
 * Nilai dikirim sebagai `image_usage_basis` dan `image_usage_rights`.
 */
export function ImageRightsFields({ idPrefix, hint }: { idPrefix: string; hint: string }) {
  const [basis, setBasis] = useState("");
  const needsNote = isImageUsageBasis(basis) && IMAGE_BASIS_NEEDS_NOTE.has(basis);

  return (
    <div className="mt-5 space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-basis`}>Dasar hak pakai foto (opsional)</Label>
        <select
          id={`${idPrefix}-basis`}
          name="image_usage_basis"
          value={basis}
          onChange={(event) => setBasis(event.target.value)}
          className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Lewati foto (hanya data)</option>
          {IMAGE_USAGE_BASES.map((value) => (
            <option key={value} value={value}>
              {IMAGE_USAGE_BASIS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {basis ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-note`}>
            {needsNote ? "Bukti hak pakai (wajib)" : "Keterangan (opsional)"}
          </Label>
          <Input
            id={`${idPrefix}-note`}
            name="image_usage_rights"
            maxLength={500}
            required={needsNote}
            placeholder={
              needsNote
                ? "Contoh: Izin email tim Erafone, 2026-09-20 / CC BY 4.0"
                : "Boleh kosong"
            }
          />
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}
