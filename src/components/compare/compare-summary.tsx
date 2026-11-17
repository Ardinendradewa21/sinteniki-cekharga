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
 * - Selisih disajikan sebagai kalimat (VD-07): siapa yang harganya lebih tinggi
 *   dan seberapa, dari varian acuan masing-masing. Bukan penilaian mana yang
 *   lebih layak dibeli. Harga yang sama dinyatakan sama, bukan "Rp0".
 * - Konteks pengalaman reviewer ikut ditampilkan karena angka spesifikasi saja
 *   tidak menjelaskan rasa pemakaian.
 */
export function CompareSummary({ result }: { result: CompareResult }) {
  const { priceSpread, itemsWithoutPrice, items } = result;
  const withNotes = items.filter((item) => item.reviewNotes.length > 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="heading-label text-foreground">Selisih harga</h3>

        {priceSpread === null ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Belum bisa dihitung. Selisih baru punya arti kalau minimal dua
            kandidat punya penawaran yang memenuhi syarat, dan harga yang tidak
            diketahui tidak boleh dikira-kira.
          </p>
        ) : priceSpread.differenceIdr === 0 ? (
          <p className="mt-1.5 text-base leading-relaxed text-foreground">
            Harga varian acuan {priceSpread.comparedCount === 2 ? "keduanya" : `${priceSpread.comparedCount} kandidat`} sama:{" "}
            <span className="tabular font-bold">{formatIdr(priceSpread.lowestPriceIdr)}</span>.
          </p>
        ) : priceSpread.comparedCount === 2 ? (
          <p className="mt-1.5 text-base leading-relaxed text-foreground">
            Harga varian acuan {priceSpread.mostExpensiveName}{" "}
            <span className="tabular font-bold">{formatIdr(priceSpread.differenceIdr)}</span> lebih tinggi daripada{" "}
            {priceSpread.cheapestName}.
          </p>
        ) : (
          <p className="mt-1.5 text-base leading-relaxed text-foreground">
            Dari {priceSpread.comparedCount} kandidat, harga varian acuan {priceSpread.mostExpensiveName} paling tinggi,{" "}
            <span className="tabular font-bold">{formatIdr(priceSpread.differenceIdr)}</span> di atas{" "}
            {priceSpread.cheapestName} yang paling rendah.
          </p>
        )}
        {priceSpread !== null ? (
          <p className="mt-1.5 text-sm text-muted-foreground">
            Dihitung dari varian acuan yang tertulis di kartu tiap produk.
          </p>
        ) : null}

        {itemsWithoutPrice.length > 0 ? (
          <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-warning">
            Tidak ikut dihitung karena belum punya harga yang baru diperiksa
            (harga terakhir tercatat bisa sudah berubah):{" "}
            {itemsWithoutPrice.join(", ")}. Ini bukan berarti lebih murah atau
            lebih mahal.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="heading-label text-foreground">
          Konteks pengalaman
        </h3>
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
                      {note.aspect === "kamera" ? "soal kamera" : "secara umum"}: {note.summary}
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
