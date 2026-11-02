/*
 * Cibo Napoli: end-to-end checks in headless Chromium (Playwright).
 *   node tests/site.test.js                                   (serves this folder on a local port)
 *   BASE=https://<domain> node tests/site.test.js             (checks the live site)
 *   SHOTS=tests/screenshots node tests/site.test.js           (also saves screenshots to look at)
 * Phone (390 px) and desktop (1280 px), in French and English: text and SEO tags, the intro, the header, the menu
 * (tiles, 2 dishes per row on phones, options before adding, drinks without price), the cart (pickup, delivery
 * zone with GPS, totals), ordering and live tracking with the staff screen (demo mode: same browser), cancelling,
 * WhatsApp as the way out, anti-spam, closed hours, the owner's view and statistics, legal pages, PWA files,
 * reduced motion and JavaScript errors. On the live site the security headers are checked too.
 * With a real Supabase project, the order flow creates real orders: it only runs there with ORDER_TESTS=1.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const SHOTS = process.env.SHOTS || "";
const TYPES = { ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon", ".xml": "application/xml", ".webmanifest": "application/manifest+json", ".txt": "text/plain", ".svg": "image/svg+xml" };
const TEST_PHONE = "0634235350";
// Casablanca is UTC+1 (UTC+0 during Ramadan): 19:00 UTC is open either way, 03:00 UTC is closed.
const OPEN_TIME = new Date("2026-11-02T19:00:00Z");
const CLOSED_TIME = new Date("2026-11-02T03:00:00Z");
const NEAR = { latitude: 33.7450, longitude: -7.3050 }; // about 1.2 km from the restaurant
const FAR = { latitude: 33.5890, longitude: -7.6030 };  // Casablanca centre, about 32 km
const MOHA = { latitude: 33.7000, longitude: -7.3700 }; // east of Mohammedia, inside the drawn zone (6.6 km)
const SOUTH = { latitude: 33.7050, longitude: -7.2900 }; // 4.2 km inland, outside the drawn zone

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { "Content-Type": "text/html" });
        return fs.createReadStream(path.join(ROOT, "404.html")).pipe(res);
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

let failures = 0;
const check = (cond, msg) => { if (cond) console.log("  ✓ " + msg); else { failures++; console.log("  ✗ " + msg); } };
const section = (s) => console.log("\n" + s);

async function newContext(browser, { width, height = 844, time = OPEN_TIME, reducedMotion = "no-preference", geo } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, reducedMotion, serviceWorkers: "block", locale: "fr-FR",
    geolocation: geo, permissions: geo ? ["geolocation"] : [],
  });
  await context.clock.install({ time });
  // no map tiles from the internet during the tests
  await context.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 204, body: "" }));
  return context;
}
async function open(context, url) {
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(url);
  return page;
}
const shot = async (page, name, full = false) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: full }); } };
const count = (page) => page.$eval(".js-cart-count", (e) => (e.hidden ? 0 : Number(e.textContent)));

async function run() {
  const srv = process.env.BASE ? null : await serve();
  const BASE = (process.env.BASE || `http://127.0.0.1:${srv.address().port}`).replace(/\/$/, "");
  const LIVE = !!process.env.BASE;
  const browser = await chromium.launch();
  console.log(`Testing ${BASE}`);

  for (const lang of ["fr", "en"]) {
    for (const width of [390, 1280]) {
      const tag = `${lang}-${width}`;
      const q = lang === "en" ? "?lang=en" : "?";
      const T = lang === "en"
        ? { title: "The taste of Italy on your plate", order: "Order", pasta: "Which pasta?", added: "added", accepted: "Accepted", done: "Buon appetito!", cancelled: "Order cancelled", outZone: "outside our delivery area", closed: "Closed", review: "Write a Google review", buttons: ["Menu", "Book a table", "Directions"], sent: "Request sent!", dark: "Light mode" }
        : { title: "Le goût de l'Italie dans votre assiette", order: "Commander", pasta: "Quelle pâte ?", added: "ajouté", accepted: "Acceptée", done: "Bon appétit !", cancelled: "Commande annulée", outZone: "hors de notre zone", closed: "Fermé", review: "Laisser un avis Google", buttons: ["La carte", "Réserver", "Itinéraire"], sent: "Demande envoyée !", dark: "Mode clair" };
      const amp = q === "?" ? "" : "&";

      section(`[${tag}] intro`);
      {
        // the film: plays, then the real logo takes over from the film's last frame and glides into the header
        const ctx = await newContext(browser, { width });
        const page = await open(ctx, `${BASE}/${q}`);
        check(await page.isVisible(".intro"), "the intro opens");
        await page.waitForFunction(() => { const v = document.querySelector(".intro__video"); return v && v.currentTime > 0.3; }, null, { timeout: 5000 }).catch(() => {});
        check(await page.$eval(".intro", (e) => e.classList.contains("has-video")), "the intro film plays");
        const kind = await page.$eval(".intro__video", (v) => v.currentSrc.includes("landscape") ? "landscape" : "portrait");
        check(kind === (width >= 844 ? "landscape" : "portrait"), `the ${width >= 844 ? "wide" : "tall"} film is used`);
        await page.waitForFunction(() => { const i = document.querySelector(".intro"); return !i || i.classList.contains("is-handoff"); }, null, { timeout: 6000 }).catch(() => {});
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${tag}-intro-handoff.png`) });
        check(await page.$eval(".intro", (e) => e.classList.contains("is-handoff")), "the real logo takes over at the end of the film");
        await page.clock.runFor(800);
        await page.waitForTimeout(150);
        await page.clock.runFor(400);
        await page.waitForTimeout(450);
        check(!(await page.$(".intro")), "the intro is gone after the glide");
        check(await page.$eval(".brand__logo", (e) => getComputedStyle(e).opacity === "1"), "the logo is in the header");
        await ctx.close();
        // the classic intro (when the film can't play)
        const ctx3 = await newContext(browser, { width });
        const p3 = await open(ctx3, `${BASE}/${q}${amp}introvideo=0`);
        check(await p3.isVisible(".intro__logo"), "the classic intro shows the logo");
        await p3.clock.runFor(1500);
        check(await p3.isVisible(".intro"), "the classic intro is still there at 1.5 s");
        await p3.clock.runFor(1900);
        await p3.waitForTimeout(450);
        check(!(await p3.$(".intro")), "the classic intro is gone after about 3 s");
        await ctx3.close();
        const ctx2 = await newContext(browser, { width });
        const p2 = await open(ctx2, `${BASE}/${q}`);
        await p2.mouse.click(10, 300);
        await p2.waitForTimeout(500);
        check(!(await p2.$(".intro")), "a tap skips the intro");
        await ctx2.close();
      }

      section(`[${tag}] home page, header, dark mode`);
      {
        const c = await newContext(browser, { width });
        const h = await open(c, `${BASE}/${q}${amp}intro=0`);
        check(await h.getAttribute("html", "lang") === lang, `html lang is ${lang}`);
        check((await h.textContent(".hero__title")).trim() === T.title, "hero title");
        check(!(await h.$(".hero__kicker")), "no « pizzeria napolitaine » line above the title");
        const btns = await h.$$eval(".hero__cta .btn", (b) => b.map((x) => ({ t: x.textContent.trim(), top: Math.round(x.getBoundingClientRect().top), href: x.getAttribute("href") })));
        check(btns.length === 3 && btns.map((b) => b.t).join("|") === T.buttons.join("|"), "3 hero buttons: menu, book, directions");
        check(btns[0].top === btns[1].top && btns[2].top > btns[0].top, "two side by side, the third under them");
        check(btns[0].href.startsWith("/commander/") && btns[1].href.startsWith("/reserver/") && /maps/.test(btns[2].href), "they open the order page, the booking page and Google Maps");
        check(await h.$eval(".hero__pizza", (e) => e.tagName === "IMG" && /pizza/.test(e.src) && getComputedStyle(e).animationName === "spin"), "a real pizza photo that turns");
        check(!(await h.$("#menu")), "no menu on the home page");
        check(await h.$eval(".hero", (e) => e.nextElementSibling && e.nextElementSibling.id === "histoire"), "« Notre histoire » right under the hero");
        check(/Cibo Napoli/.test(await h.title()), "page title");
        check(await h.$eval('link[rel="canonical"]', (l) => /^https:\/\//.test(l.href)), "canonical link");
        check(await h.$$eval('script[type="application/ld+json"]', (s) => s.some((x) => /"Restaurant"/.test(x.textContent))), "schema.org Restaurant data");
        check(await h.$eval(".status", (e) => e.classList.contains("is-open")), "open at 20:00");
        check(await h.isVisible(".ig-fab") && /instagram\.com\/cibo_napoli/.test(await h.getAttribute(".ig-fab", "href")), "floating Instagram button");
        if (width === 390) {
          check(await h.isVisible(".burger") && !(await h.isVisible(".topnav")), "phones: ☰ button instead of the links");
          await h.click(".burger");
          await h.waitForSelector("#nav-panel.is-open");
          check(await h.$$eval("#nav-panel .navpanel__links a", (a) => a.length) === 6, "the ☰ menu holds all the titles");
          await shot(h, `${tag}-nav`);
          await h.click("#nav-panel [data-theme-toggle]");
        } else {
          check(!(await h.isVisible(".burger")) && await h.isVisible(".topnav"), "PC: the titles in the header");
          const nav = await h.$eval(".topnav", (n) => { const r = n.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - innerWidth / 2); });
          check(nav < 4, "PC: the titles in the middle of the header");
          await h.click(".topbar [data-theme-toggle]");
        }
        check(await h.getAttribute("html", "data-theme") === "dark", "the dark mode button turns the site dark");
        check(await h.evaluate(() => getComputedStyle(document.body).backgroundColor) !== "rgb(251, 246, 236)", "dark background");
        await h.reload();
        check(await h.getAttribute("html", "data-theme") === "dark", "dark mode is remembered");
        check((await h.getAttribute("[data-theme-toggle]", "aria-label")) === T.dark, "…and the button offers light mode");
        await shot(h, `${tag}-home-dark`);
        check(h.errors.length === 0, "no JavaScript errors on the home page" + (h.errors.length ? ": " + h.errors.join(" | ") : ""));
        await c.close();
      }

      section(`[${tag}] order page: menu and cart`);
      const ctx = await newContext(browser, { width, geo: NEAR });
      const page = await open(ctx, `${BASE}/commander/${q}`);
      await page.waitForSelector(".dish");
      check(await page.$eval('link[rel="canonical"]', (l) => /\/commander\/$/.test(l.href)), "its own canonical address");
      check(await page.$eval('.topnav a[href^="/commander/"]', (a) => a.getAttribute("aria-current") === "page"), "the menu marks the page");
      check(await page.$$eval(".cat-tile", (t) => t.length) === 7, "7 category tiles");
      check(await page.$$eval(".dish", (d) => d.length) === 45, "45 dishes");
      check(await page.$$eval(".dish", (d) => d.every((x) => x.querySelector(".dish__price"))), "every dish has a price (or « price soon »)");
      check(await page.$$eval(".dish", (d) => d.filter((x) => !x.querySelector(".dish__desc")).length) === 10, "every dish with a description on the menu shows it");
      if (width === 390) {
        const tops = await page.$$eval("#cat-pizze .dish", (d) => d.slice(0, 3).map((x) => Math.round(x.getBoundingClientRect().top)));
        check(tops[0] === tops[1] && tops[2] > tops[1], "phones: 2 dishes per row");
      }
      check(await page.$$eval("#cat-bevande .dish__add", (b) => b.every((x) => x.disabled)), "drinks without a price cannot be ordered yet");
      check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "no sideways scrolling");
      await shot(page, `${tag}-top`);

      await page.click('.cat-tile[data-cat="ravioli"]');
      const scrolled = await page.waitForFunction(() => Math.abs(document.querySelector("#cat-ravioli").getBoundingClientRect().top) < 260, null, { timeout: 4000 }).catch(() => null);
      check(!!scrolled, "a tile scrolls to its category");

      await page.click('[data-add="bella-margarita"]');
      check(await count(page) === 1, "a pizza goes straight into the cart");
      check((await page.textContent("#toast")).toLowerCase().includes(T.added), "a message says it was added");
      await page.click('[data-add="bolognaise"]');
      await page.waitForSelector("#options.is-open");
      check((await page.textContent(".sheet__group-title")).trim() === T.pasta, "fresh pasta asks for the pasta shape");
      await page.click(".sheet__add");
      check(await count(page) === 1 && await page.isVisible("#options"), "the shape must be chosen first");
      await page.click('.choice:has-text("Spaghetti")');
      await shot(page, `${tag}-options`);
      await page.click(".sheet__add");
      await page.waitForTimeout(300);
      check(await count(page) === 2, "pasta added with its shape");

      await page.click(".cart-btn");
      await page.waitForSelector("#cart.is-open");
      check(await page.$$eval(".line", (l) => l.length) === 2, "two lines in the cart");
      check((await page.textContent(".line__choice")).includes("Spaghetti"), "the line shows the pasta shape");
      check((await page.textContent("#sum-total")).trim() === "104 DH", "total 45 + 59 = 104 DH");
      await page.click('.line:first-child [data-step="1"]');
      check((await page.textContent("#sum-total")).trim() === "149 DH", "+1 margarita: 149 DH");
      await page.click('.line:first-child [data-step="-1"]');

      // delivery: the zone and the fee
      await page.click('.seg label:has-text("' + (lang === "en" ? "Delivery" : "Livraison") + '")');
      await page.waitForSelector("#delivery-map .leaflet-container, #delivery-map.leaflet-container", { timeout: 5000 }).catch(() => {});
      check(await page.$eval("#delivery-map", (e) => e.classList.contains("leaflet-container")), "the delivery map loads");
      await ctx.setGeolocation(FAR);
      await page.click("#gps-btn");
      await page.waitForSelector("#zone-msg.is-bad", { timeout: 4000 }).catch(() => null);
      check((await page.textContent("#zone-msg")).includes(T.outZone), "an address 32 km away is refused");
      check(await page.$eval("#delivery-map", (e) => !!e.querySelector("path.leaflet-interactive")), "the drawn delivery zone is on the map");
      await ctx.setGeolocation(SOUTH);
      await page.click("#gps-btn");
      await page.waitForFunction(() => document.querySelector("#zone-msg").classList.contains("is-bad"), null, { timeout: 4000 }).catch(() => null);
      check(await page.$eval("#zone-msg", (e) => e.classList.contains("is-bad")), "4 km inland, outside the drawn zone: refused");
      await ctx.setGeolocation(MOHA);
      await page.click("#gps-btn");
      const moha = await page.waitForSelector("#zone-msg.is-ok", { timeout: 4000 }).catch(() => null);
      check(!!moha, "east of Mohammedia (6.6 km), inside the zone: accepted");
      await ctx.setGeolocation(NEAR);
      await page.click("#gps-btn");
      const ok = await page.waitForSelector("#zone-msg.is-ok", { timeout: 4000 }).catch(() => null);
      check(!!ok, "an address 1.2 km away is accepted");
      check((await page.textContent("#sum-fee")).trim() === "10 DH" && (await page.textContent("#sum-total")).trim() === "114 DH", "delivery fee 10 DH added");
      await page.fill('[name="name"]', "Test");
      await page.fill('[name="phone"]', "12345");
      await page.click("#order-btn");
      check((await page.textContent("#order-err")).length > 0, "a wrong phone number is refused");
      await page.fill('[name="phone"]', TEST_PHONE);
      await page.click("#order-btn");
      check((await page.textContent("#order-err")).length > 0, "a delivery needs an address");
      await page.fill('[name="address"]', "Rue de test, immeuble 1");
      await shot(page, `${tag}-cart`);

      const demo = await page.evaluate(() => window.ORDERS.demo);
      if (!demo && !process.env.ORDER_TESTS) {
        console.log("  · real Supabase project: order flow skipped (set ORDER_TESTS=1 to run it)");
      } else {
        section(`[${tag}] order, tracking and the staff screen`);
        await page.click("#order-btn");
        await page.waitForSelector("#tracker.is-open .tracker__card");
        check(await count(page) === 0, "the cart is emptied after ordering");
        check(/(N°|No\.) [0-9A-F]{4}/.test(await page.textContent(".tracker__num")), "the tracker shows the order number");
        check(await page.isVisible("[data-track-cancel]"), "the order can be cancelled while it waits");
        await shot(page, `${tag}-tracker-new`);

        const staff = await open(ctx, `${BASE}/commandes/`);
        await staff.click('[data-demo-role="staff"]');
        await staff.click("#start-btn");
        await staff.waitForSelector("#alert:not([hidden])");
        check((await staff.textContent("#alert-body")).includes("Bolognaise") && (await staff.textContent("#alert-body")).includes("Spaghetti"), "the staff screen shows the new order with its options");
        check((await staff.textContent("#alert-body")).includes("Rue de test"), "…and the delivery address");
        await shot(staff, `${tag}-staff-alert`);
        await staff.click('[data-eta="20"]');
        await page.waitForFunction((txt) => document.querySelector(".tracker__head").textContent.includes(txt), T.accepted);
        check(true, "the customer sees « accepted » live");
        check(!(await page.isVisible("[data-track-cancel]")), "no cancelling once accepted");
        check(await staff.isVisible('[data-do="driver"]'), "« Envoyer au livreur » for a delivery");
        await staff.click('[data-do="on_the_way"]');
        await staff.click('[data-do="done"]');
        await page.waitForFunction((txt) => document.querySelector(".tracker__head").textContent.includes(txt), T.done);
        check((await page.textContent(".btn--review")).includes(T.review), "a Google review button after the order");
        check((await page.getAttribute(".btn--review", "href")).includes("placeid=ChIJ"), "it opens the restaurant's review form");
        await shot(page, `${tag}-tracker-done`);
        await shot(staff, `${tag}-staff-board`, true);

        // cancelling while it waits
        await page.click("[data-track-close]");
        await page.click('[data-add="tiramisu"]');
        await page.click(".cart-btn");
        await page.click('.seg label:has-text("' + (lang === "en" ? "Takeaway" : "À emporter") + '")');
        await page.click("#order-btn");
        await page.waitForSelector("[data-track-cancel]");
        await page.click("[data-track-cancel]");
        await page.waitForFunction((txt) => document.querySelector(".tracker__head").textContent.includes(txt), T.cancelled);
        check(true, "the customer can cancel a waiting order");
        await staff.waitForTimeout(300);
        check((await staff.textContent("#list-done")).includes(lang === "en" ? "client" : "client"), "the staff screen shows it cancelled by the customer");

        // no answer after 5 minutes: WhatsApp and call
        await page.click("[data-track-close]");
        await page.click('[data-add="tiramisu"]');
        await page.click(".cart-btn");
        await page.click("#order-btn");
        await page.waitForSelector("#tracker .tracker--new");
        check(!(await page.$("#tracker .btn--wa")), "no WhatsApp button at first");
        await page.clock.runFor(5 * 60e3 + 31e3);
        await page.waitForTimeout(200);
        const wa = await page.getAttribute("#tracker .btn--wa", "href").catch(() => null);
        check(wa && wa.startsWith("https://wa.me/212634235350?text="), "after 5 min without answer: WhatsApp with the order written");
        check(wa && decodeURIComponent(wa).includes("Tiramisu"), "…containing the dishes");
        await staff.close();

        // anti-spam: at most 5 orders per phone in 10 minutes (3 sent already)
        await page.click("[data-track-cancel]");
        await page.click("[data-track-close]");
        await page.evaluate(() => { for (let i = 0; i < 2; i++) window.ORDERS.DemoStore.insert({ id: window.ORDERS.uuid(), token: "x", location: "el-mansouria", mode: "pickup", customer_name: "T", customer_phone: "0634235350", items: [], subtotal: 1, delivery_fee: 0, total: 1 }); });
        await page.click('[data-add="tiramisu"]');
        await page.click(".cart-btn");
        await page.click("#order-btn");
        await page.waitForTimeout(300);
        check((await page.textContent("#order-err")).length > 5, "a 6th order from the same phone within 10 minutes is refused");

        // sending fails: WhatsApp is the way out
        await page.evaluate(() => { window.ORDERS.DemoStore.write([]); window.ORDERS.create = () => Promise.reject(new Error("offline")); });
        await page.click("#order-btn");
        await page.waitForSelector("#tracker .tracker--failed");
        check((await page.getAttribute("#tracker .btn--wa", "href")).startsWith("https://wa.me/212634235350"), "if sending fails, the order goes on WhatsApp");
        await shot(page, `${tag}-tracker-failed`);
      }
      check(page.errors.length === 0, "no JavaScript errors" + (page.errors.length ? ": " + page.errors.join(" | ") : ""));
      await shot(page, `${tag}-full`, true);
      await ctx.close();

      section(`[${tag}] table booking`);
      {
        const c = await newContext(browser, { width });
        const b = await open(c, `${BASE}/reserver/${q}`);
        check(await b.$$eval("#book-days .day", (d) => d.length) === 14, "the next 14 days");
        check(!(await b.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "no sideways scrolling");
        await b.click("#book-btn");
        check((await b.textContent("#book-err")).length > 0, "a day must be chosen");
        await b.click("#book-days .day:nth-child(2)");
        check(await b.$$eval("#book-slots .slot", (s) => s.length) === 23, "half-hour times from 12:00 to 23:00");
        await b.click('#book-slots [data-time="20:30"]');
        for (let i = 0; i < 2; i++) await b.click("#people-more");
        check((await b.textContent("#people-n")).trim() === "4", "4 people");
        await b.click('.seg label:has-text("' + (lang === "en" ? "Yes" : "Oui") + '")');
        check(await b.isVisible("#kids-box"), "children: how many");
        await b.click("#kids-more");
        check((await b.textContent("#kids-n")).trim() === "2", "2 children");
        await b.fill('[name="name"]', "Test");
        await b.fill('[name="phone"]', TEST_PHONE);
        await b.fill('[name="notes"]', "Anniversaire");
        await shot(b, `${tag}-book`, true);
        await b.click("#book-btn");
        await b.waitForSelector("#book-done:not([hidden])");
        check((await b.textContent("#book-done-title")).includes(T.sent), "the request is sent");
        check((await b.textContent("#book-summary")).includes("20:30"), "with a summary");
        await shot(b, `${tag}-book-done`);
        check(b.errors.length === 0, "no JavaScript errors on the booking page" + (b.errors.length ? ": " + b.errors.join(" | ") : ""));
        if (await b.evaluate(() => window.ORDERS.demo)) {
          const st = await open(c, `${BASE}/commandes/`);
          await st.click('[data-demo-role="staff"]');
          await st.click("#start-btn");
          await st.click('[data-tab="book"]');
          await st.waitForSelector("#list-bnew .bk");
          const card = await st.textContent("#list-bnew .bk");
          check(card.includes("20:30") && card.includes("4 personnes") && card.includes("dont 2 enfants") && card.includes("Anniversaire"), "the staff screen shows the request (time, people, children, note)");
          check((await st.textContent("#count-book")).trim() === "1", "a badge counts the requests to confirm");
          check(await st.$eval('#list-bnew a[href^="tel:"]', (a) => a.getAttribute("href") === "tel:0634235350"), "a call button");
          await st.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
          await st.click('[data-bk="confirm-wa"]');
          const waUrl = decodeURIComponent((await st.evaluate(() => window.__opened[0])) || "");
          check(/wa\.me\/212634235350/.test(waUrl) && waUrl.includes("20:30"), "« Confirmer + WhatsApp » writes the confirmation to the customer");
          await st.waitForSelector("#list-bok .bk");
          check(true, "the booking moves to « Confirmées »");
          await shot(st, `${tag}-staff-bookings`, true);
          check(st.errors.length === 0, "no JavaScript errors on the staff screen" + (st.errors.length ? ": " + st.errors.join(" | ") : ""));
        }
        await c.close();
      }

      section(`[${tag}] closed hours, reduced motion`);
      {
        const c = await newContext(browser, { width, time: CLOSED_TIME, reducedMotion: "reduce" });
        const home = await open(c, `${BASE}/${q}`);
        check(!(await home.$(".intro")), "no intro with « reduce motion »");
        check(await home.$eval(".status", (e) => e.classList.contains("is-closed")) && (await home.textContent(".status")).includes(T.closed), "closed at 04:00");
        const p = await open(c, `${BASE}/commander/${q}`);
        await p.click('[data-add="bella-margarita"]');
        await p.click(".cart-btn");
        check(await p.$eval("#order-btn", (b) => b.disabled), "ordering is off while closed");
        await c.close();
      }
    }
  }

  section("[staff] owner's view and statistics");
  {
    const c = await newContext(browser, { width: 1280 });
    const p = await open(c, `${BASE}/commandes/`);
    if (await p.evaluate(() => window.ORDERS.demo)) {
      await p.click('[data-demo-role="owner"]');
      await p.waitForSelector("#tab-stats:not([hidden])");
      check(true, "the owner opens on the statistics");
      await p.click("#menu-btn");
      await p.click('[data-act="seed"]');
      await p.click('[data-p="month"]');
      await p.waitForTimeout(300);
      check(/\d/.test(await p.textContent("#stats-tiles")) && await p.$$eval("#stats-best li", (l) => l.length) > 3, "orders, revenue and best sellers for the month");
      await p.click('[data-p="week"]');
      check(await p.$$eval(".bars__col", (b) => b.length) === 7 || await p.$$eval(".bars__col", (b) => b.length) >= 1, "revenue by day for the week");
      await shot(p, "staff-owner-stats", true);
      await p.click('[data-tab="orders"]');
      check(!(await p.$("#tab-orders [data-do]")), "the owner has no order buttons");
      check(await p.$eval('[data-act="push"]', (b) => getComputedStyle(b).display === "none"), "…and no notifications menu");
      check(p.errors.length === 0, "no JavaScript errors on the staff screen" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
    } else {
      check(await p.isVisible("#login-form"), "the staff screen asks to sign in");
    }
    const p390 = await open(await newContext(browser, { width: 390 }), `${BASE}/commandes/`);
    await shot(p390, "staff-login-390");
  }

  section("[pages] legal pages, files, headers");
  {
    const c = await newContext(browser, { width: 390 });
    for (const lang of ["fr", "en"]) {
      for (const pth of ["/", "/commander/", "/reserver/", "/confidentialite/", "/conditions/"]) {
        const p = await open(c, `${BASE}${pth}${lang === "en" ? "?lang=en&intro=0" : "?intro=0"}`);
        const links = await p.$$eval(".footer a", (a) => a.map((x) => x.getAttribute("href")));
        check(links.some((h) => h.startsWith("/confidentialite/")) && links.some((h) => h.startsWith("/conditions/")), `${pth} (${lang}): footer links to privacy and terms`);
        if (pth === "/confidentialite/" || pth === "/conditions/") {
          check(await p.$eval(`article[lang="${lang}"]`, (a) => a.offsetHeight > 0) && await p.$eval(`article[lang="${lang === "en" ? "fr" : "en"}"]`, (a) => a.offsetHeight === 0), `${pth} (${lang}): shown in ${lang}`);
          await shot(p, `page-${pth.replace(/\//g, "")}-${lang}`, true);
        }
        check(p.errors.length === 0, `${pth} (${lang}): no JavaScript errors`);
        await p.close();
      }
    }
    const priv = await (await c.request.get(`${BASE}/confidentialite/`)).text();
    check(/24 heures/.test(priv) && /Supabase/.test(priv) && /CNDP/.test(priv) && /09-08/.test(priv), "privacy page: 24 h, hosting, CNDP, law 09-08");
    const cgv = await (await c.request.get(`${BASE}/conditions/`)).text();
    check(/31-08/.test(cgv) && /10 DH/.test(cgv) && /espèces/.test(cgv) && /Réservations/.test(cgv), "terms page: law 31-08, delivery fee, payment, bookings");
    check(/réservation/i.test(priv), "privacy page: bookings");
    check(!/conforme|compliant/i.test(priv + cgv), "no claim of being « compliant »");
    for (const f of ["/site.webmanifest", "/sw.js", "/commandes/staff.webmanifest", "/commandes/sw.js", "/robots.txt", "/sitemap.xml", "/assets/share.jpg", "/favicon.ico", "/avis/el-mansouria/", "/commander/", "/reserver/", "/assets/hero/pizza-peperoni.webp"]) {
      check((await c.request.get(BASE + f)).ok(), `${f} is served`);
    }
    const man = await (await c.request.get(`${BASE}/site.webmanifest`)).json();
    check(man.icons.some((i) => i.purpose === "maskable") && man.display === "standalone", "manifest: standalone, maskable icon");
    const avis = await (await c.request.get(`${BASE}/avis/el-mansouria/`)).text();
    check(/writereview\?placeid=ChIJ/.test(avis), "/avis/el-mansouria/ leads to the Google review form");
    check((await (await c.request.get(`${BASE}/sitemap.xml`)).text()).includes("<loc>"), "sitemap lists pages");
    if (LIVE) {
      const h = (await c.request.get(`${BASE}/`)).headers();
      check(h["x-content-type-options"] === "nosniff", "header: nosniff");
      check(/SAMEORIGIN/i.test(h["x-frame-options"] || ""), "header: X-Frame-Options");
      check(/frame-ancestors/.test(h["content-security-policy"] || ""), "header: frame-ancestors");
      check(!!h["referrer-policy"], "header: Referrer-Policy");
      check(/geolocation=\(self\)/.test(h["permissions-policy"] || ""), "header: Permissions-Policy (geolocation for the site only)");
      check(/max-age=\d+/.test(h["strict-transport-security"] || ""), "header: HSTS");
    } else {
      const hdr = fs.readFileSync(path.join(ROOT, "_headers"), "utf8");
      check(["nosniff", "X-Frame-Options", "frame-ancestors", "Referrer-Policy", "geolocation=(self)", "Strict-Transport-Security"].every((x) => hdr.includes(x)), "_headers has the security headers");
    }
    // no secrets in the repo
    if (!LIVE) {
      const cfg = fs.readFileSync(path.join(ROOT, "js/config.js"), "utf8");
      check(!/service_role|vapid_private|sb_secret_/i.test(cfg), "no secret keys in js/config.js");
    }
    await c.close();
  }

  await browser.close();
  if (srv) srv.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
