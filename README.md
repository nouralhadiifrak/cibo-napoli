# CIBO NAPOLI

Website and online ordering for Cibo Napoli, a Neapolitan pizzeria in El Mansouria (Morocco).
Plain HTML, CSS and JavaScript, no framework and no build step.

> **Status: demo.** Hosted on Vercel for now (to show the owner), moving to Cloudflare Pages before real use.
> Orders run in **demo mode**: they stay in the browser (see "Online orders"). Supabase comes after the owner says yes.

- French by default, English at `/?lang=en` (FR / EN switch in the header)
- Intro (about 1.6 s, a tap skips it): the logo on green, then it glides into the header (`js/intro.js`)
- Hero: « Le goût de l'Italie dans votre assiette », Order / See the menu, open/closed status. A drawn pizza
  until the owner sends a photo or video (`heroMedia` in `js/config.js`; a still image stays if autoplay is blocked)
- Menu: 7 category tiles, a sticky category bar, 45 dishes (2 per row on phones), each with its description and
  price in DH. Fresh pasta asks for the shape (fusilli, spaghetti, tagliatelle) before it goes in the cart.
  A dish with a photo opens it big (click on PC, long press on phones); a dish without one shows a drawn tile
- Cart: pickup or delivery (map, GPS or tap, up to 4 km, 10 DH), clear total, payment note
- « Commander » sends the order to the staff screen, then a live tracking panel; WhatsApp only as the way out
- Our story, Google reviews, info and map, privacy and terms of sale pages
- Installable app (PWA), schema.org data, sitemap, share image

## Online orders

**Customer:** « Commander » saves the order (`js/orders.js`) and shows a live panel: received → accepted (with a
time) → ready / on the way → done, or refused / cancelled with the reason. The customer can cancel while the order
waits. WhatsApp (with the order already written) appears only if sending fails, or after
`orders.callAfterMinutes` (5) minutes without an answer. When the order is done: « Grazie ! » and a Google review
button.

**Staff screen `/commandes/`**, installable as its own app (dark icon, « CN Commandes »). « Démarrer le service »
lets the page ring and keeps the screen awake. Each new order rings and fills the screen until it is accepted
(10 – 60 min) or refused (with a reason). Then: Prête (pickup) or En route + « Envoyer au livreur » (WhatsApp with
client, phone, address, map link and amount to collect; the staff pick the driver's contact), then Terminée.
An accepted order can be cancelled with a reason. Orders older than 24 h are hidden.
« Statistiques »: orders, revenue, average basket, delivery vs pickup, best sellers, orders per hour (one day) or
revenue per day (week, month); a service day runs 06:00 → 06:00.
The **owner's account** opens on the statistics and has no pop-up, sound or buttons.

### Demo mode (now)

`orders.supabaseUrl` is empty in `js/config.js`, so orders are kept in the browser's localStorage, with the same
rules as the database (5 orders per phone in 10 min, details erased after 24 h). To show it:

1. Open the site and `/commandes/` **in two tabs of the same browser** (on a phone: two tabs in Chrome).
2. In `/commandes/` choose « Entrer comme l'équipe », then « Démarrer le service ».
3. Order on the site: the staff tab rings; accept it and watch the customer's panel change.
4. ☰ → « Remplir avec des exemples » fills the statistics with example orders (marked as demo).

### Going live with Supabase (later)

1. Create a Supabase project, **EU region** (e.g. Paris), free plan.
2. Run `supabase/schema.sql` (tables, RLS, column grants, anti-spam, zone check, 24 h erase, 2-year delete,
   realtime, push). Run the **security advisors** and fix anything they report.
3. Authentication → Sign In / Providers: turn **off** « Allow new users to sign up ».
4. Authentication → Users → Add user: one staff account and one owner account; then in SQL:
   `insert into public.staff (user_id, role, location) values ('<id>', 'staff', 'el-mansouria');`
   `insert into public.staff (user_id, role) values ('<id>', 'owner');`
5. Push: generate VAPID keys (`npx web-push generate-vapid-keys`), deploy `supabase/functions/push`
   (verify_jwt off: it checks a secret shared with the database), and insert the keys **by hand** in
   `push_config` (see the comment in the schema). Never commit the private key.
6. Fill `orders.supabaseUrl`, `orders.publishableKey` and `orders.vapidPublicKey` in `js/config.js` (all public),
   raise the `?v=` numbers, run the tests.

## Hosting

**Now (demo): Vercel.** Import the repo, framework « Other », no build command, output directory `.` (root).
`vercel.json` holds the security headers and caching rules. The Vercel Hobby plan is not for commercial use, so it
is for the demo only.

**Later: Cloudflare Pages** (free, commercial use allowed): production branch `main`, no framework, no build
command, output directory `/`. `_headers` holds the same headers. Once the domain is bought: add it in Pages, make
it the only address (www and the `*.pages.dev` address redirect to it with a Bulk Redirect or a Redirect Rule),
set `siteUrl` in `js/config.js` and run `node tools/build-seo.js`.

Security headers (both hosts): `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
`frame-ancestors 'self'`, `Referrer-Policy`, `Permissions-Policy` (geolocation for the site itself only), HSTS.

## Where to edit things

| What | File |
| --- | --- |
| Restaurant details (phone, WhatsApp, Instagram, address, map pin), hours, delivery (km, fee), payment, hero media, site address, Supabase | `js/config.js` |
| Menu: categories, dishes, descriptions, prices, options (pasta shape) | `js/menu-data.js` |
| Reviews shown on the site | `js/reviews.js` |
| Interface text (French / English) | `js/i18n.js` |
| Page logic (menu, cart, map, order, tracking, install) | `js/app.js` |
| Where orders go (demo / Supabase) | `js/orders.js` |
| Intro animation | `js/intro.js` + `.intro` in `css/style.css` |
| Drawn placeholders (pizza, pasta…) | `js/art.js` |
| Colours, fonts, layout | `css/style.css` (tokens at the top) |
| Staff screen | `commandes/` |
| Privacy and terms of sale | `confidentialite/`, `conditions/` |
| Database | `supabase/schema.sql`, `supabase/functions/push/` |

Brand: green `#1e5c34`, chili red `#c8252c`, cream `#fbf6ec`, gold `#d9a441`; Playfair Display (titles),
DM Sans (text), Pinyon Script (accents), all served from `assets/fonts/` (no Google Fonts call).
The logo files are in `assets/brand/` (white for green backgrounds, green for light ones, and the original).

### Photos

Only the owner's photos are used, never stock or internet photos. A dish photo goes in `assets/photos/<dish id>.webp`
(square, about 600 × 600), then set `image: "/assets/photos/<dish id>.webp"` on the dish in `js/menu-data.js`.
A category cover: `image` on the category. The hero: `heroMedia` in `js/config.js`.
The menu screenshots and review screenshots the owner sent are kept in `docs/source/`.

## After changing things

- Code (CSS or JS): raise the `?v=` number on its link in the HTML pages (and in `CORE` in `sw.js`), and
  `VERSION` in `sw.js`.
- Details, menu or domain: `node tools/build-seo.js` (schema.org data, canonical links, sitemap, robots.txt).
- Share image: `node tools/make-share.js` (needs Playwright).

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Tests

Playwright, at 390 px and 1280 px, in French and English: intro, menu, options, cart, delivery zone (GPS),
ordering and live tracking with the staff screen, cancelling, WhatsApp fallback, anti-spam, closed hours, owner
view and statistics, legal pages, PWA files, headers, reduced motion and JavaScript errors.

```sh
npm install playwright   # once
node tests/site.test.js
SHOTS=tests/screenshots node tests/site.test.js   # also saves screenshots
BASE=https://<domain> node tests/site.test.js      # against the live site (also checks the security headers)
```
