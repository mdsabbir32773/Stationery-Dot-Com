# Stationery Dot Com — Setup Guide (for beginners)

> **Current production setup (24 Nov 2026):** The live website is already hosted at **https://stationerydotcom.me** on **Cloudflare Workers**, deployed automatically from the `main` branch through GitHub Actions. The `workers.dev` hostname is a redirect-only alias for the public website (the Meta webhook remains on its registered callback path). The live sitemap is **https://stationerydotcom.me/sitemap.xml** and `robots.txt` points to that canonical sitemap. Do not create a second Cloudflare Pages project for the existing production site.


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

### 4b. Customer accounts
Customer sign-up is available using email/password. Supabase → **Authentication → Sign In / Providers** → make sure Email sign-ups are enabled. Keep email confirmations enabled for production. Admin access is still restricted by `admin_profiles` and database RLS; a customer account does not get admin access.

Run `supabase/customer-accounts.sql` once in SQL Editor after the main schema and other migrations. It creates customer profiles and safely links future signed-in orders to their account. Older guest orders remain guest orders.

### SMM panel catalogue
Run `supabase/smm-panel.sql` once in SQL Editor after the main schema and `customer-accounts.sql`. It adds SMM catalogue fields and a server-priced SMM order function. Open `/admin/smm` to publish services and `/smm` to see the customer catalogue. Customer SMM checkout charges the signed-in customer wallet in the same database transaction that creates the order. Deposits use manual payment channels and admin review; the wallet is credited only after an admin approves the request. Configure verified payment account details in Admin > Settings. Provider IDs and costs can be mapped in the admin form, but provider API connection, imports, automatic order placement, refills, cancellation and status sync need a server-side provider adapter and credentials.

### Customer service reviews
Run `supabase/migrations/20261006140000_add_service_reviews.sql` in Supabase SQL Editor after `customer-accounts.sql`. Signed-in customers can rate and review services after a completed order; reviews appear publicly only after admin approval in `/admin/reviews`.

### Payment receipt screenshots and supplied brand logo
Run `supabase/migrations/20261006170000_payment_screenshot_proofs.sql` to accept private JPG/PNG/WEBP receipts for orders and wallet deposits; admins review the receipt in order details or `/admin/deposits`. The bundled Stationery Dot Com logo and blue brand theme are enabled by default; the admin can upload a replacement logo in Settings. Payment receipt screenshots are stored in the private `order-files` bucket.

To enable Google/Gmail sign-in:
1. Supabase → **Authentication → Sign In / Providers → Google** → enable Google and save the Client ID and Client Secret from Google Cloud's OAuth setup.
2. In Google Cloud's OAuth client, add Supabase's callback URL shown on the Supabase Google provider page.
3. Supabase → **Authentication → URL Configuration**: set the production Site URL and add your Cloudflare Pages URL plus `/account` as an allowed redirect URL.
4. For reliable customer confirmation and password-reset emails, configure a custom SMTP service in Supabase Auth. Supabase's default mailer has a low testing limit.

### If you already ran the OLD schema.sql
Run `supabase/update-after-audit.sql` once in SQL Editor (same way as step 2).

For an existing database that already has subscription package options, run `supabase/migrations/20261006100000_expand_subscription_durations.sql` in Supabase SQL Editor before publishing this update. It keeps current package and order records, enables all eight durations, and preserves plan duration on new orders.

## 5. Add payment details (after the site runs)
Go to `/admin/settings`, enter your real bKash and/or Nagad number, add the matching QR if you use one, then click **Save settings**. Customers see the payment options you configure. Never enter made-up account details.

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

## 9. Update your existing GitHub website
This is an updated copy of your current site. Extract this ZIP, then copy the files inside `Stationery-Dot-Com-Updated` into your existing local GitHub project folder and choose **Replace files** if Windows asks. Keep the existing `.git` folder and `.env` file. In GitHub Desktop, review the changed files, write a short summary such as `Refresh website design and admin`, then click **Commit** and **Push origin**. GitHub Actions deploys the new version to Cloudflare Workers.
## 10. Existing production deployment (Cloudflare Workers)
The live project is deployed by `.github/workflows/deploy-cloudflare.yml` whenever changes reach the `main` branch. The workflow builds the Vite app and deploys the Worker and static assets. For the existing production site, do not create a separate Pages project or change the build output manually.

No Supabase environment variable is required for the current production browser build; the browser-safe project URL and publishable key are built in, while `.env` values still override them for local/custom builds.

## 11. Canonical domain and authentication URLs
The canonical production domain is `https://stationerydotcom.me`. Keep the Supabase Authentication **Site URL** set to this domain and allow only the production account/auth callback URLs actually used by the application. The old `workers.dev` hostname redirects to the canonical domain for normal website routes.

## First-launch checklist
- [ ] Schema ran · [ ] Admin created and in admin_profiles · [ ] Payment name/number/QR saved
- [ ] Services imported · [ ] Packages with prices added · [ ] Test order placed and tracked · [ ] Test order marked Paid in admin

## What you must configure yourself
Your real payment QR, account name and number; package names and prices; admin email/password; Supabase keys; domain. Nothing is invented for you.

## Notes
Payment options support manual Send Money and Transaction ID submission; admin review is required until an official merchant/gateway verification adapter is configured. Orders are created through the `create_order` database function. Guest tracking uses Order ID + phone. New signed-in orders appear in customer accounts after running `supabase/customer-accounts.sql`. Customer files are in a private bucket; only admins get temporary links.

---
## Update 2: Redesign + payment-ready upgrade
1. **Supabase → SQL Editor → New query**: paste `supabase/payments-upgrade.sql` → **Run**. (Safe to run twice. Fresh installs already get it through schema.sql.)
2. Everything else (services, packages, orders, admin) stays as it was.

### bKash/Nagad payment and automatic verification
Customers upload a bKash/Nagad receipt screenshot; it is recorded as **Verification Pending** until an admin reviews it. The website cannot safely confirm a personal-wallet “Send Money” payment from a receipt image; automatic verification requires an official bKash/Nagad merchant API or an authenticated transaction notification. No merchant account or API credentials were included in this project, so automatic verification is not active.

To enable it, first obtain merchant onboarding and API/webhook documentation and credentials from the payment provider. Then implement that provider's documented signature/transaction verification in `functions/_lib/providers.js`, deploy the Cloudflare Pages Functions, and set encrypted Cloudflare variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the provider secrets (never `VITE_` variables). The webhook endpoint is `https://YOUR-SITE/api/payment-webhook/PROVIDERNAME`. Configure the provider to call it. The server function and `apply_payment_event` validate the verified amount against the order total and ignore duplicate provider events. Do not mark a payment paid based only on a customer-entered Transaction ID or client-side request.

### Admin website content
In `/admin/content`, the admin can edit the home page section by section and hide optional sections. `/admin/services` manages service descriptions, category names, cover images and featured/visible status; `/admin/packages` manages packages and prices. `/admin/settings` manages contact details and bKash/Nagad numbers and payment QR. `/admin/customers` lists customer accounts and their linked order counts.

---
## Update 3: Premium redesign + service images
1. (Optional but recommended) Supabase → SQL Editor → paste `supabase/service-images.sql` → Run. This adds a cover-image column to services. Without it, every service still shows an automatic coloured cover.
2. Admin → Services → Edit a service → upload a **Cover image** (jpg/png/webp, max 2MB, 16:9 shape looks best) → click **Update service**.

---
## Update 4: PDF payment QR
1. Supabase → SQL Editor → paste `supabase/qr-pdf-support.sql` → Run (allows PDF, 10MB limit).
2. Admin → Settings → upload the QR as PDF, JPG, PNG or WEBP → **Save settings**.
Customers see an image QR as a picture, and a PDF QR as a "View Payment QR" button that opens your original PDF unchanged.



### Growth, SEO and Meta Pixel
- The site includes route-specific page titles, descriptions, canonical URLs, Open Graph/Twitter metadata, Organization/Service structured data, robots.txt and a sitemap containing the current active service pages.
- The production sitemap is generated dynamically at https://stationerydotcom.me/sitemap.xml and is already referenced in robots.txt. Submit this canonical URL in Google Search Console when owner access is available; the site code cannot submit or request indexing without that account permission.
- Meta Pixel is configured in src/lib/metaPixel.js (default Pixel ID is already set; VITE_META_PIXEL_ID can override it at build time). Events include PageView, ViewContent, AddToCart, InitiateCheckout and Lead. A manual-payment order is tracked as a Lead until an admin verifies payment; wallet-funded SMM purchases are tracked as Purchase.
- Cloudflare Workers static-asset response headers are defined in public/_headers. Worker-generated responses also receive security headers in worker.js. Hashed /assets/* files receive long-lived immutable caching.
- For stronger account security, enable Supabase Auth leaked-password protection in the project’s Authentication password-security settings.
