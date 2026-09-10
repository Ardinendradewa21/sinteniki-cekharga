import Form from "next/form";
import Link from "next/link";

import { Composer, OptionPill } from "@/components/assistant/composer";
import { Input } from "@/components/ui/input";
import { formatIdr } from "@/lib/catalog/pricing";
import {
  ACTIVITIES,
  ACTIVITY_LABELS,
  NEEDS_PARAM,
  PRIORITIES,
  PRIORITY_LABELS,
  REQUIREMENTS,
  REQUIREMENT_LABELS,
  type NeedsStep,
  type UserNeeds,
} from "@/lib/assistant/needs";

/**
 * Alur konsultasi (PRD FR-06 dan §8).
 *
 * Tata letaknya mengikuti referensi antarmuka Claude: satu pertanyaan sebagai
 * fokus tunggal di dalam composer, ruang kosong dibiarkan lega, dan jawaban yang
 * sudah masuk mengendap menjadi chip ringkas di atasnya alih-alih menumpuk
 * sebagai gelembung percakapan panjang.
 *
 * Aturan produk yang tetap dijaga dari sebelumnya:
 *
 * - Satu pertanyaan pada satu waktu. PRD melarang kuesioner panjang sekaligus
 *   dan melarang menanyakan ulang yang sudah dijawab.
 * - Budget punya pertanyaan lanjutan terpisah soal apakah itu batas keras,
 *   karena PRD meminta hal yang ambigu ditanyakan, bukan ditebak.
 * - Semua kontrol adalah form dan tautan biasa, jadi tetap Server Component
 *   tanpa JavaScript dan jawabannya tersimpan di URL.
 *
 * Yang sengaja tidak ada: animasi mengetik atau streaming. Belum ada proses yang
 * berjalan di baliknya, dan PRD meminta loading mewakili proses nyata.
 */

/** Menjaga jawaban yang sudah ada saat form langkah berikutnya dikirim. */
function PreservedFields({
  needs,
  omit = [],
}: {
  needs: UserNeeds;
  omit?: (keyof UserNeeds)[];
}) {
  const fields: { name: string; value: string }[] = [];

  if (needs.budgetIdr !== null && !omit.includes("budgetIdr")) {
    fields.push({ name: NEEDS_PARAM.budget, value: String(needs.budgetIdr) });
  }
  if (needs.budgetIsHard !== null && !omit.includes("budgetIsHard")) {
    fields.push({
      name: NEEDS_PARAM.budgetIsHard,
      value: needs.budgetIsHard ? "ya" : "tidak",
    });
  }
  if (!omit.includes("activities")) {
    for (const activity of needs.activities) {
      fields.push({ name: NEEDS_PARAM.activities, value: activity });
    }
  }
  if (!omit.includes("requirements")) {
    for (const requirement of needs.requirements) {
      fields.push({ name: NEEDS_PARAM.requirements, value: requirement });
    }
  }
  if (needs.requirementsAnswered && !omit.includes("requirementsAnswered")) {
    fields.push({ name: NEEDS_PARAM.requirementsAnswered, value: "ya" });
  }
  if (needs.priority !== null && !omit.includes("priority")) {
    fields.push({ name: NEEDS_PARAM.priority, value: needs.priority });
  }

  return (
    <>
      {fields.map((field, index) => (
        <input
          key={`${field.name}-${field.value}-${index}`}
          type="hidden"
          name={field.name}
          value={field.value}
        />
      ))}
    </>
  );
}

/** Jawaban yang sudah masuk, ringkas dan bisa diklik untuk diubah. */
function AnsweredChips({
  needs,
  answeredHrefs,
}: {
  needs: UserNeeds;
  answeredHrefs: Partial<Record<keyof UserNeeds, string>>;
}) {
  const chips: { key: string; text: string; href: string }[] = [];

  if (needs.budgetIdr !== null) {
    chips.push({
      key: "budget",
      text: `Budget ${formatIdr(needs.budgetIdr)}`,
      href: answeredHrefs.budgetIdr ?? "/assistant",
    });
  }
  if (needs.budgetIsHard !== null) {
    chips.push({
      key: "budget-hard",
      text: needs.budgetIsHard ? "Batas keras" : "Budget perkiraan",
      href: answeredHrefs.budgetIsHard ?? "/assistant",
    });
  }
  for (const activity of needs.activities) {
    chips.push({
      key: `activity-${activity}`,
      text: ACTIVITY_LABELS[activity],
      href: answeredHrefs.activities ?? "/assistant",
    });
  }
  if (needs.priority !== null) {
    chips.push({
      key: "priority",
      text: `Utamakan ${PRIORITY_LABELS[needs.priority].toLowerCase()}`,
      href: answeredHrefs.priority ?? "/assistant",
    });
  }
  if (needs.requirementsAnswered) {
    chips.push({
      key: "requirements",
      text:
        needs.requirements.length === 0
          ? "Tanpa syarat khusus"
          : needs.requirements
              .map((requirement) => REQUIREMENT_LABELS[requirement])
              .join(", "),
      href: answeredHrefs.requirements ?? "/assistant",
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-8">
      <p className="text-xs text-muted-foreground">
        Yang sudah kamu sebutkan. Klik untuk mengubahnya.
      </p>
      <ul className="mt-3 flex flex-wrap justify-center gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              className="inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-4 text-sm text-foreground transition-colors duration-150 hover:bg-muted"
            >
              {chip.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Question({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-lg leading-snug font-semibold text-foreground sm:text-xl">
      {children}
    </p>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

export function Consultation({
  needs,
  step,
  answeredHrefs,
}: {
  needs: UserNeeds;
  step: NeedsStep;
  answeredHrefs: Partial<Record<keyof UserNeeds, string>>;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <AnsweredChips needs={needs} answeredHrefs={answeredHrefs} />

      {step === "budget" ? (
        <Form action="/assistant">
          <PreservedFields needs={needs} />
          <Composer
            submitLabel="Kirim"
            controls="Bisa diubah kapan saja setelah ini."
          >
            <Question>Berapa budget yang kamu siapkan?</Question>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={100000}
              name={NEEDS_PARAM.budget}
              placeholder="Contoh: 3000000"
              aria-label="Budget dalam Rupiah"
              required
              className="mt-4 border-0 bg-transparent px-0 text-lg shadow-none focus-visible:ring-0"
            />
          </Composer>
        </Form>
      ) : null}

      {step === "budget-hard" ? (
        <Form action="/assistant">
          <PreservedFields needs={needs} omit={["budgetIsHard"]} />
          <Composer
            submitLabel="Lanjut"
            controls="Menentukan cara saya menyaring."
          >
            <Question>
              {formatIdr(needs.budgetIdr ?? 0)} itu batas keras, atau masih bisa
              dilewati?
            </Question>
            <Hint>
              Kalau batas keras, produk di atasnya tidak saya tawarkan sebagai
              kandidat yang sesuai. Kalau perkiraan, kelebihannya saya catat
              sebagai kompromi.
            </Hint>
            <div className="mt-4 flex flex-wrap gap-2">
              <OptionPill
                type="radio"
                name={NEEDS_PARAM.budgetIsHard}
                value="ya"
                label="Batas keras"
                required
              />
              <OptionPill
                type="radio"
                name={NEEDS_PARAM.budgetIsHard}
                value="tidak"
                label="Masih bisa dilewati"
              />
            </div>
          </Composer>
        </Form>
      ) : null}

      {step === "activities" ? (
        <Form action="/assistant">
          <PreservedFields needs={needs} omit={["activities"]} />
          <Composer submitLabel="Lanjut" controls="Boleh pilih lebih dari satu.">
            <Question>Paling sering dipakai untuk apa?</Question>
            <div className="mt-4 flex flex-wrap gap-2">
              {ACTIVITIES.map((activity) => (
                <OptionPill
                  key={activity}
                  type="checkbox"
                  name={NEEDS_PARAM.activities}
                  value={activity}
                  label={ACTIVITY_LABELS[activity]}
                  defaultChecked={needs.activities.includes(activity)}
                />
              ))}
            </div>
          </Composer>
        </Form>
      ) : null}

      {step === "priority" ? (
        <Form action="/assistant">
          <PreservedFields needs={needs} omit={["priority"]} />
          <Composer submitLabel="Lanjut" controls="Pilih satu yang paling utama.">
            <Question>Kalau harus memilih satu, mana yang diutamakan?</Question>
            <div className="mt-4 flex flex-wrap gap-2">
              {PRIORITIES.map((priority) => (
                <OptionPill
                  key={priority}
                  type="radio"
                  name={NEEDS_PARAM.priority}
                  value={priority}
                  label={PRIORITY_LABELS[priority]}
                  defaultChecked={needs.priority === priority}
                  required
                />
              ))}
            </div>
          </Composer>
        </Form>
      ) : null}

      {step === "requirements" ? (
        <Form action="/assistant">
          <PreservedFields
            needs={needs}
            omit={["requirements", "requirementsAnswered"]}
          />
          <input
            type="hidden"
            name={NEEDS_PARAM.requirementsAnswered}
            value="ya"
          />
          <Composer
            submitLabel="Lihat kandidat"
            controls="Kosongkan kalau tidak ada."
          >
            <Question>Ada syarat yang benar-benar wajib?</Question>
            <Hint>
              Yang kamu pilih di sini saya perlakukan sebagai syarat mati:
              kandidat yang tidak memenuhinya tidak akan muncul.
            </Hint>
            <div className="mt-4 flex flex-wrap gap-2">
              {REQUIREMENTS.map((requirement) => (
                <OptionPill
                  key={requirement}
                  type="checkbox"
                  name={NEEDS_PARAM.requirements}
                  value={requirement}
                  label={REQUIREMENT_LABELS[requirement]}
                  defaultChecked={needs.requirements.includes(requirement)}
                />
              ))}
            </div>
          </Composer>
        </Form>
      ) : null}
    </div>
  );
}
