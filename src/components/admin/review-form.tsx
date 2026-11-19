"use client";

import { useActionState, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/admin/actions";
import type { DraftActionResult, DraftRequest } from "@/lib/reviews/ai-draft-actions";
import type { VideoDraft } from "@/lib/reviews/ai-draft";

const INITIAL: ActionState = { error: null };

const FIELD = "min-h-11 w-full rounded-lg border border-border-strong bg-card px-3 py-2 text-base text-foreground";

export type ReviewFormValues = {
  aspect: "umum" | "kamera";
  variantId: string | null;
  isSponsored: boolean;
  verdict: string;
  goodFor: string;
  notFor: string;
  summary: string;
  strengths: string;
  limitations: string;
  testContext: string;
  timestamp: string;
};

type Note = { tone: "ok" | "warning" | "error"; text: string };

/**
 * Formulir kartu ulasan (RV-02), dipakai untuk menerbitkan dari kandidat video
 * dan mengubah ringkasan yang sudah ada.
 *
 * Bantuan AI hanya MENGISI kolom; tidak ada yang tersimpan sampai admin
 * memeriksa dan menekan tombol simpan (PRD FR-07). Tiga sumber:
 * - video: model menonton videonya (paling lengkap, paling lama dan mahal),
 * - transkrip: admin menempel transkrip YouTube (murah, cepat),
 * - rapikan: isian formulir saat ini ditata ulang ke format kartu.
 */
export function ReviewForm({
  action,
  draftAction,
  hasVideo,
  variants,
  initial,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** null bila kunci OpenRouter belum terpasang. */
  draftAction: ((request: DraftRequest) => Promise<DraftActionResult>) | null;
  hasVideo: boolean;
  variants: { id: string; label: string }[];
  initial: ReviewFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);
  const [drafting, startDraft] = useTransition();
  const [running, setRunning] = useState<DraftRequest["source"] | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  function field(name: string) {
    return formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  }

  function currentAspect(): string {
    return (formRef.current?.elements.namedItem("aspect") as RadioNodeList | null)?.value || initial.aspect;
  }

  /** Isi formulir saat ini sebagai bahan "Rapikan". */
  function currentText(): string {
    const parts: [string, string][] = [
      ["Intinya", field("verdict")?.value ?? ""],
      ["Cocok untuk", field("goodFor")?.value ?? ""],
      ["Kurang cocok untuk", field("notFor")?.value ?? ""],
      ["Ringkasan", field("summary")?.value ?? ""],
      ["Kelebihan", field("strengths")?.value ?? ""],
      ["Kekurangan", field("limitations")?.value ?? ""],
      ["Konteks pengujian", field("testContext")?.value ?? ""],
      ["Menit utama", field("timestamp")?.value ?? ""],
    ];
    return parts
      .filter(([, value]) => value.trim())
      .map(([label, value]) => `${label}:\n${value.trim()}`)
      .join("\n\n");
  }

  function fill(draft: VideoDraft) {
    const set = (name: string, value: string) => {
      const target = field(name);
      if (target) target.value = value;
    };
    const lines = (points: VideoDraft["kelebihan"]) => points.map((point) => (point.menit ? `${point.poin} [${point.menit}]` : point.poin)).join("\n");
    set("verdict", draft.intinya);
    set("goodFor", draft.cocok_untuk.join("\n"));
    set("notFor", draft.kurang_cocok.join("\n"));
    set("summary", draft.ringkasan);
    set("strengths", lines(draft.kelebihan));
    set("limitations", lines(draft.kekurangan));
    set("testContext", draft.konteks);
    set("timestamp", draft.menit);
    const sponsored = field("isSponsored") as HTMLInputElement | null;
    if (sponsored) sponsored.checked = draft.bersponsor;
    const radio = formRef.current?.querySelector<HTMLInputElement>(`input[name="aspect"][value="${draft.aspek}"]`);
    if (radio) radio.checked = true;
  }

  function runDraft(source: DraftRequest["source"]) {
    if (!draftAction || !formRef.current) return;
    const text = source === "transkrip" ? (transcriptRef.current?.value ?? "") : source === "rapikan" ? currentText() : undefined;
    // Draf baru mengganti isian; "Rapikan" memang menata ulang isian itu sendiri.
    if (source !== "rapikan" && (field("summary")?.value.trim() || field("verdict")?.value.trim())) {
      if (!window.confirm("Draf AI akan mengganti isian formulir saat ini. Lanjutkan?")) return;
    }
    setNote(null);
    setRunning(source);
    startDraft(async () => {
      const result = await draftAction({ source, aspect: currentAspect(), text });
      setRunning(null);
      if (!result.ok) {
        setNote({ tone: "error", text: result.error });
        return;
      }
      fill(result.draft);
      const extra = [result.draft.relevan ? null : "Menurut AI, bahan ini mungkin bukan ulasan produk ini.", result.draft.catatan || null].filter(Boolean);
      setNote({
        tone: result.draft.relevan && !result.draft.catatan ? "ok" : "warning",
        text: `Draf AI sudah mengisi formulir. Cocokkan dengan videonya, koreksi kalimatnya, lalu simpan.${extra.length ? ` Catatan: ${extra.join(" ")}` : ""}`,
      });
    });
  }

  const busy = drafting || pending;

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {draftAction ? (
        <section aria-labelledby="bantuan-ai" className="rounded-xl border border-border bg-muted/40 p-4">
          <h2 id="bantuan-ai" className="text-sm font-semibold text-foreground">
            Bantuan AI
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            AI mengisi formulir dalam format kartu. Tidak ada yang tersimpan sebelum kamu memeriksa dan menyimpan.
          </p>
          {/* RV-04: transkrip jadi jalur utama (draf dari video dimatikan untuk
              menghemat kredit), jadi kotaknya langsung terlihat, tidak dilipat. */}
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3">
            <Label htmlFor="transcript" className="text-sm font-semibold text-foreground">
              Transkrip video
            </Label>
            <p className="text-xs text-muted-foreground">
              Di YouTube: buka video, klik &ldquo;…lainnya&rdquo; di deskripsi, pilih &ldquo;Tampilkan transkrip&rdquo;, lalu salin semua teksnya
              beserta penanda waktunya. Penanda waktu dipakai untuk menit di tiap poin.
            </p>
            <textarea id="transcript" ref={transcriptRef} rows={5} maxLength={80_000} className={FIELD} placeholder="0:00 Halo semua..." />
            <Button type="button" variant="outline" onClick={() => runDraft("transkrip")} disabled={busy}>
              {running === "transkrip" ? "Membaca transkrip…" : "Buat draf dari transkrip"}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasVideo ? (
              <Button type="button" variant="outline" onClick={() => runDraft("video")} disabled={busy}>
                {running === "video" ? "AI sedang menonton video…" : "Buat draf dari video"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => runDraft("rapikan")} disabled={busy}>
              {running === "rapikan" ? "Merapikan…" : "Rapikan isian dengan AI"}
            </Button>
            <p className="text-xs text-muted-foreground">Rapikan: menata isian formulir saat ini ke format kartu tanpa menambah isi.</p>
          </div>

          {running === "video" ? (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              Bisa sampai empat menit untuk video panjang. Jangan tutup halaman ini.
            </p>
          ) : null}
          {note ? (
            <p
              role={note.tone === "error" ? "alert" : "status"}
              className={note.tone === "error" ? "mt-3 text-sm text-destructive" : note.tone === "warning" ? "mt-3 text-sm text-warning" : "mt-3 text-sm text-foreground"}
            >
              {note.text}
            </p>
          ) : null}
        </section>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">Aspek yang diulas</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: "umum", label: "Ulasan keseluruhan", hint: "Pemakaian harian, performa, baterai, layar" },
            { value: "kamera", label: "Ulasan kamera", hint: "Hasil foto dan video" },
          ].map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer gap-3 rounded-lg border border-border bg-card p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-muted/40"
            >
              <input type="radio" name="aspect" value={option.value} defaultChecked={option.value === initial.aspect} className="mt-1 size-4 accent-[var(--brand)]" />
              <span>
                <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="verdict">Intinya</Label>
        <Input id="verdict" name="verdict" required minLength={10} maxLength={200} defaultValue={initial.verdict} />
        <p className="text-xs text-muted-foreground">
          Satu kalimat kesimpulan reviewer: untuk siapa HP ini dan apa kompromi utamanya. Tampil paling atas di kartu.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="goodFor">Cocok untuk</Label>
          <textarea id="goodFor" name="goodFor" rows={3} maxLength={300} defaultValue={initial.goodFor} className={FIELD} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notFor">Kurang cocok untuk</Label>
          <textarea id="notFor" name="notFor" rows={3} maxLength={300} defaultValue={initial.notFor} className={FIELD} />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">Satu label per baris, maksimal 3, 2 sampai 4 kata. Mis. &ldquo;Pekerjaan kantor&rdquo;. Boleh kosong.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="strengths">Kelebihan menurut reviewer</Label>
          <textarea id="strengths" name="strengths" rows={5} maxLength={2000} defaultValue={initial.strengths} className={FIELD} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="limitations">Kekurangan menurut reviewer</Label>
          <textarea id="limitations" name="limitations" rows={5} maxLength={2000} defaultValue={initial.limitations} className={FIELD} />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Maksimal 4 poin per sisi, satu per baris, sekitar 12 kata. Kata kunci di depan, menit video di akhir dalam kurung siku:
          &ldquo;Baterai: tahan 19 jam di PCMark [4:12]&rdquo;.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary">Ringkasan lengkap</Label>
        <textarea id="summary" name="summary" rows={5} required minLength={40} maxLength={1200} defaultValue={initial.summary} className={FIELD} />
        <p className="text-xs text-muted-foreground">
          Dilipat di kartu untuk pembaca yang ingin detail. Tulis ulang dengan kalimat sendiri, jangan menyalin ucapan reviewer. Tanpa skor atau
          &ldquo;terbaik&rdquo;.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="testContext">Konteks pengujian</Label>
          <Input id="testContext" name="testContext" maxLength={300} defaultValue={initial.testContext} placeholder="Mis. pemakaian 2 minggu, main game 1 jam" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timestamp">Video mulai dari menit</Label>
          <Input id="timestamp" name="timestamp" maxLength={8} defaultValue={initial.timestamp} placeholder="Mis. 4:35" inputMode="numeric" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="variantId">Berlaku untuk</Label>
        <select id="variantId" name="variantId" defaultValue={initial.variantId ?? ""} className={FIELD}>
          <option value="">Seluruh varian</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              Varian {variant.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm text-foreground">
        <input type="checkbox" name="isSponsored" defaultChecked={initial.isSponsored} className="size-5 accent-[var(--brand)]" />
        Video ini bersponsor atau disebut kerja sama (ditampilkan ke pembaca)
      </label>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={busy}>
        {pending ? "Menyimpan…" : submitLabel}
      </Button>
    </form>
  );
}
