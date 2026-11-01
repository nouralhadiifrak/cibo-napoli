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
Animations will be reworked later (intro in js/intro.js, kept separate on purpose).

## Facts from the owner

- Hours: every day 12:00 – 00:00.
- Phone and WhatsApp: 0634235350 for everything for now (also the test number).
- Delivery: up to 4 km around the restaurant, 10 DH flat. No minimum order.
- Payment: cash on delivery; cash or card for pickup.
- Drinks: Hawai, Coca-Cola, Sprite, Schweppes, Poms; no size mentioned.
- Two accounts later: one owner, one staff.
- Hero photo/video: later. Domain: not bought yet.
- Google Maps: https://maps.app.goo.gl/SZC2hhTLup2dU2f38 (pin 33.7372332, -7.3142341; Place ID ChIJWcsRBQCxpw0RGfvunC8altw).

## Still open

- Drink prices (shown as « Prix bientôt », not orderable).
- Street address (the Google profile is being fixed).
- Arrabiata Fuoco description: the menu scan reads « piment mester ail »; written as « piment, ail ». To confirm.
- Pasta shape choice (fusilli/spaghetti/tagliatelle) assumed for all « Pasta fresca »; not for ravioli, lasagna, plats.
- Dish photos (the menu scans are too small to use): originals from the owner.
- Legal: seller's full address and e-mail; CNDP number (blank space left); no RC/ICE/IF.
- Supabase project, accounts, push keys; then Cloudflare Pages and the domain.
