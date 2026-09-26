<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **CekHarga** (API base `https://5bwufb5f.ap-southeast.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->

## Skill desain & marketing pihak ketiga

Skill di `.claude/skills/` (`ui-ux-pro-max`, `design-taste-frontend`, `redesign-existing-projects`, `seo-audit`, `ai-seo`, `programmatic-seo`, `schema`, `site-architecture`, `copywriting`, `product-marketing`, `caveman`) bersifat saran umum. Kalau bertentangan dengan `docs/CekHarga_PRD_v2.md`, **PRD yang menang**:

- Tidak ada testimonial, popularitas, jumlah pengguna, urgensi/kelangkaan, atau badge "terverifikasi" tanpa bukti (PRD FR-01, FR-05).
- Tidak ada skor, peringkat, "terbaik", atau pemenang tunggal (PRD §3, FR-02, FR-04). Structured data `Product` tidak boleh memuat `aggregateRating`/`review` karangan.
- Harga kosong bukan nol; harga selalu menyebut varian acuan dan waktu pemeriksaan (PRD §7).
- Pertahankan token desain di `src/app/globals.css` dan font Plus Jakarta Sans kecuali pemilik produk meminta perubahan; redesign bertahap, bukan tulis ulang.
- Aksesibilitas PRD §8 tetap wajib: target 44 px, kontras 4.5:1, focus terlihat.
