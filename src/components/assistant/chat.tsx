"use client";

import { useActionState, useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { AssistantResults } from "@/components/assistant/results";
import { ShareResultButton } from "@/components/assistant/share-result-button";
import { Button } from "@/components/ui/button";
import { sendChatMessage } from "@/lib/assistant/ai/chat-actions";
import { CHAT_START, type ChatState } from "@/lib/assistant/ai/chat-state";
import { formatIdr } from "@/lib/catalog/pricing";
import { ACTIVITY_LABELS, PRIORITY_LABELS, REQUIREMENT_LABELS } from "@/lib/assistant/needs";

/**
 * Percakapan asisten (PRD FR-06).
 *
 * Bentuknya chat biasa karena itu yang paling mudah dipahami: pengguna menulis,
 * asisten menjawab dan bertanya balik. Alur pertanyaan bertahap yang dulu
 * berupa formulir kini terjadi di dalam percakapan.
 *
 * Yang tetap dijaga dari versi sebelumnya, dan tidak boleh hilang hanya karena
 * tampilannya berubah:
 *
 * - Kartu kandidat berasal dari mesin deterministik, bukan dari model. Model
 *   tidak pernah menyebut nama produk maupun harga.
 * - Apa yang sudah ditangkap sistem selalu terlihat sebagai chip, jadi
 *   pengguna tahu persis atas dasar apa pencarian dilakukan.
 * - Tidak ada animasi mengetik palsu. Indikator hanya muncul selama permintaan
 *   benar-benar berjalan (PRD §8: loading mewakili proses nyata).
 */

const OPENER =
  "Halo. Ceritakan saja HP seperti apa yang kamu cari, atau langsung sebut budgetmu.";

export function AssistantChat({ isDemo }: { isDemo: boolean }) {
  const [state, action, pending] = useActionState<ChatState, FormData>(
    sendChatMessage,
    CHAT_START
  );

  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const kosong = state.messages.length === 0;

  // Menggulir ke pesan terbaru setelah giliran selesai.
  useEffect(() => {
    if (!kosong) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.messages.length, state.result, kosong]);

  const chips = ringkasKebutuhan(state);

  /**
   * Mengirim kalimat sebagai giliran percakapan biasa.
   *
   * Dipakai chip pilihan cepat dan tombol "cari sekarang". Keduanya sengaja
   * melewati jalur yang sama dengan mengetik manual: satu alur, satu state,
   * dan riwayatnya tetap jujur menampilkan apa yang dikirim pengguna.
   */
  const kirim = (teks: string) => {
    const input = formRef.current?.elements.namedItem(
      "pesan"
    ) as HTMLTextAreaElement | null;
    if (!input) return;
    input.value = teks;
    formRef.current?.requestSubmit();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      {/* Sapaan pembuka; bagian dari percakapan, bukan hiasan. */}
      <div className={kosong ? "py-6 text-center" : "hidden"}>
        <span className="inline-flex size-11 items-center justify-center rounded-pill bg-brand-muted text-brand">
          <HugeiconsIcon icon={AiMagicIcon} size={22} strokeWidth={1.8} aria-hidden />
        </span>
        <h1 className="mt-5 heading-page text-foreground">
          Mau cari HP seperti apa?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
          {OPENER}
        </p>
      </div>

      {!kosong ? (
        <h1 className="sr-only">Percakapan dengan asisten CekHarga</h1>
      ) : null}

      {/* Percakapan */}
      <div
        className={kosong ? "hidden" : "space-y-5"}
        aria-live="polite"
        aria-atomic="false"
      >
        {state.messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-xl rounded-br-sm bg-foreground px-4 py-3 text-sm leading-relaxed text-background"
                  : "max-w-[85%] rounded-xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground"
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {pending ? (
          <div className="flex justify-start">
            <div className="rounded-xl rounded-bl-sm border border-border bg-card px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="size-2 animate-pulse rounded-pill bg-muted-foreground" />
                Sedang memproses
              </span>
            </div>
          </div>
        ) : null}

        {state.error ? (
          <p role="alert" className="text-sm leading-relaxed text-warning">
            {state.error}
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {/* Yang sudah ditangkap sistem, selalu terlihat */}
      {chips.length > 0 && !state.result ? (
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-xs text-muted-foreground">Yang sudah saya catat</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {chips.map((c) => (
              <li
                key={c}
                className="rounded-pill border border-border bg-card px-3 py-1.5 text-xs text-foreground"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Pilihan cepat untuk pertanyaan tertutup */}
      {state.suggestions.length > 0 && !pending ? (
        <ul className="mt-5 flex flex-wrap gap-2">
          {state.suggestions.map((s) => (
            <li key={s}>
              <Button
                type="button"
                variant="outline"
                onClick={() => kirim(s)}
              >
                {s}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Kotak tulis */}
      {!state.result ? (
        <form
          ref={formRef}
          action={action}
          className="mt-6 rounded-xl border border-border bg-card shadow-sm"
        >
          <label htmlFor="pesan" className="sr-only">
            Tulis pesan untuk asisten
          </label>
          <textarea
            id="pesan"
            name="pesan"
            rows={1}
            maxLength={600}
            required
            placeholder={kosong ? "Contoh: budget 3 juta, buat main game" : "Tulis balasanmu"}
            /*
             * Satu baris, bukan dua. Terlihat di QA browser: rows={2} membuat
             * rongga kosong menganga antara teks dan baris tombol, sehingga
             * kotaknya tampak seperti gagal memuat sesuatu.
             */
            className="w-full resize-none bg-transparent px-5 pt-4 pb-1 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            onKeyDown={(e) => {
              // Enter mengirim, Shift+Enter baris baru. Kebiasaan chat.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-1 pb-3">
            <p className="min-w-0 text-xs text-muted-foreground">
              Percakapan tidak disimpan.
            </p>
            <Button
              type="submit"
              disabled={pending}
              className="shrink-0"
            >
              {pending ? "Mengirim" : "Kirim"}
              {pending ? null : (
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} aria-hidden />
              )}
            </Button>
          </div>
        </form>
      ) : null}

      {/*
        Jalan pintas. Pengguna berhak berhenti mengobrol kapan pun dan melihat
        apa yang ada dengan kebutuhan seadanya; asisten yang terus bertanya
        tanpa jalan keluar itu menjebak.
      */}
      {!state.result && chips.length > 0 && !pending ? (
        <div className="mt-4 text-center">
          <Button
            type="button"
            variant="link"
            onClick={() => kirim("Sudah cukup, langsung cari kandidatnya saja.")}
          >
            Sudah cukup, cari kandidat sekarang
          </Button>
        </div>
      ) : null}

      {/* Hasil pencarian: kartu dari mesin deterministik */}
      {state.result ? (
        <AssistantResults
          result={state.result}
          newConversationHref="/assistant"
          extraActions={<ShareResultButton href={state.result.shareHref} />}
        />
      ) : null}

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        {isDemo ? (
          <>
            <span className="font-semibold text-warning">Data demo.</span> Produk
            dan harganya masih data contoh, jangan dipakai acuan membeli.{" "}
          </>
        ) : null}
        Asisten mengumpulkan kebutuhanmu; kandidat dihitung dari data katalog,
        bukan dikarang.
      </p>
    </div>
  );
}

/** Ringkasan kebutuhan yang sudah tertangkap, dalam bahasa manusia. */
function ringkasKebutuhan(state: ChatState): string[] {
  const c = state.collected;
  const chips: string[] = [];

  if (c.budgetIdr !== null) chips.push(`Budget ${formatIdr(c.budgetIdr)}`);
  if (c.budgetIsHard !== null) {
    chips.push(c.budgetIsHard ? "Batas keras" : "Budget perkiraan");
  }
  for (const a of c.activities) chips.push(ACTIVITY_LABELS[a]);
  if (c.priority) chips.push(`Utamakan ${PRIORITY_LABELS[c.priority].toLowerCase()}`);
  for (const r of c.requirements) chips.push(REQUIREMENT_LABELS[r]);
  if (c.brands.length > 0) {
    chips.push(`${c.brandsOnly ? "Hanya" : "Suka"} ${c.brands.join(", ")}`);
  }
  if (c.avoidBrands.length > 0) chips.push(`Bukan ${c.avoidBrands.join(", ")}`);

  return chips;
}
