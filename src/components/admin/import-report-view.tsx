import type { ImportReport, OfferImportReport } from "@/lib/import/report";

/**
 * Laporan hasil impor, dipakai halaman batch setelah diterapkan.
 *
 * Laporannya sengaja rinci: berapa yang masuk, berapa yang diperbarui, dan
 * APA ALASAN tiap baris yang dilewati. Impor yang cuma bilang "berhasil"
 * membuat data hilang diam-diam tanpa ada yang tahu. Angka penawaran baru,
 * penawaran diperbarui, dan harga tercatat dipisah karena maknanya berbeda.
 */

export function SpecReportView({
  summary,
}: {
  summary: NonNullable<ImportReport["summary"]>;
}) {
  return (
    <section role="status" className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-bold text-foreground">Hasil impor</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <dt className="text-sm text-muted-foreground">Baris terbaca</dt>
          <dd className="text-lg font-bold text-foreground">{summary.totalRows}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Produk baru</dt>
          <dd className="text-lg font-bold text-success">{summary.created}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Diperbarui</dt>
          <dd className="text-lg font-bold text-foreground">{summary.updated}</dd>
        </div>
        {summary.imagesQueued !== undefined ? (
          // Laporan baru: foto diproses antrean terpisah; progresnya di panel progres.
          <div>
            <dt className="text-sm text-muted-foreground">Foto diantrekan</dt>
            <dd className="text-lg font-bold text-foreground">{summary.imagesQueued}</dd>
          </div>
        ) : (
          <>
            <div>
              <dt className="text-sm text-muted-foreground">Gambar baru</dt>
              <dd className="text-lg font-bold text-success">{summary.imagesCreated}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Gambar diperbarui</dt>
              <dd className="text-lg font-bold text-foreground">{summary.imagesUpdated}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Gambar tetap</dt>
              <dd className="text-lg font-bold text-foreground">{summary.imagesUnchanged}</dd>
            </div>
          </>
        )}
        <div>
          <dt className="text-sm text-muted-foreground">Gambar dilewati</dt>
          <dd className="text-lg font-bold text-warning">{summary.imageSkipped.length}</dd>
        </div>
      </dl>

      {summary.malformedLines.length > 0 ? (
        <p className="mt-4 text-sm text-warning">
          {summary.malformedLines.length} baris diabaikan karena jumlah
          kolomnya tidak cocok header (baris{" "}
          {summary.malformedLines.slice(0, 10).join(", ")}
          {summary.malformedLines.length > 10 ? ", dan seterusnya" : ""}).
        </p>
      ) : null}

      {summary.skipped.length > 0 ? (
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-foreground">
            {summary.skipped.length} baris dilewati, beserta alasannya
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {summary.skipped.map((s, i) => (
              <li key={`${s.label}-${i}`}>
                <span className="font-medium text-foreground">{s.label}</span>: {s.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Semua baris terbaca tanpa ada yang dilewati.
        </p>
      )}

      {summary.imageSkipped.length > 0 ? (
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-foreground">
            Gambar yang dilewati
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {summary.imageSkipped.map((item, index) => (
              <li key={`${item.label}-${index}`}>
                <span className="font-medium text-foreground">{item.label}</span>: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function OfferReportView({
  summary,
}: {
  summary: NonNullable<OfferImportReport["summary"]>;
}) {
  return (
    <section role="status" className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-bold text-foreground">Hasil impor penawaran</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
        <div>
          <dt className="text-sm text-muted-foreground">Baris terbaca</dt>
          <dd className="text-lg font-bold text-foreground">{summary.totalRows}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Dipraproses</dt>
          <dd className="text-lg font-bold text-foreground">
            {summary.preprocessedRows}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Varian dasar</dt>
          <dd className="text-lg font-bold text-foreground">
            {summary.inferredBaseVariants}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Penawaran baru</dt>
          <dd className="text-lg font-bold text-success">{summary.created}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Diperbarui</dt>
          <dd className="text-lg font-bold text-foreground">{summary.updated}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Harga tercatat</dt>
          <dd className="text-lg font-bold text-success">{summary.pricesRecorded}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Harga duplikat</dt>
          <dd className="text-lg font-bold text-foreground">
            {summary.duplicatePrices}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-muted-foreground">
        Format terdeteksi: {summary.sourceFormats
          .map((format) =>
            format === "shopee-scrape"
              ? "hasil scraping Shopee"
              : format === "erafone-scrape"
                ? "ekspor Erafone"
                : "templat CekHarga"
          )
          .join(", ")}.
      </p>

      {summary.mergedListings > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {summary.mergedListings} listing warna lain untuk varian yang
          sama digabung; tiap varian menyimpan satu penawaran Erafone dengan
          harga termurahnya.
        </p>
      ) : null}

      {summary.imagesAdded + summary.imagesUnchanged + (summary.imagesQueued ?? 0) > 0 ||
      summary.imageSkipped.length > 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          <p>
            {summary.imagesQueued !== undefined
              ? `Foto galeri: ${summary.imagesQueued} diantrekan untuk diproses, ${summary.imageSkipped.length} dilewati.`
              : `Foto galeri: ${summary.imagesAdded} ditambahkan atau diperbarui, ${summary.imagesUnchanged} sudah ada, ${summary.imageSkipped.length} dilewati.`}
          </p>
          {summary.imageSkipped.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {summary.imageSkipped.slice(0, 10).map((s, i) => (
                <li key={`${s.label}-${i}`}>
                  <span className="font-medium text-foreground">{s.label}</span>: {s.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {summary.inferredBaseVariants > 0 ? (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning-muted p-3 text-sm text-foreground">
          {summary.inferredBaseVariants} baris tidak menyebut RAM atau
          penyimpanan. Harga dipasangkan ke varian penyimpanan terkecil karena
          seluruh varian produk tersebut memiliki RAM yang sama.
        </p>
      ) : null}

      {summary.malformedLines.length > 0 ? (
        <p className="mt-4 text-sm text-warning">
          {summary.malformedLines.length} baris diabaikan karena jumlah
          kolomnya tidak cocok header (baris{" "}
          {summary.malformedLines.slice(0, 10).join(", ")}).
        </p>
      ) : null}

      {summary.skipped.length > 0 ? (
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-foreground">
            {summary.skipped.length} baris dilewati, beserta alasannya
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {summary.skipped.slice(0, 50).map((s, i) => (
              <li key={`${s.label}-${i}`}>
                <span className="font-medium text-foreground">{s.label}</span>: {s.reason}
              </li>
            ))}
          </ul>
          {summary.skipped.length > 50 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Menampilkan 50 alasan pertama dari {summary.skipped.length} baris.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Semua baris terbaca tanpa ada yang dilewati.
        </p>
      )}
    </section>
  );
}
