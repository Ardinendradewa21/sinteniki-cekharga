import { formatIdr } from "@/lib/catalog/pricing";
import type { CompareResult } from "@/lib/catalog/queries";

/**
 * Ringkasan selisih harga dan konteks pengalaman (PRD FR-04).
 *
 * Aturan yang ditegakkan:
 *
 * - Selisih HANYA dihitung dari kandidat yang harganya layak. Kandidat tanpa
 *   harga layak tidak dianggap Rp0 dan tidak dianggap termurah; namanya
 *   disebutkan terbuka supaya pembaca tahu siapa yang tidak ikut dihitung.
 * - Selisih disajikan sebagai jarak antara termurah dan termahal, bukan sebagai
 *   penilaian mana yang lebih layak dibeli.
 * - Konteks pengalaman reviewer ikut ditampilkan karena angka spesifikasi saja
 *   tidak menjelaskan rasa pemakaian.
 */
export function CompareSummary({ result }: { result: CompareResult }) {
  const { priceSpread, itemsWithoutPrice, items } = result;
  const withNotes = items.filter((item) => item.reviewNotes.length > 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Selisih harga</h2>

        {priceSpread === null ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Belum bisa dihitung. Selisih baru punya arti kalau minimal dua
            kandidat punya penawaran yang memenuhi syarat, dan harga yang tidak
            diketahui tidak boleh dikira-kira.
          </p>
        ) : (
          <>
            <p className="tabular mt-1.5 text-2xl font-extrabold tracking-tight text-foreground">
              {formatIdr(priceSpread.differenceIdr)}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Jarak antara {priceSpread.cheapestName} yang terendah dan{" "}
              {priceSpread.mostExpensiveName} yang tertinggi, dihitung dari{" "}
              {priceSpread.comparedCount} kandidat yang harganya layak dan dari
              varian acuan masing-masing.
            </p>
          </>
        )}

        {itemsWithoutPrice.length > 0 ? (
          <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-warning">
            Tidak ikut dihitung karena belum punya penawaran yang memenuhi
            syarat: {itemsWithoutPrice.join(", ")}. Ini bukan berarti lebih murah
            atau lebih mahal.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">
          Konteks pengalaman
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Catatan reviewer, bukan pengujian CekHarga dan bukan kesimpulan dari
          angka spesifikasi.
        </p>

        {withNotes.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Belum ada ringkasan review untuk kandidat yang sedang dibandingkan.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {withNotes.map((item) => (
              <li key={item.slug}>
                <p className="text-sm font-semibold text-foreground">
                  {item.name}
                </p>
                <ul className="mt-1.5 space-y-2">
                  {item.reviewNotes.map((note) => (
                    <li
                      key={`${item.slug}-${note.channelName}-${note.aspect}`}
                      className="text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">
                        {note.channelName}
                      </span>{" "}
                      soal {note.aspect.toLowerCase()}: {note.summary}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
