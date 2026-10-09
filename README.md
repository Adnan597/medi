# Pharmacy Manager (Medical Store)

Full-stack pharmacy / medical store software: POS billing, batch & expiry tracking, purchases, returns, supplier/customer khata, expenses and profit reports.

**Stack:** Next.js 16 (App Router, Server Actions) · PostgreSQL · Prisma 7 (`@prisma/adapter-pg`) · Tailwind CSS 4

## Features

| Module | What it does |
|---|---|
| **POS** | Search by name / salt / barcode (scanner friendly), sell by pack or loose units, FEFO batch picking, line + bill discount, cash / card / online / udhaar, 80mm thermal receipt, shortcuts `F2` search, `F9` complete |
| **Medicines** | Brand, generic/salt, strength, form, company, category, rack, barcode, pack size (e.g. strip of 10), reorder level, Rx / controlled flags, substitutes by salt |
| **Batches & stock** | Every batch has its own expiry, cost and sale price. Stock is stored in base units (tablets). Every change is logged in `StockMovement` |
| **Purchases** | Supplier bill with batch, expiry, bonus qty, discount %, bill discount/tax. Net cost per pack includes the bonus |
| **Returns** | Sale returns (stock back + refund / credit) and returns to supplier (e.g. all expired stock in one click) |
| **Stock & expiry** | All batches, low stock, near-expiry (configurable days), expired, stock history, stock value at cost and retail |
| **Suppliers / Customers** | Ledger (khata) with running balance, payments, opening balances, customer credit limits |
| **Expenses & reports** | Net sales, COGS, gross/net profit, payment-method split, daily sales, top-selling items |
| **Users & roles** | Admin (everything), Pharmacist (no reports/settings), Cashier (POS, own sales, can't see cost/profit) |

## Local development

```bash
npm install
cp .env.example .env         # put your DATABASE_URL / DIRECT_URL / AUTH_SECRET
npm run db:migrate           # create tables
npm run db:seed              # categories + companies (no users)
npm run dev                  # open http://localhost:3000 → /setup
npm run db:seed:samples      # (optional, after setup) demo medicines with stock
```

On an empty database the app opens **/setup**: pharmacy name, logo, colour, contact details and the first admin account. Setup runs only once; after that `/setup` redirects to login.

No Postgres installed? `npx prisma dev` starts a throw-away local Postgres. Put the `postgres://…` TCP URL it prints into `.env`.

## One codebase, many pharmacies

Every pharmacy gets **its own deployment and its own database** (single-tenant). The code is the same for all; only env variables differ.

```
GitHub repo ─┬─ Vercel project "shifa-pharmacy"  → Neon DB #1
             ├─ Vercel project "al-madina-meds"  → Neon DB #2
             └─ Shop PC (local)                  → PostgreSQL + pgAdmin
```

| What | Where it lives | Who changes it |
|---|---|---|
| Pharmacy name, tagline, **logo**, **brand colour**, address, phone, email, license no., NTN, receipt footer | Database (`StoreSetting` row) | The pharmacy, in **/setup** and **Settings** |
| Software name, vendor name, support phone ("Powered by …") | Env vars `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_VENDOR_NAME`, `NEXT_PUBLIC_SUPPORT_PHONE` | You |

- The logo is stored **in the database** (max 300 KB, PNG/JPG/WEBP), so it moves with the data when a pharmacy goes from Neon to a local server. It's served at `/api/logo` and doubles as the browser-tab icon.
- The brand colour is one hex value; every shade in the UI is derived from it (`--brand` in [src/app/globals.css](src/app/globals.css)).
- `NEXT_PUBLIC_*` values are baked in at build time — redeploy after changing them.

### New client checklist

1. **Neon:** create a new project → copy the pooled and direct URLs.
2. **Vercel:** *Add New → Project* → import the **same** repo. Name the project after the pharmacy.
3. **Env vars:** `DATABASE_URL`, `DIRECT_URL`, a **new** `AUTH_SECRET`, and your `NEXT_PUBLIC_*` branding.
4. **Deploy** (migrations run automatically), then seed lookup data once from your machine: set `DATABASE_URL`/`DIRECT_URL` to the client's DB and run `npm run db:seed`.
5. Open the site → **/setup** → enter the pharmacy's name, logo, colour and admin account. Hand over the login.
6. Optional: add a custom domain in Vercel (e.g. `pos.shifapharmacy.pk`).

Pushing to `main` redeploys every client project, so all pharmacies get fixes and features together. Schema changes reach each database through `prisma migrate deploy` in the build.

## Deploy on Vercel + Neon

1. Push this repo to GitHub.
2. **Neon:** create a project at [neon.tech](https://neon.tech) (or add Neon from the Vercel Marketplace, *Storage → Neon*). Copy two connection strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct / unpooled** → `DIRECT_URL`
3. **Vercel:** import the repo, then add these Environment Variables: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
4. Deploy. The build runs `prisma migrate deploy`, so tables are created automatically.
5. Seed once, from your machine, with your `.env` pointing to Neon: `npm run db:seed`. Then open the site and complete **/setup**.

> Vercel's free **Hobby** plan is for non-commercial use only. For a real store use **Pro**, or self-host (below).

## Moving to a local PostgreSQL (pgAdmin) later

The code doesn't change. Only the connection string does.

1. Install PostgreSQL + pgAdmin and create a database, e.g. `pharmacy`.
2. Copy the data from Neon:
   ```bash
   pg_dump "<NEON_DIRECT_URL>" -Fc -f pharmacy.dump
   pg_restore --no-owner -d "postgresql://postgres:PASS@localhost:5432/pharmacy" pharmacy.dump
   ```
3. Set `DATABASE_URL` and `DIRECT_URL` in `.env` to the local URL.
4. Run on the shop PC: `npm run build && npm start` (use PM2 or a Windows service to keep it running). Other counters on the LAN can open `http://<pc-ip>:3000`.

Take regular backups with `pg_dump` (e.g. with Windows Task Scheduler).

## Key concepts in the code

- **Units:** a medicine has `packName` (Strip), `unitName` (Tablet) and `unitsPerPack` (10). Batch quantities are in **units**. Batch prices are **per pack**.
- **FEFO:** sales take stock from the batch that expires first ([src/lib/fefo.ts](src/lib/fefo.ts)). Expired batches can't be sold.
- **Transactions:** sale, purchase, return and adjustment each run in one DB transaction with conditional stock decrements, so two counters can't oversell ([src/lib/services.ts](src/lib/services.ts)).
- **Ledger:** `Supplier.balance` = what you owe; `Customer.balance` = what they owe. Every change writes a `LedgerEntry` row with the running balance.
- **Timezone:** all "today" / date-range logic uses Asia/Karachi ([src/lib/format.ts](src/lib/format.ts)).
- **Auth:** signed JWT in an httpOnly cookie. `requireUser(permission)` guards every page and server action; permissions live in [src/lib/auth.ts](src/lib/auth.ts).

## Project structure

```
prisma/schema.prisma      database schema
prisma/seed.ts            initial data
src/lib/services.ts       business logic (sale, purchase, returns, stock, ledger)
src/app/actions/*         server actions called by forms
src/app/(app)/*           pages (dashboard, pos, sales, medicines, stock…)
src/app/receipt/[id]      printable thermal receipt
src/proxy.ts              redirects logged-out users to /login
```
