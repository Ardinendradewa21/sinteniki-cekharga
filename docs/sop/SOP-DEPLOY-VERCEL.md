# SOP Deploy CekHarga ke Vercel (PB-01)

Disusun 15 Oktober 2026. Berlaku untuk repo `Ardinendradewa21/sinteniki-cekharga` (Next.js 16, pnpm, InsForge).

## 1. Kenapa halaman admin "tidak ikut ter-deploy"

Halaman admin (`src/app/admin/**`) ada di kode yang sama dengan situs publik dan selalu ikut di-build. Kalau admin tidak muncul atau error di Vercel, penyebabnya salah satu dari tiga hal ini. Keadaan per 15 Oktober 2026:

| Penyebab | Keadaan sekarang |
| --- | --- |
| **Proyek Vercel tersambung ke repo lain** | Proyek `cekharga-frontend` tersambung ke repo lama `Ardinendradewa21/cekharga-frontend`, bukan `sinteniki-cekharga`. Deploy terakhirnya 9 Maret 2026. Kode CekHarga yang sekarang, termasuk admin, **belum pernah ter-deploy**. |
| **Kode belum di-push ke branch `main` di GitHub** | Vercel hanya mem-build kode yang ada di GitHub. `main` lokal lebih maju 12 commit dari `origin/main`, ditambah rantai branch Sprint 1 yang belum di-merge. Production selalu dibangun dari `main` di GitHub. |
| **Variabel lingkungan admin belum diisi** | Situs publik cukup dengan `INSFORGE_URL` dan `INSFORGE_API_KEY`. Login admin juga butuh `INSFORGE_ANON_KEY`; tanpa itu `/admin/login` gagal dengan "Konfigurasi auth belum lengkap". |

Ada juga perlindungan bawaan Vercel (Deployment Protection, sekarang "Standard"). URL preview (`…-git-<branch>-….vercel.app`) dan URL per deploy meminta login akun Vercel. Akibatnya, orang lain yang membuka admin di URL preview melihat halaman login Vercel, bukan login CekHarga. Pakai domain production untuk admin, cron, dan worker.

## 2. Sekali saja: sambungkan repo yang benar

1. Pastikan semua perubahan yang mau dirilis sudah di-merge ke `main` lalu di-push:
   ```
   git checkout main
   git merge --ff-only <branch-terakhir>
   git push origin main
   ```
2. Di Vercel: **Add New → Project → Import** `Ardinendradewa21/sinteniki-cekharga`.
   - Framework: Next.js (terdeteksi otomatis).
   - Install/Build: biarkan default. Vercel membaca `packageManager: pnpm@11.24.0` dan menjalankan `next build`.
   - Root Directory: `./`.
   - Production Branch: `main` (Settings → Git).
3. Isi variabel lingkungan (§3) **sebelum** deploy pertama. `next.config.ts` membaca `INSFORGE_URL` saat build untuk izin domain foto, jadi variabel yang ditambahkan setelah build baru berlaku setelah **Redeploy**.
4. Proyek lama `cekharga-frontend` biarkan dulu sebagai arsip. Hapus hanya setelah yang baru berjalan.

Alternatif: di proyek lama, buka Settings → Git → Disconnect, lalu Connect ke `sinteniki-cekharga`. Cara ini mempertahankan domain `cekharga-frontend.vercel.app`, tetapi riwayat deploy lama tercampur.

## 3. Variabel lingkungan

Isi di Settings → Environment Variables. Nilai diambil dari `.env.local`, atau untuk kunci InsForge dari `npx @insforge/cli secrets get …`. Tandai kunci rahasia sebagai **Sensitive**.

| Variabel | Production | Preview | Catatan |
| --- | --- | --- | --- |
| `CEKHARGA_DATA_SOURCE` | `live` | `live` | Tanpa ini situs memakai data demo |
| `INSFORGE_URL` | wajib | wajib | |
| `INSFORGE_API_KEY` | wajib | wajib | Sensitive, setara service-role |
| `INSFORGE_ANON_KEY` | wajib | wajib | **Wajib untuk login admin** |
| `CRON_SECRET` | wajib | – | String acak panjang. Dipakai cron Vercel `/api/cron/daily` (06.00 WIB) |
| `IMPORT_WORKER_SECRET` | wajib | – | String acak panjang. Dipakai InsForge Schedules (§5) |
| `SITE_URL` | URL production, mis. `https://cekharga-xxx.vercel.app` | **kosong** | Kosong = robots.txt menolak crawler, supaya preview tidak terindeks |
| `OPENROUTER_API_KEY` | opsional | opsional | Tanpa ini kotak cerita bebas Tanya AI disembunyikan |
| `AI_QUOTA_SECRET` | disarankan | disarankan | String acak |
| `ADS_EVENT_SECRET`, `ADS_CRON_SECRET` | opsional | – | Modul iklan sedang ditahan (PB-10) |
| `CEKHARGA_AD_PREVIEW` | **kosong** | opsional | Jangan aktif di production |

Membuat string acak:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Setiap kali rilis

1. Jalankan pemeriksaan di lokal: `npx tsc --noEmit`, `pnpm -s lint`, `pnpm test:import`, `pnpm test:catalog`, `pnpm build`.
2. Merge ke `main` lalu `git push origin main`. Vercel otomatis mem-build production.
3. Branch lain yang di-push menjadi **Preview**, bukan production. Kalau perubahan admin "tidak muncul", cek dulu apakah commit-nya sudah di `main` di GitHub (`git log origin/main -1`).
4. Pantau build di Vercel → Deployments. Build gagal berarti production tetap memakai versi sebelumnya.
5. Migrasi database tidak ikut deploy. Jalankan sebelum push bila rilis membawa migrasi baru:
   ```
   npx -y @insforge/cli db migrations up <file>
   ```

## 5. Setelah deploy pertama

1. Ganti `SITE_URL` dengan domain production yang sebenarnya, lalu Redeploy.
2. Buat jadwal worker impor per menit di InsForge Schedules: `* * * * *`, `POST https://<domain-production>/api/admin/import/worker`, header `Authorization: Bearer ${{secrets.IMPORT_WORKER_SECRET}}`. Simpan nilai yang sama sebagai secret InsForge `IMPORT_WORKER_SECRET`.
3. Cron harian sudah diatur di `vercel.json` (`0 23 * * *` = 06.00 WIB). Vercel mengirim `CRON_SECRET` otomatis. Cek di Settings → Cron Jobs.

## 6. Checklist verifikasi

- [ ] `https://<domain>/` tampil dengan data live (tanpa label "Data demo").
- [ ] `https://<domain>/admin/login` tampil, login berhasil, dan menu Dashboard, Kelola produk, Impor data terbuka.
- [ ] Unggah CSV kecil di Impor data sampai pratinjau. Batch selesai diterapkan, tidak macet di "Sedang diterapkan".
- [ ] `https://<domain>/robots.txt` mengizinkan crawler di production dan menolak di preview.
- [ ] Hari berikutnya: Vercel → Cron Jobs menunjukkan `/api/cron/daily` sukses, dan dasbor admin menunjukkan harga segar bertambah.
- [ ] InsForge Schedules: worker impor tercatat sukses (HTTP 200), bukan 401.
