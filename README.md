# Stationery Dot Com — Setup Guide (for beginners)

You will need: a free Supabase account, a free GitHub account, a free Cloudflare account, and Node.js (https://nodejs.org → download "LTS" → install).

## 1. Create the Supabase project
1. Go to supabase.com → **Start your project** → sign in.
2. Click **New project**. Name it `stationery-dot-com`, choose a database password (save it), region **Singapore**. Click **Create**. Wait 2 minutes.

## 2. Run schema.sql
1. Left menu → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` on your computer, copy everything, paste, click **Run**. You should see "Success".

## 3. Create the admin account
1. Left menu → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email and a strong password. Tick **Auto Confirm User**. Click **Create**.

## 4. Configure the admin profile
1. **SQL Editor** → **New query**, paste this (use YOUR email) and click **Run**:
```
insert into admin_profiles(id,full_name) select id,'Owner' from auth.users where email='YOUR-EMAIL@example.com';
```
2. Only people in `admin_profiles` can manage the site. Never share the password.

### 4b. Turn off public sign-up (important)
Supabase → **Authentication** → **Sign In / Providers** (or **Providers → Email**) → turn **OFF** "Allow new users to sign up" → **Save**. (Strangers still could not manage the site, but this is safer.)

### If you already ran the OLD schema.sql
Run `supabase/update-after-audit.sql` once in SQL Editor (same way as step 2).

## 5. Add the payment QR (after the site runs)
Go to `/admin/settings`, type your real payment name and number, upload your QR image, click **Save settings**. Nothing is pre-filled — use only your real details.

## 6. Add services and packages
1. `/admin/services` → **Import starter services list** (adds all your categories). Tick "Show as popular" on a few.
2. `/admin/packages` → pick a service, enter package name and price → **Add package**. Customers only see services' packages that you add.

## 7. Environment variables
The production browser build already contains the Supabase **Project URL** and **publishable/anon public key** for this project, so Cloudflare does not need a `VITE_SUPABASE_*` setting for the site to connect to Supabase.

For local/custom deployments, `.env` is still supported and takes precedence:
1. Supabase → **Project Settings → API**. Copy the **Project URL** and **publishable/anon public** key. **NEVER use `service_role`.**
2. In the project folder, copy `.env.example` to `.env` and paste the values.

The publishable/anon key is browser-safe by design; database access is controlled by Supabase Auth and Row Level Security (RLS). Never put a `service_role` or other secret key in `src/` or any `VITE_` variable.

## 8. Run locally
Open Terminal (Windows: "Command Prompt") in the project folder:
```
npm install
npm run dev
```
Open the address shown (http://localhost:5173). Admin is at `/admin`.

## 9. Push to GitHub
1. github.com → **New repository** → name `stationery-dot-com` → Private → Create.
2. Easiest: install **GitHub Desktop** → File → Add Local Repository → choose the folder → **Publish repository**. (`.env` is ignored, so your keys stay private.)

## 10. Deploy to Cloudflare Pages
1. dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick your repo.
2. Build command: `npm run build`. Output directory: `dist`.
3. (Optional) add `NODE_VERSION` = `20`.
4. No Supabase environment variable is required for the current production build; the browser-safe project URL and publishable key are built in, while `.env` values still override them for custom/local builds.
5. Supabase → **Authentication → URL Configuration** → set Site URL to your `.pages.dev` address.

## 11. Custom domain later
Cloudflare Pages → your project → **Custom domains** → **Set up a domain** and follow the steps. Then replace `YOUR-DOMAIN.com` in `public/robots.txt` and `public/sitemap.xml`.

## First-launch checklist
- [ ] Schema ran · [ ] Admin created and in admin_profiles · [ ] Payment name/number/QR saved
- [ ] Services imported · [ ] Packages with prices added · [ ] Test order placed and tracked · [ ] Test order marked Paid in admin

## What you must configure yourself
Your real payment QR, account name and number; package names and prices; admin email/password; Supabase keys; domain. Nothing is invented for you.

## Notes
Real payment gateway: replace `src/components/PaymentQR.jsx` later; orders are created through the `create_order` database function. Tracking needs Order ID + phone. Customer files are in a private bucket; only admins get temporary links.

---
## Update 2: Redesign + payment-ready upgrade
1. **Supabase → SQL Editor → New query**: paste `supabase/payments-upgrade.sql` → **Run**. (Safe to run twice. Fresh installs already get it through schema.sql.)
2. Everything else (services, packages, orders, admin) stays as it was.

### Automatic payment (NOT active yet)
Customers can submit a bKash/Nagad Transaction ID now, but it is recorded as **Verification Pending**. Admin must confirm it in the order screen. The website cannot safely verify a personal-wallet “Send Money” ID by looking at its format; it needs an official bKash/Nagad merchant API or an authenticated transaction notification. No merchant account or API credentials were included in this project, so automatic verification is not active.

To enable it, first obtain merchant onboarding and API/webhook documentation and credentials from the payment provider. Then implement that provider's documented signature/transaction verification in `functions/_lib/providers.js`, deploy the Cloudflare Pages Functions, and set encrypted Cloudflare variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the provider secrets (never `VITE_` variables). The webhook endpoint is `https://YOUR-SITE/api/payment-webhook/PROVIDERNAME`. Configure the provider to call it. The server function and `apply_payment_event` validate the verified amount against the order total and ignore duplicate provider events. Do not mark a payment paid based only on a customer-entered Transaction ID or client-side request.

### Admin website content
In `/admin/settings`, the admin can change the home page heading and introduction, announcement, tagline, footer text, contact details, payment instructions and payment QR. Services and package visibility/prices are managed under `/admin/services` and `/admin/packages`.

---
## Update 3: Premium redesign + service images
1. (Optional but recommended) Supabase → SQL Editor → paste `supabase/service-images.sql` → Run. This adds a cover-image column to services. Without it, every service still shows an automatic coloured cover.
2. Admin → Services → Edit a service → upload a **Cover image** (jpg/png/webp, max 2MB, 16:9 shape looks best) → click **Update service**.

---
## Update 4: PDF payment QR
1. Supabase → SQL Editor → paste `supabase/qr-pdf-support.sql` → Run (allows PDF, 10MB limit).
2. Admin → Settings → upload the QR as PDF, JPG, PNG or WEBP → **Save settings**.
Customers see an image QR as a picture, and a PDF QR as a "View Payment QR" button that opens your original PDF unchanged.
