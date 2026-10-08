# QA & Product Ownership — CekHarga

Folder ini berisi seluruh artefak jaminan kualitas (QA) dan pengelolaan produk (Product Owner) untuk CekHarga. Semuanya ditelusuri balik ke `docs/CekHarga_PRD_v2.md`. Kalau ada yang bertentangan, PRD yang menang.

## Isi folder

| Dokumen | Untuk siapa | Isi |
| --- | --- | --- |
| [TEST-PLAN.md](TEST-PLAN.md) | Developer, QA, PM | Strategi uji, jenis pengujian, lingkungan, kriteria masuk/keluar, risiko |
| [TEST-CASES.md](TEST-CASES.md) | QA, Developer | Daftar kasus uji, keterlacakan ke FR/user story, status otomasi |
| [USER-STORIES.md](USER-STORIES.md) | PO, PM, Developer | User story per epik dengan acceptance criteria Gherkin |
| [BACKLOG.md](BACKLOG.md) | PO, tim Scrum | Product backlog berprioritas (WSJF), Definition of Ready/Done |
| [DEFECTS.md](DEFECTS.md) | Semua | Register defect: severity, status, akar masalah, commit perbaikan, tes regresi |
| [UAT.md](UAT.md) | Pemilik produk, stakeholder bisnis | Skenario UAT berbahasa bisnis dan lembar persetujuan |
| [SCRUM.md](SCRUM.md) | Tim Scrum | Ritme seremoni, rencana sprint berikutnya, retrospektif |
| [TEST-REPORT-2026-10-06.md](TEST-REPORT-2026-10-06.md) | Semua | Hasil eksekusi uji terakhir dan rekomendasi rilis |

## Cara menjalankan pengujian

| Perintah | Jenis | Waktu | Butuh |
| --- | --- | --- | --- |
| `pnpm test:import`, `pnpm test:assistant`, `pnpm test:catalog` | Unit (aturan bisnis murni) | < 5 detik | – |
| `pnpm test:integration` | Integrasi ke database nyata, data penanda `QAUji` | ± 30 detik | `.env.local` |
| `pnpm qa:sql` | Validasi integritas data (SQL, hanya baca) | ± 1 menit | `.insforge/` ter-link |
| `pnpm test:e2e:smoke` | E2E jalur kritis (Playwright, tag `@smoke`) | ± 1 menit | Chrome terpasang |
| `pnpm test:e2e` | E2E lengkap: publik, mobile, keamanan, admin, peran | ± 3 menit | lihat di bawah |

Uji admin dan peran hanya berjalan bila kredensial admin diberikan lewat environment. Kredensial **tidak pernah** ditulis ke repo:

```bash
QA_ADMIN_EMAIL=... QA_ADMIN_PASSWORD=... pnpm test:e2e
```

Laporan HTML Playwright tersimpan di `playwright-report/` (di-ignore git). Jejak (trace) kegagalan bisa dibuka dengan `npx playwright show-trace <berkas>`.

## Pemetaan kompetensi QA/PO ke artefak proyek

| Kompetensi | Wujud di proyek ini |
| --- | --- |
| Test Plan, Test Case, Test Script | TEST-PLAN, TEST-CASES, `e2e/`, `scripts/tests/` |
| Functional, Regression, System, UAT | Tag `@smoke`/`@regression`, uji integrasi end-to-end, UAT.md |
| Defect tracking | DEFECTS.md dan templat `.github/ISSUE_TEMPLATE/bug_report.md` |
| Otomasi (Playwright) | `playwright.config.ts`, 53 tes E2E di 5 proyek |
| SQL untuk validasi database | `scripts/qa/sql-checks.mjs` (13 pemeriksaan) |
| Analisis requirement | Keterlacakan FR → story → test case, dan celah PRD di USER-STORIES |
| User story dan acceptance criteria (Gherkin/BDD) | USER-STORIES.md |
| Backlog dan prioritas | BACKLOG.md (WSJF) |
| Jembatan bisnis–teknis | UAT.md (bahasa bisnis) dan DEFECTS.md (dampak bisnis per defect) |
| Seremoni Scrum | SCRUM.md |
