# Handoff: Cibo Napoli website

Paste this into a new Claude Code session, or tell it: "Read HANDOFF.md first."

Project: website and online ordering for Cibo Napoli, Neapolitan pizzeria, one restaurant in El Mansouria (Morocco).
Repo: nouralhadiifrak/cibo-napoli. Open a PR for every change; merge only when I say "merge" or "ok merge it".
Reference: nouralhadiifrak/chicken-amine works the same way, but do NOT copy its look, logo, photos, texts or colours.
Write to me in simple, short English. Ask before guessing anything about the restaurant.

Stack: plain HTML/CSS/JS, no build. Demo on Vercel now, Cloudflare Pages later (`_headers` ready). Supabase later
(EU region, free plan); until then orders run in demo mode (localStorage, see README).
Languages: French by default, English at ?lang=en. No Arabic.
Tests: `node tests/site.test.js` (390 px and 1280 px, FR and EN); check the screenshots before every PR.
After any CSS/JS change raise the ?v= numbers (and VERSION in sw.js).
Old phones: no aspect-ratio or :has() without fallback; a still image if video autoplay is blocked.
Never commit secrets. Never use stock photos: only the owner's.
Intro in js/intro.js, kept separate on purpose; its films are in assets/intro/.

## Facts from the owner

- Hours: every day 12:00 – 00:00.
- Phone and WhatsApp: 0634235350 for everything for now (also the test number).
- Delivery: the zone the owner drew (El Mansouria along the coast + east of Mohammedia), max 8 km, 10 DH. No minimum order.
- Pages: home (no menu on it), /commander/ (menu + order), /reserver/ (table booking, confirmed by the staff by call or WhatsApp).
- Payment: cash on delivery; cash or card for pickup.
- Drinks: Hawai, Coca-Cola, Sprite, Schweppes, Poms; no size mentioned.
- Two accounts later: one owner, one staff.
- Hero: the pizza on a white plate, cut out (assets/hero/pizza-plate*.webp), on the dark home page with a warm light
  under it. Domain: not bought yet.
- Home and menu pages are always dark (`.lux`), whatever the theme button says; the other pages follow the theme.
- Waiting for the owner's photos: the 4 signature dishes (`image` in js/menu-data.js) and the 3 story photos
  (`homePhotos` in js/config.js: team, plate, outside). Placeholders say which photo goes where.
- Intro: the 4 s pizza box film, then the logo glides into the header (classic logo-on-green intro as the fallback).
  Phones play the same film as computers, cut to a tall frame (assets/intro/intro-portrait-v2.*, made from
  intro-landscape with ffmpeg: crop 700 px around the middle, scale to 720 x 1110, pad to 1280 with the edges smeared).
- Order page shows one category at a time (tiles, chips, « Catégorie suivante » at the end).
- Buttons: WhatsApp green, call orange, Google review in Google's look, « La Carte » orange with a menu icon.
- Italian band (tricolore + gold words) between the hero and the signature collection.
- Signature collection on phones: native swipe + slow drift (js/home.js).
- Orders only reach /commandes/ in the SAME browser until Supabase is set up (demo mode).
  The logo's place in each film's last frame is `LAST` in `js/intro.js`: measure it again if the films change.
  No dark-mode button (removed); « Installer » lives in the ☰ panel.
- Google Maps: https://maps.app.goo.gl/SZC2hhTLup2dU2f38 (pin 33.7372332, -7.3142341; Place ID ChIJWcsRBQCxpw0RGfvunC8altw).

## Still open

- Drink prices (shown as « Prix bientôt », not orderable).
- Is 10 DH right for the whole new zone (up to 8 km)?
- Booking times assumed 12:00 – 23:00, up to 20 people, up to 60 days ahead.
- Item 8 of the second modification list was empty.
- Street address (the Google profile is being fixed).
- Arrabiata Fuoco description: the menu scan reads « piment mester ail »; written as « piment, ail ». To confirm.
- Pasta shape choice (fusilli/spaghetti/tagliatelle) assumed for all « Pasta fresca »; not for ravioli, lasagna, plats.
- Dish photos (the menu scans are too small to use): originals from the owner.
- Legal: seller's full address and e-mail; CNDP number (blank space left); no RC/ICE/IF.
- Supabase project, accounts, push keys; then Cloudflare Pages and the domain.
