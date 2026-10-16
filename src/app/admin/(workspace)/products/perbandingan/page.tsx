import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addComparePairAction, removeComparePairAction } from "@/lib/admin/compare-pair-actions";
import { requireStaff } from "@/lib/auth/dal";
import { selectAll } from "@/lib/backend/paged-read";
import { pairPath } from "@/lib/catalog/compare-pair-rules";
import { listComparePairs } from "@/lib/catalog/compare-pairs";

export const metadata: Metadata = {
  title: "Perbandingan pilihan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  pilihan: "Pilih dua produk yang berbeda.",
  "belum-terbit": "Kedua produk harus sudah terbit.",
  "sudah-ada": "Pasangan itu sudah ada (urutan apa pun).",
  simpan: "Pasangan gagal disimpan. Coba lagi.",
  hapus: "Pasangan gagal dihapus. Coba lagi.",
};

/**
 * Pasangan halaman "A vs B" (PB-28). Pilih pasangan yang memang wajar
 * dibandingkan: varian satu seri, atau pesaing di rentang harga yang sama.
 * Tidak ada klaim "populer"; halaman publik menyebutnya perbandingan biasa.
 */
export default async function ComparePairsAdminPage(props: PageProps<"/admin/products/perbandingan">) {
  await requireStaff([]);
  const query = await props.searchParams;
  const [pairs, products] = await Promise.all([
    listComparePairs(),
    selectAll("products", "id, brand, model, status") as Promise<{ id: string; brand: string; model: string; status: string }[]>,
  ]);
  const published = products
    .filter((product) => product.status === "published")
    .map((product) => ({ id: product.id, name: `${product.brand} ${product.model}` }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
  const error = typeof query.galat === "string" ? MESSAGES[query.galat] : null;

  return (
    <Container className="py-6 sm:py-8 lg:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Perbandingan pilihan</h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Setiap pasangan menjadi halaman <code>/bandingkan/a-vs-b</code> yang bisa ditemukan mesin pencari. Pilih pasangan
        yang wajar dibandingkan. Pasangan otomatis tidak tampil bila salah satu produk ditarik dari publik.
      </p>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {query.ok ? (
        <p role="status" className="mt-4 rounded-xl border border-success/40 bg-success/5 p-4 text-sm text-foreground">
          {query.ok === "hapus" ? "Pasangan dihapus." : "Pasangan ditambahkan."}
        </p>
      ) : null}

      <form action={addComparePairAction} className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        {(["productA", "productB"] as const).map((name, index) => (
          <div key={name}>
            <Label htmlFor={name}>{index === 0 ? "Produk kiri (A)" : "Produk kanan (B)"}</Label>
            <select
              id={name}
              name={name}
              required
              defaultValue=""
              className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground"
            >
              <option value="" disabled>
                Pilih produk terbit
              </option>
              {published.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        ))}
        <Button type="submit">Tambah pasangan</Button>
      </form>

      <h2 className="mt-8 text-lg font-bold text-foreground">Pasangan aktif ({pairs.length})</h2>
      {pairs.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada pasangan.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
          {pairs.map((pair) => (
            <li key={pair.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <Link href={pairPath(pair)} className="font-semibold text-foreground underline-offset-4 hover:underline">
                {pair.nameA} vs {pair.nameB}
              </Link>
              <form action={removeComparePairAction}>
                <input type="hidden" name="id" value={pair.id} />
                <Button type="submit" variant="outline" size="sm">
                  Hapus
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
