"use client";

import { useId, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CloudUploadIcon, Csv01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Area unggah berkas untuk halaman admin.
 *
 * Yang terlihat memang kotak bergaris putus-putus, tetapi elemen yang bekerja
 * tetap `<input type="file">` asli yang dibentangkan transparan menutupi kotak
 * itu. Alasannya bukan kemalasan:
 *
 * - Input tetap bisa dicapai dan dijalankan dengan keyboard, tanpa perlu
 *   menirukan perilaku tombol pakai handler tombol Enter/Spasi.
 * - Validasi bawaan browser (`required`) masih menempel pada elemen yang
 *   sungguhan terlihat oleh browser. Kalau inputnya disembunyikan dengan
 *   `display:none` atau dipotong `sr-only`, Chrome bisa menolak memfokuskannya
 *   saat form disubmit kosong, dan form jadi diam tanpa pesan apa pun.
 *
 * Seret-dan-lepas hanya jalan pintas tambahan; klik dan keyboard tetap jalur
 * utama, karena tidak semua orang bisa melakukan gerakan seret.
 */

export function FileDrop({
  id,
  name,
  accept = ".csv,text/csv",
  required,
  hint,
  label,
  lastModifiedName,
}: {
  id: string;
  name: string;
  accept?: string;
  required?: boolean;
  /** Keterangan kolom di bawah kotak; ikut dibacakan pembaca layar. */
  hint?: React.ReactNode;
  label: string;
  /** Nama hidden input untuk mengirim waktu modifikasi berkas dari browser. */
  lastModifiedName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const [picked, setPicked] = useState<{
    name: string;
    size: number;
    lastModified: string;
  } | null>(null);
  const [tolak, setTolak] = useState<string | null>(null);

  const terima = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      // Ditolak dengan alasan, bukan diam-diam diabaikan: berkas yang hilang
      // tanpa penjelasan membuat orang mengira aplikasinya rusak.
      setTolak(`"${file.name}" bukan berkas CSV. Yang diterima hanya .csv.`);
      setPicked(null);
      return;
    }
    setTolak(null);
    setPicked({
      name: file.name,
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString(),
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !inputRef.current) return;

    // Berkas hasil seret harus dipindahkan ke input aslinya, sebab yang ikut
    // terkirim saat form disubmit adalah isi input, bukan state React.
    const dt = new DataTransfer();
    dt.items.add(file);
    inputRef.current.files = dt.files;
    terima(file);
  };

  const kosongkan = () => {
    if (inputRef.current) inputRef.current.value = "";
    setPicked(null);
    setTolak(null);
  };

  return (
    <div className="space-y-2">
      {lastModifiedName ? (
        <input
          type="hidden"
          name={lastModifiedName}
          value={picked?.lastModified ?? ""}
        />
      ) : null}
      <span id={`${id}-label`} className="text-sm font-medium text-foreground">
        {label}
      </span>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          // Anak elemen ikut memicu dragleave; abaikan selama kursor masih di
          // dalam kotak, kalau tidak sorotannya berkedip-kedip.
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          "has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
          dragging
            ? "border-accent-warm bg-accent-warm-soft"
            : picked
              ? "border-accent-warm-strong/70 bg-accent-warm-soft/40"
              : "border-border-strong bg-muted/40 hover:border-accent-warm hover:bg-accent-warm-soft/50"
        )}
      >
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          aria-labelledby={`${id}-label`}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => terima(e.target.files?.[0])}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />

        {/* Dekorasi saja: klik harus tembus ke input di belakangnya. */}
        <div className="pointer-events-none flex flex-col items-center gap-3">
          <span
            className={cn(
              "flex size-12 items-center justify-center rounded-full transition-colors",
              picked
                ? "bg-accent-warm-strong text-white"
                : "bg-accent-warm-soft text-accent-warm-strong"
            )}
          >
            <HugeiconsIcon
              icon={picked ? Csv01Icon : CloudUploadIcon}
              size={24}
              strokeWidth={1.8}
              aria-hidden
            />
          </span>

          {picked ? (
            <span className="space-y-0.5">
              <span className="block text-sm font-semibold break-all text-foreground">
                {picked.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                {formatUkuran(picked.size)} &middot; klik atau seret berkas lain untuk mengganti
              </span>
            </span>
          ) : (
            <span className="space-y-0.5">
              <span className="block text-sm text-foreground">
                Seret berkas ke sini, atau{" "}
                <span className="font-semibold text-accent-warm-strong underline underline-offset-4">
                  pilih berkas
                </span>
              </span>
              <span className="block text-xs text-muted-foreground">Format .csv</span>
            </span>
          )}
        </div>
      </div>

      {/* Di luar kotak, supaya tidak tertutup input transparan di atasnya. */}
      {picked ? (
        <Button
          type="button"
          variant="link"
          onClick={kosongkan}
          className="text-muted-foreground hover:text-foreground"
        >
          Hapus berkas
        </Button>
      ) : null}

      {tolak ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {tolak}
        </p>
      ) : null}

      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}

      <span aria-live="polite" className="sr-only">
        {picked ? `Berkas terpilih: ${picked.name}` : "Belum ada berkas terpilih"}
      </span>
    </div>
  );
}

function formatUkuran(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}
