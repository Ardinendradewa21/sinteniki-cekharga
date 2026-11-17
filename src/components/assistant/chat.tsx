"use client";

import Link from "next/link";
import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, RefreshIcon } from "@hugeicons/core-free-icons";

import { AssistantResults } from "@/components/assistant/results";
import { ProductMiniCards } from "@/components/assistant/product-mini-cards";
import { ShareResultButton } from "@/components/assistant/share-result-button";
import { ArrivalStagger } from "@/components/motion/arrival-stagger";
import { Button } from "@/components/ui/button";
import { sendChatMessage } from "@/lib/assistant/ai/chat-actions";
import { CHAT_START, type ChatMessage, type ChatState } from "@/lib/assistant/ai/chat-state";
import { formatIdr } from "@/lib/catalog/pricing";
import { ACTIVITY_LABELS, PRIORITY_LABELS, REQUIREMENT_LABELS } from "@/lib/assistant/needs-options";
import { cn } from "@/lib/utils";

/**
 * Percakapan Tanya AI (PRD FR-06, VD-08).
 *
 * Bentuknya mengikuti chatbot yang sudah dikenal (Claude, ChatGPT): jawaban
 * asisten berupa teks polos dengan penanda kecil di kiri, pesan pengguna
 * berupa gelembung di kanan, kotak tulis menempel di bawah layar, dan kartu
 * hasil menempel tepat di bawah jawaban yang membahasnya.
 *
 * Layar awal: foto scene di belakang judul (zona --veil-text) dan kotak tulis
 * di panel kaca berteks bersama Quick Start (DESIGN.md §7): chip budget dan
 * kegiatan MENGISI kotak tulis, tidak langsung mengirim, dan contoh
 * pertanyaan memperlihatkan bahwa asisten juga bisa membandingkan, mengecek
 * harga, dan menjawab pertanyaan umum.
 *
 * Yang dijaga dari versi sebelumnya:
 * - Kartu kandidat dan kartu produk berasal dari data katalog, bukan model;
 *   nama dan harga di balasan diperiksa validator di server.
 * - Apa yang sudah ditangkap sistem selalu terlihat ("Dicatat: ...").
 * - Indikator memuat hanya selama permintaan benar-benar berjalan (PRD §8),
 *   tanpa animasi mengetik palsu.
 * - Gagal = pesan galat + tombol "Coba lagi" (PRD FR-06).
 */

const BUDGET_CHIPS = [
  { label: "± 2 juta", text: "budget sekitar 2 juta" },
  { label: "± 3 juta", text: "budget sekitar 3 juta" },
  { label: "± 5 juta", text: "budget sekitar 5 juta" },
  { label: "8 juta ke atas", text: "budget 8 juta ke atas" },
] as const;

const USE_CHIPS = [
  { label: "Main game", text: "main game" },
  { label: "Foto dan video", text: "foto dan video" },
  { label: "Kerja dan multitasking", text: "kerja" },
  { label: "Buat orang tua", text: "buat orang tua, yang simpel" },
] as const;

const EXAMPLES = [
  "Bandingkan Redmi Note 17 dan OPPO A6 Pro buat foto",
  "Harga iPhone 17 sekarang berapa?",
  "AMOLED sama IPS bedanya apa?",
] as const;

function composeQuickStart(budget: string | null, uses: readonly string[]): string {
  if (!budget && uses.length === 0) return "";
  const parts = ["Cari HP"];
  if (uses.length) parts.push(`buat ${uses.join(" dan ")}`.replace("buat buat", "buat"));
  if (budget) parts.push(budget);
  return parts.join(", ").replace("Cari HP, buat", "Cari HP buat");
}

export function AssistantChat({
  isDemo,
  initialMessage = "",
  backdrop,
}: {
  isDemo: boolean;
  /**
   * Kalimat dari kotak isian beranda (`?pesan=`). Hanya mengisi kotak tulis,
   * tidak dikirim otomatis: model baru dipanggil setelah pengguna sendiri
   * menekan kirim (aturan System Design 1).
   */
  initialMessage?: string;
  /** Foto scene (Server Component) untuk layar awal. */
  backdrop?: ReactNode;
}) {
  const [state, action, pending] = useActionState<ChatState, FormData>(sendChatMessage, CHAT_START);
  // Pesan pengguna tampil seketika selama server memproses, termasuk pesan
  // pertama yang memindahkan layar awal ke tampilan percakapan.
  const [messages, addOptimistic] = useOptimistic(state.messages, (current: ChatMessage[], text: string) => {
    const last = current.at(-1);
    // "Coba lagi": pesan yang gagal sudah ada di riwayat.
    if (last?.role === "user" && last.content === text) return current;
    return [...current, { role: "user" as const, content: text }];
  });
  const [budget, setBudget] = useState<string | null>(null);
  const [uses, setUses] = useState<string[]>([]);

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const retryRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const kosong = messages.length === 0;
  const [, startWrite] = useTransition();
  const sentTicket = useRef<string | null>(null);
  // Tahap 2 (VD-08): kartu sudah tampil, minta penjelasannya. Sekali per tiket.
  const waitingWrite = state.pendingWrite !== null;

  useEffect(() => {
    const ticket = state.pendingWrite;
    if (!ticket || pending || sentTicket.current === ticket) return;
    sentTicket.current = ticket;
    const formData = new FormData();
    formData.set("fase", "tulis");
    formData.set("tiket", ticket);
    startWrite(() => action(formData));
  }, [state.pendingWrite, pending, action]);

  // Diisi lewat ref, bukan defaultValue: reset form setelah kirim akan
  // mengembalikan defaultValue, sehingga kalimat awal muncul lagi.
  useEffect(() => {
    if (!initialMessage) return;
    const input = inputRef.current;
    if (!input || input.value) return;
    input.value = initialMessage;
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
    input.focus();
  }, [initialMessage]);

  // Menggulir ke pesan terbaru setelah giliran selesai atau saat menunggu.
  useEffect(() => {
    if (!kosong) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, state.result, state.products, pending, kosong]);

  function autoSize() {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
  }

  function setInput(text: string) {
    const input = inputRef.current;
    if (!input) return;
    input.value = text;
    autoSize();
  }

  /** Mengirim kalimat sebagai giliran biasa (chip dan "Coba lagi" lewat jalur yang sama). */
  const kirim = (teks: string, ulang = false) => {
    setInput(teks);
    if (retryRef.current) retryRef.current.value = ulang ? "ya" : "";
    formRef.current?.requestSubmit();
  };

  const toggleUse = (text: string) => {
    const next = uses.includes(text) ? uses.filter((value) => value !== text) : [...uses, text];
    setUses(next);
    setInput(composeQuickStart(budget, next));
    inputRef.current?.focus();
  };
  const toggleBudget = (text: string) => {
    const next = budget === text ? null : text;
    setBudget(next);
    setInput(composeQuickStart(next, uses));
    inputRef.current?.focus();
  };

  const noted = ringkasKebutuhan(state);
  const now = new Date();

  const composer = (
    <form
      ref={formRef}
      action={(formData) => {
        const text = String(formData.get("pesan") ?? "").trim();
        if (text) addOptimistic(text);
        action(formData);
        // Kosongkan kotak tulis segera; pesan sudah tampil di percakapan.
        requestAnimationFrame(() => {
          setInput("");
          if (retryRef.current) retryRef.current.value = "";
        });
      }}
      className={cn(
        "glass-text glass-float rounded-3xl p-2",
        kosong ? "" : "sticky bottom-4 z-30 mt-6"
      )}
    >
      {!kosong && noted.length > 0 ? (
        <p className="px-3 pt-1 pb-1.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Dicatat:</span> {noted.join(" · ")}
        </p>
      ) : null}
      <label htmlFor="pesan" className="sr-only">
        Tulis pesan untuk asisten
      </label>
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          id="pesan"
          name="pesan"
          rows={1}
          maxLength={600}
          required
          placeholder={
            kosong
              ? "Tulis kebutuhan atau pertanyaanmu"
              : state.result
                ? "Ubah pencarian, mis. yang lebih murah"
                : "Tulis pesanmu"
          }
          onInput={autoSize}
          className="min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          onKeyDown={(event) => {
            // Enter mengirim, Shift+Enter baris baru. Kebiasaan chat.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!pending && !waitingWrite) formRef.current?.requestSubmit();
            }
          }}
        />
        <input ref={retryRef} type="hidden" name="ulang" defaultValue="" />
        <Button type="submit" size="icon" disabled={pending || waitingWrite} aria-label="Kirim pesan" className="mb-0.5 shrink-0 rounded-full">
          <HugeiconsIcon icon={ArrowUp01Icon} size={20} strokeWidth={2.2} aria-hidden />
        </Button>
      </div>
    </form>
  );

  if (kosong) {
    return (
      <div className="relative isolate -mt-(--header-h) flex min-h-[calc(100svh-4rem)] flex-col justify-center pt-[calc(var(--header-h)+2rem)] pb-12">
        {backdrop}
        <div className="mx-auto w-full max-w-2xl px-4">
          <h1 className="text-center text-3xl leading-tight font-extrabold tracking-tight text-foreground sm:text-4xl">
            Mau cari HP seperti apa?
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-center text-base leading-relaxed text-foreground">
            Ceritakan kebutuhanmu, sebut dua HP untuk dibandingkan, atau tanya soal spesifikasi. Jawaban harga dan produk
            diambil dari data katalog CekHarga.
          </p>

          <div className="mt-8">{composer}</div>

          {/* Quick Start: chip mengisi kotak tulis, tidak langsung mengirim. */}
          <div className="glass-text mt-4 space-y-4 rounded-3xl p-4 sm:p-5">
            <QuickRow label="Budget">
              {BUDGET_CHIPS.map((chip) => (
                <QuickChip key={chip.text} pressed={budget === chip.text} onClick={() => toggleBudget(chip.text)}>
                  {chip.label}
                </QuickChip>
              ))}
            </QuickRow>
            <QuickRow label="Dipakai untuk">
              {USE_CHIPS.map((chip) => (
                <QuickChip key={chip.text} pressed={uses.includes(chip.text)} onClick={() => toggleUse(chip.text)}>
                  {chip.label}
                </QuickChip>
              ))}
            </QuickRow>
            <div>
              <p className="text-xs font-semibold text-foreground">Atau coba tanya</p>
              <ul className="mt-2 flex flex-col gap-1">
                {EXAMPLES.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      onClick={() => {
                        setInput(example);
                        inputRef.current?.focus();
                      }}
                      className="min-h-11 w-full cursor-pointer rounded-xl px-3 text-left text-sm text-foreground transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-foreground">
            Lebih suka memilih daripada mengetik?{" "}
            <Link href="/assistant?tanya=form" className="font-semibold text-brand-text underline underline-offset-4 hover:text-foreground">
              Jawab pertanyaan saja
            </Link>
          </p>
          {isDemo ? (
            <p className="mt-2 text-center text-xs text-warning">Data demo: produk dan harga masih contoh.</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6 sm:px-6 md:py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-base font-bold text-foreground">Tanya AI</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/assistant">Percakapan baru</Link>
        </Button>
      </div>

      <div className="mt-4 space-y-6" aria-live="polite" aria-atomic="false">
        {/* Baris penjelasan yang sedang ditulis memakai kunci yang sama dengan
            pesan yang menggantikannya, jadi kartunya tidak dipasang ulang. */}
        {(waitingWrite ? [...messages, { role: "assistant" as const, content: "" }] : messages).map((message, index) =>
          message.role === "user" ? (
            <div key={`u-${index}`} className="flex justify-end">
              <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-muted px-4 py-2.5 text-base leading-relaxed whitespace-pre-wrap text-foreground">
                {message.content}
              </p>
            </div>
          ) : (
            <div key={`a-${index}`} className="flex gap-3">
              <AssistantMark />
              <div className="min-w-0 flex-1">
                {message.content ? (
                  <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground">{message.content}</p>
                ) : (
                  <p role="status" className="flex items-center gap-2 pt-1.5 text-sm text-muted-foreground">
                    <span className="size-2 animate-pulse rounded-full bg-brand" aria-hidden />
                    Data sudah ketemu, menulis penjelasannya
                  </p>
                )}

                {state.products && state.productsIndex === index ? (
                  <ArrivalStagger key={`p-${index}`}>
                    <ProductMiniCards products={state.products} compareHref={state.productsCompareHref} now={now} />
                  </ArrivalStagger>
                ) : null}

                {state.result && state.resultIndex === index ? (
                  <ArrivalStagger key={`r-${index}`}>
                    {state.compareHref && !pending ? (
                      <Button asChild variant="outline" className="mt-4">
                        <Link href={state.compareHref}>Buka perbandingan lengkap</Link>
                      </Button>
                    ) : null}
                    <AssistantResults
                      compact
                      result={state.result}
                      newConversationHref="/assistant"
                      extraActions={<ShareResultButton href={state.result.shareHref} />}
                    />
                  </ArrivalStagger>
                ) : null}

                {index === messages.length - 1 && state.suggestions.length > 0 && !pending && !waitingWrite ? (
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label={state.result ? "Lanjutkan atau sempurnakan" : "Pilihan jawaban"}>
                    {state.suggestions.map((suggestion) => (
                      <li key={suggestion}>
                        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => kirim(suggestion)}>
                          {suggestion}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )
        )}

        {pending && !waitingWrite ? (
          <div className="flex gap-3" role="status">
            <AssistantMark />
            <p className="flex items-center gap-2 pt-1.5 text-sm text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-brand" aria-hidden />
              Membaca pesanmu dan mengecek katalog
            </p>
          </div>
        ) : null}

        {state.error && !pending ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/40 bg-warning-muted px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-foreground">{state.error}</p>
            {state.retryText ? (
              <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => kirim(state.retryText!, true)}>
                <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={2} aria-hidden />
                Coba lagi
              </Button>
            ) : null}
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {composer}

      <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
        {isDemo ? <span className="font-semibold text-warning">Data demo. </span> : null}
        Percakapan tidak disimpan. Produk dan harga diambil dari katalog CekHarga; AI bisa keliru, cek halaman produknya.
      </p>
    </div>
  );
}

function AssistantMark() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-extrabold text-primary-foreground"
    >
      CH
    </span>
  );
}

function QuickRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function QuickChip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "min-h-11 cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        pressed ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

/** Ringkasan kebutuhan yang sudah tertangkap, dalam bahasa manusia. */
function ringkasKebutuhan(state: ChatState): string[] {
  const c = state.collected;
  const chips: string[] = [];

  if (c.budgetIdr !== null) {
    chips.push(c.budgetIsHard ? `Maksimal ${formatIdr(c.budgetIdr)}` : `Sekitar ${formatIdr(c.budgetIdr)}`);
  }
  for (const a of c.activities) chips.push(ACTIVITY_LABELS[a]);
  c.priorities.forEach((p, i) => {
    chips.push(`${i === 0 ? "Utamakan" : "Lalu"} ${PRIORITY_LABELS[p].toLowerCase()}`);
  });
  for (const r of c.requirements) chips.push(REQUIREMENT_LABELS[r]);
  if (c.brands.length > 0) {
    chips.push(`${c.brandsOnly ? "Hanya" : "Suka"} ${c.brands.join(", ")}`);
  }
  if (c.avoidBrands.length > 0) chips.push(`Bukan ${c.avoidBrands.join(", ")}`);

  return chips;
}
