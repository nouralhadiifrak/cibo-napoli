/*
 * Cibo Napoli: what every customer page shares. Language and text, header (☰ menu on phones, links in the middle on
 * PC), dark mode, install button, open/closed status, Instagram button, toast, maps and the delivery zone, the live
 * order tracker (it follows the customer from page to page), and on the home page: hero, reviews and info.
 * Page code: js/order.js (/commander/), js/reserve.js (/reserver/). They use window.CN.
 */
(function () {
  const C = window.CONFIG;
  const SITE = C.locations[0];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
  };

  /* ---------- Language ---------- */
  const LANG = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "fr";
  const DICT = window.I18N[LANG];
  const t = (key, vars) => {
    let s = DICT[key] != null ? DICT[key] : window.I18N.fr[key] != null ? window.I18N.fr[key] : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  };
  const L = (v) => (v == null ? "" : typeof v === "string" ? v : v[LANG] || v.fr || "");
  const LFR = (v) => (v == null ? "" : typeof v === "string" ? v : v.fr || "");
  const withLang = (url) => {
    if (LANG !== "en" || /[?&]lang=/.test(url)) return url;
    const [p, h] = url.split("#");
    return p + (p.includes("?") ? "&" : "?") + "lang=en" + (h ? "#" + h : "");
  };
  const money = (n) => `${Math.round(n)} ${C.currency}`;
  const nf = (n, d = 1) => n.toLocaleString(LANG === "en" ? "en-GB" : "fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---------- Time (Casablanca) ---------- */
  function casaParts(d = new Date()) {
    const p = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: C.timeZone }).formatToParts(d);
    const g = (k) => p.find((x) => x.type === k).value;
    return { date: `${g("year")}-${g("month")}-${g("day")}`, minutes: +g("hour") * 60 + +g("minute") };
  }
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  function isOpen(d) {
    const m = casaParts(d).minutes;
    const open = toMin(C.hours.open);
    let close = toMin(C.hours.close);
    if (close <= open) close += 1440;
    return (m >= open && m < close) || (m + 1440 >= open && m + 1440 < close);
  }
  function hourLabel(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    if (h === 0 && m === 0) return LANG === "en" ? "midnight" : "minuit";
    if (LANG === "en") {
      if (h === 12 && m === 0) return "noon";
      return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "am" : "pm"}`;
    }
    return `${h}h${m ? String(m).padStart(2, "0") : ""}`;
  }
  const clock = (d) => d.toLocaleTimeString(LANG === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: C.timeZone });

  /* ---------- Text on the page ---------- */
  function applyText() {
    document.documentElement.lang = LANG;
    const page = document.body.dataset.page || "home";
    const titleKey = { home: "meta.title", order: "order.metaTitle", book: "book.metaTitle" }[page];
    const descKey = { home: "meta.description", order: "order.metaDesc", book: "book.metaDesc" }[page];
    document.title = t(titleKey);
    const md = $('meta[name="description"]');
    if (md) md.setAttribute("content", t(descKey));
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml, { privacy: withLang("/confidentialite/"), terms: withLang("/conditions/") }); });
    $$("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    $$("[data-i18n-ph]").forEach((el) => { el.setAttribute("placeholder", t(el.dataset.i18nPh)); });
    $$("[data-lang-link]").forEach((a) => {
      const u = new URL(location.href);
      if (a.dataset.langLink === "en") u.searchParams.set("lang", "en"); else u.searchParams.delete("lang");
      a.href = u.pathname + u.search + u.hash;
      a.setAttribute("aria-current", a.dataset.langLink === LANG ? "true" : "false");
    });
    $$("[data-keep-lang]").forEach((a) => { a.setAttribute("href", withLang(a.getAttribute("href"))); });
    // the current page in the menu
    $$(".topnav a, .navpanel__links a").forEach((a) => {
      const path = new URL(a.href, location.href).pathname;
      if (path === location.pathname && !a.hash) a.setAttribute("aria-current", "page");
    });
    const share = '<svg class="ios__share" viewBox="0 0 24 24" aria-label="⎋"><path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const ios = $("#ios-list");
    if (ios) ios.innerHTML = [1, 2, 3].map((i) => `<li>${esc(t("install.ios." + i)).replace("{icon}", share)}</li>`).join("");
    $$("[data-maps]").forEach((a) => { a.href = SITE.googleMapsUrl; });
    $$("[data-phone]").forEach((a) => { a.href = `tel:${SITE.phoneIntl}`; if (a.dataset.phone === "text") a.textContent = SITE.phone.replace(/(\d{2})(?=\d)/g, "$1 ").trim(); });
    $$("[data-wa]").forEach((a) => { a.href = `https://wa.me/${SITE.whatsapp}`; });
    $$("[data-insta]").forEach((a) => { a.href = SITE.instagram; if (a.dataset.insta === "text") a.textContent = SITE.instagramHandle; });
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ---------- Layers (sheet, drawer, lightbox, phone menu) ---------- */
  let lastFocus = null;
  function openLayer(el) {
    lastFocus = document.activeElement;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("is-open"));
    document.body.classList.add("has-layer");
    const f = el.querySelector("[data-autofocus]") || el.querySelector("button, [href], input, textarea, select");
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 50);
  }
  function closeLayer(el) {
    if (!el || el.hidden) return;
    el.classList.remove("is-open");
    setTimeout(() => { el.hidden = true; }, 220);
    if (!$$(".layer.is-open").length) document.body.classList.remove("has-layer");
    if (el.id === "nav-panel") $$("[data-nav-toggle]").forEach((b) => b.setAttribute("aria-expanded", "false"));
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = $$(".layer.is-open");
    if (open.length) closeLayer(open[open.length - 1]);
  });
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-close]");
    if (c) closeLayer(c.closest(".layer"));
  });

  /* ---------- Header: phone menu, scroll shadow ---------- */
  function setupHeader() {
    const top = $(".topbar");
    const onScroll = () => top.classList.toggle("is-scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    const panel = $("#nav-panel");
    $$("[data-nav-toggle]").forEach((b) => b.addEventListener("click", () => {
      if (panel.classList.contains("is-open")) closeLayer(panel);
      else { b.setAttribute("aria-expanded", "true"); openLayer(panel); }
    }));
    // a link to a part of this page closes the menu
    panel.addEventListener("click", (e) => { if (e.target.closest("a")) closeLayer(panel); });
  }

  /* ---------- Dark mode (the choice is kept on this phone; the first time it follows the phone) ---------- */
  const THEME_KEY = "cibo.theme";
  function setupTheme() {
    const html = document.documentElement;
    const label = () => {
      const dark = html.dataset.theme === "dark";
      $$("[data-theme-toggle]").forEach((b) => {
        b.setAttribute("aria-pressed", dark ? "true" : "false");
        b.setAttribute("aria-label", t(dark ? "nav.light" : "nav.dark"));
        const txt = b.querySelector(".theme-btn__text");
        if (txt) txt.textContent = t(dark ? "nav.light" : "nav.dark");
      });
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", dark ? "#0f1a12" : "#1e5c34");
    };
    $$("[data-theme-toggle]").forEach((b) => b.addEventListener("click", () => {
      html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark";
      store.set(THEME_KEY, html.dataset.theme);
      label();
    }));
    label();
  }

  /* ---------- Status (open / closed) ---------- */
  function updateStatus() {
    const open = isOpen();
    $$("[data-status]").forEach((el) => {
      el.classList.toggle("is-open", open);
      el.classList.toggle("is-closed", !open);
      el.querySelector(".status__text").textContent = open ? t("status.open", { time: hourLabel(C.hours.close) }) : t("status.closed", { time: hourLabel(C.hours.open) });
    });
    document.dispatchEvent(new CustomEvent("cibo-status"));
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 1800);
  }

  /* ---------- Maps (Leaflet, loaded only when needed) and the delivery zone ---------- */
  let leafletP = null;
  function loadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (leafletP) return leafletP;
    leafletP = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = "/vendor/leaflet/leaflet-1.9.4.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "/vendor/leaflet/leaflet-1.9.4.js";
      s.onload = () => resolve(window.L);
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return leafletP;
  }
  const distanceKm = (a, b) => {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  // Inside the drawn zone (ray casting) and within maxKm of the restaurant.
  function inZone(p) {
    if (!p) return false;
    if (distanceKm(SITE.location, p) > C.delivery.maxKm) return false;
    const z = C.delivery.zone;
    if (!z || !z.length) return true;
    let inside = false;
    for (let i = 0, j = z.length - 1; i < z.length; j = i++) {
      const [yi, xi] = z[i], [yj, xj] = z[j];
      if ((yi > p.lat) !== (yj > p.lat) && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const pinIcon = (Lf, cls) => Lf.divIcon({ className: `map-pin ${cls}`, html: "<span></span>", iconSize: [30, 30], iconAnchor: [15, 30] });
  function baseMap(Lf, el, opts) {
    const map = Lf.map(el, opts);
    Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    const zone = Lf.polygon(C.delivery.zone, { color: "#1e5c34", weight: 2, dashArray: "6 6", fillColor: "#2b7a46", fillOpacity: 0.12 }).addTo(map);
    Lf.marker([SITE.location.lat, SITE.location.lng], { icon: pinIcon(Lf, "map-pin--shop"), keyboard: false, title: C.name }).addTo(map);
    map.fitBounds(zone.getBounds(), { padding: [12, 12] });
    return map;
  }
  function setupInfoMap() {
    const el = $("#info-map");
    if (!el) return;
    const go = () => loadLeaflet().then((Lf) => {
      if (el.dataset.ready) return;
      el.dataset.ready = "1";
      baseMap(Lf, el, { scrollWheelZoom: false, dragging: !Lf.Browser.mobile, tap: false });
    });
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "300px" });
      io.observe(el);
    } else go();
  }

  /* ---------- Home: hero, reviews, info ---------- */
  // basil leaves and specks of flour around the plate, and the round « La Buona Cucina » badge
  const HERO_LEAF = (x, y, r, s) => `<svg class="hero__leaf" style="left:${x}%;top:${y}%;transform:rotate(${r}deg) scale(${s})" viewBox="0 0 60 40" aria-hidden="true"><defs><linearGradient id="hl${x}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fae3c"/><stop offset="1" stop-color="#256b1f"/></linearGradient></defs><path d="M3 20C14 3 42 1 57 20 42 39 14 37 3 20z" fill="url(#hl${x})"/><path d="M5 20h48M18 20l-5-7M28 20l-4-9M38 20l-3-8M18 20l-4 6M28 20l-3 8M38 20l-2 7" stroke="#bfe3a5" stroke-opacity=".55" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>`;
  const HERO_DECOR = `<span class="hero__glow" aria-hidden="true"></span><span class="hero__dust" aria-hidden="true"></span>${HERO_LEAF(84, 6, 28, 1)}${HERO_LEAF(-2, 70, -150, .8)}${HERO_LEAF(78, 84, 140, .62)}`;
  const HERO_BADGE = `<span class="hero__badge" aria-hidden="true"><span class="hero__badge-in"><img src="/assets/brand/logo-white.webp" alt="" width="640" height="182"><span>La Buona Cucina Napolitana</span></span></span>`;
  function renderHero() {
    const media = $("#hero-media");
    if (!media) return;
    const facts = $("#hero-facts");
    if (facts) {
      const ico = {
        clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
        bike: '<circle cx="6.5" cy="16.5" r="3"/><circle cx="17.5" cy="16.5" r="3"/><path d="M6.5 16.5l4-7h4l3 7M10 9.5H8M14.5 9.5l1-3h2.5"/>',
        leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l8-8"/>',
      };
      facts.innerHTML = [
        ["clock", t("hero.f1t"), `${hourLabel(C.hours.open)} – ${hourLabel(C.hours.close)}`],
        ["bike", t("hero.f2t"), t("hero.f2s", { fee: money(C.delivery.fee) })],
        ["leaf", t("hero.f3t"), t("hero.f3s")],
      ].map(([i, a, b]) => `<li><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ico[i]}</svg><span><strong>${esc(a)}</strong>${esc(b)}</span></li>`).join("");
    }
    const H = C.heroMedia;
    if (H && H.video) {
      media.innerHTML = `<img class="hero__photo" src="${esc(H.poster)}" alt="" fetchpriority="high">`;
      // The video comes after the page has loaded; if the phone blocks autoplay, the still image stays.
      window.addEventListener("load", () => {
        const v = document.createElement("video");
        Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, poster: H.poster, src: H.video });
        v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.className = "hero__photo";
        const p = v.play();
        if (p && p.then) p.then(() => media.replaceChildren(v)).catch(() => { /* autoplay blocked: keep the still */ });
      });
    } else if (H && H.image) {
      media.innerHTML = `<div class="hero__stage">${HERO_DECOR}<div class="hero__plate"><img class="hero__pizza${H.spin ? " is-spinning" : ""}" src="${esc(H.image)}"${H.small ? ` srcset="${esc(H.small)} 480w, ${esc(H.image)} 960w" sizes="(max-width: 899px) 78vw, 520px"` : ""} alt="Pizza · Cibo Napoli" width="960" height="960" fetchpriority="high"></div>${HERO_BADGE}</div>`;
    } else {
      media.innerHTML = `<div class="hero__stage">${HERO_DECOR}<div class="hero__plate">${window.ART.svg("pizza", "hero__pizza is-spinning")}</div>${HERO_BADGE}</div>`;
    }
  }
  const reviewUrl = () => `https://search.google.com/local/writereview?placeid=${SITE.placeId}`;
  function renderReviews() {
    const list = $("#reviews-list");
    if (!list) return;
    list.innerHTML = window.REVIEWS.map((r) => `
      <figure class="review">
        <div class="review__top"><span class="review__avatar" aria-hidden="true">${esc(r.author[0])}</span><span class="review__stars" aria-label="${r.stars}/5">${"★".repeat(r.stars)}</span><span class="review__mark" aria-hidden="true">&rdquo;</span></div>
        <blockquote class="review__text" lang="${r.lang}">${esc(r.text)}</blockquote>
        <figcaption class="review__who"><span class="review__name">${esc(r.author)}</span><span class="review__src">${esc(t("reviews.ago"))}</span></figcaption>
      </figure>`).join("");
    $$("[data-review-link]").forEach((a) => { a.href = reviewUrl(); });
  }
  function renderInfo() {
    if (!$("#info-hours")) return;
    $("#info-hours").textContent = `${t("info.everyday")} · ${hourLabel(C.hours.open)} – ${hourLabel(C.hours.close)}`;
    $("#info-address").textContent = [SITE.streetAddress, L(SITE.address)].filter(Boolean).join(", ");
    $("#info-delivery").textContent = t("info.deliveryText", { fee: money(C.delivery.fee) });
    $("#info-payment").textContent = t("info.paymentText");
  }

  /* ---------- Live order tracking (follows the customer on every page) ---------- */
  const LAST_KEY = "cibo.order.v1";
  const shortNum = (id) => id.slice(0, 4).toUpperCase();
  const waLink = (text, number = SITE.whatsapp) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  let stopWatch = null, trackTimer = null;
  function startTracking(rec) {
    if (!$("#tracker")) return;
    if (stopWatch) stopWatch();
    showTracker(rec, { status: "new", created_at: new Date(rec.at).toISOString() });
    stopWatch = window.ORDERS.watch(rec.id, rec.token, (o, e) => {
      if (e) return; // a failed check: try again at the next one
      if (o === null) { store.del(LAST_KEY); hideTracker(); return; } // gone (erased)
      showTracker(rec, o);
      if (["done", "refused", "cancelled"].includes(o.status) && stopWatch) { stopWatch(); stopWatch = null; }
    });
    clearInterval(trackTimer);
    trackTimer = setInterval(() => { const r = store.get(LAST_KEY); if (r && r.lastSeen) showTracker(r, r.lastSeen); }, 30e3);
  }
  function hideTracker() {
    const el = $("#tracker");
    el.classList.remove("is-open");
    setTimeout(() => { el.hidden = true; }, 250);
    document.body.classList.remove("has-tracker");
    clearInterval(trackTimer);
  }
  function showTracker(rec, o) {
    const el = $("#tracker");
    const s = o ? o.status : "failed";
    if (o && rec.id) { rec.lastSeen = o; store.set(LAST_KEY, rec); }
    const steps = ["sent", "accepted", rec.mode === "delivery" ? "on_the_way" : "ready", "done"];
    const reached = { new: 0, accepted: 1, ready: 2, on_the_way: 2, done: 3 }[s];
    const final = ["done", "refused", "cancelled"].includes(s);
    const waited = o && s === "new" ? (Date.now() - Date.parse(o.created_at)) / 60e3 : 0;
    const eta = o && o.accepted_at && o.eta_minutes ? new Date(Date.parse(o.accepted_at) + o.eta_minutes * 60e3) : null;
    const head = {
      new: t("track.new"), accepted: t("track.accepted"), ready: t("track.ready"), on_the_way: t("track.on_the_way"),
      done: t("track.done"), refused: t("track.refused"), cancelled: t("track.cancelled"), failed: t("track.failed"),
    }[s];
    let hint = "";
    if (s === "new") hint = t("track.newHint");
    if (s === "accepted" && eta) hint = t(rec.mode === "delivery" ? "track.acceptedHint.delivery" : "track.acceptedHint.pickup", { time: clock(eta) });
    if (s === "refused" && o.refuse_reason) hint = t("track.reason", { reason: o.refuse_reason });
    if (s === "cancelled" && o.cancelled_by === "staff") hint = t("track.byStaff") + (o.cancel_reason ? " " + t("track.reason", { reason: o.cancel_reason }) : "");
    const showWa = s === "failed" || (s === "new" && waited >= C.orders.callAfterMinutes) || s === "refused";
    el.innerHTML = `
      <div class="tracker__card tracker--${s}" role="status" aria-live="polite">
        <div class="tracker__top">
          <p class="tracker__num">${rec.id ? esc(t("track.title", { num: shortNum(rec.id) })) : esc(C.name)}</p>
          ${final || s === "failed" ? `<button class="tracker__x" type="button" data-track-close aria-label="${esc(t("track.close"))}">×</button>` : `<button class="tracker__x" type="button" data-track-min aria-label="${esc(t("track.min"))}">–</button>`}
        </div>
        <p class="tracker__head">${s === "new" ? '<span class="pulse" aria-hidden="true"></span>' : ""}${esc(head)}</p>
        ${hint ? `<p class="tracker__hint">${esc(hint)}</p>` : ""}
        ${reached != null ? `<ol class="steps">${steps.map((st, i) => `<li class="${i < reached ? "is-done" : i === reached ? "is-now" : ""}">${esc(t("track.step." + st))}</li>`).join("")}</ol>` : ""}
        ${s === "done" ? `<p class="tracker__grazie">${esc(t("track.grazie"))}</p><a class="btn btn--review" href="${esc(reviewUrl())}" target="_blank" rel="noopener">★ ${esc(t("track.review"))}</a>` : ""}
        ${s === "new" && waited >= C.orders.callAfterMinutes ? `<p class="tracker__hint">${esc(t("track.noAnswer"))}</p>` : ""}
        <div class="tracker__actions">
          ${showWa ? `<a class="btn btn--wa" href="${esc(waLink(rec.wa))}" target="_blank" rel="noopener">${esc(t("track.whatsapp"))}</a>` : ""}
          ${s === "new" || s === "failed" || s === "refused" ? `<a class="btn btn--ghost" href="tel:${esc(SITE.phoneIntl)}">${esc(t("track.call"))}</a>` : ""}
          ${s === "new" ? `<button class="btn btn--ghost btn--danger" type="button" data-track-cancel>${esc(t("track.cancel"))}</button>` : ""}
        </div>
        ${window.ORDERS.demo && rec.id && !final ? `<p class="tracker__demo">${t("track.demo", { link: '<a href="/commandes/" target="_blank" rel="noopener">/commandes/</a>' })}</p>` : ""}
      </div>
      <button class="tracker__pill" type="button" data-track-max>${s === "new" ? '<span class="pulse" aria-hidden="true"></span>' : ""}${esc(head)}</button>`;
    el.hidden = false;
    document.body.classList.add("has-tracker");
    requestAnimationFrame(() => el.classList.add("is-open"));
    el.onclick = async (e) => {
      if (e.target.closest("[data-track-close]")) { store.del(LAST_KEY); hideTracker(); }
      if (e.target.closest("[data-track-min]")) el.classList.add("is-min");
      if (e.target.closest("[data-track-max]")) el.classList.remove("is-min");
      if (e.target.closest("[data-track-cancel]")) {
        if (!confirm(t("track.cancelConfirm"))) return;
        try { await window.ORDERS.cancel(rec.id, rec.token); } catch (err) { alert(t("track.cancelTooLate")); }
      }
    };
  }
  function resumeTracking() {
    const rec = store.get(LAST_KEY);
    if (!rec || !rec.id) return;
    if (Date.now() - rec.at > 24 * 3600e3) { store.del(LAST_KEY); return; }
    startTracking(rec);
  }

  /* ---------- Installable app ---------- */
  let installEvt = null;
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const LATER_KEY = "cibo.install.later";
  const canInstall = () => !standalone() && (installEvt || isIOS());
  function refreshInstall() { $$("[data-install]").forEach((b) => { b.hidden = !canInstall(); }); }
  async function doInstall() {
    const banner = $("#install-banner");
    if (banner) banner.classList.remove("is-on");
    if (installEvt) {
      installEvt.prompt();
      try { await installEvt.userChoice; } catch (e) { /* closed */ }
      installEvt = null;
      refreshInstall();
    } else if (isIOS() && $("#ios-steps")) {
      openLayer($("#ios-steps"));
    }
  }
  let nudged = false;
  function installNudge() {
    const banner = $("#install-banner");
    if (!banner || nudged || !canInstall()) return;
    const later = store.get(LATER_KEY);
    if (later && Date.now() - later < 14 * 864e5) return;
    nudged = true;
    setTimeout(() => banner.classList.add("is-on"), 1200);
  }
  function setupInstall() {
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; refreshInstall(); });
    window.addEventListener("appinstalled", () => { installEvt = null; refreshInstall(); const b = $("#install-banner"); if (b) b.classList.remove("is-on"); });
    $$("[data-install]").forEach((b) => b.addEventListener("click", doInstall));
    const go = $("#install-go"), later = $("#install-later");
    if (go) go.addEventListener("click", doInstall);
    if (later) later.addEventListener("click", () => { store.set(LATER_KEY, Date.now()); $("#install-banner").classList.remove("is-on"); });
    refreshInstall();
    setTimeout(installNudge, 10000);
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => { /* no offline copy */ }));
    }
    window.addEventListener("offline", () => toast(t("toast.offline")));
  }

  /* ---------- Rolling numbers (each digit rolls to its new value, like an odometer) ----------
   * roll(el, "135 DH") · roll(el, value, from) to roll from a given old value (an element drawn again).
   * The real text stays in the element (screen readers, copy); the rolling strip is drawn by CSS (.roll__d::after). */
  const reduceMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  function roll(el, value, from) {
    if (!el) return;
    value = String(value);
    const prev = from != null ? String(from) : el.dataset.roll;
    if (from == null && prev === value && el.querySelector(".roll__d")) return;
    el.dataset.roll = value;
    el.classList.add("roll");
    const chars = Array.from(value);
    const old = prev != null ? Array.from(prev) : null;
    const animate = !!old && prev !== value && !reduceMotion();
    const oldDigit = (fromRight) => { const c = old && old[old.length - 1 - fromRight]; return c && /\d/.test(c) ? c : "0"; };
    el.innerHTML = chars.map((c, i) => {
      if (!/\d/.test(c)) return esc(c);
      const start = animate ? oldDigit(chars.length - 1 - i) : c;
      return `<span class="roll__d" style="--d:${start};--delay:${animate ? i * 55 : 0}ms" data-to="${c}"><i>${c}</i></span>`;
    }).join("");
    if (animate) {
      void el.offsetWidth;
      el.querySelectorAll(".roll__d").forEach((d) => d.style.setProperty("--d", d.dataset.to));
    }
  }

  /* ---------- Flying emojis from a button (after « add to cart ») ---------- */
  const EMOJI_ART = { pizza: "🍕", pasta: "🍝", ravioli: "🥟", lasagna: "🍝", plate: "🍗", dessert: "🍰", drink: "🥤" };
  const EMOJI_WORDS = [
    [/gamber|gambas/, "🦐"], [/tonno/, "🐟"], [/fungh|champignon|truff/, "🍄"], [/pollo|poulet|milanese/, "🍗"],
    [/diavola|arrabiata|chorizo|peperoni|fuoco/, "🌶️"], [/pesto|verdura/, "🌿"], [/formaggi|stracciatella|alfredo/, "🧀"],
    [/carne|bolognaise|maradona/, "🥩"], [/margarita|marinara|napolitaine|nonna/, "🍅"], [/tiramisu/, "☕"],
    [/panna|creme-brulee/, "🍮"], [/cheesecake/, "🍰"], [/mangue/, "🥭"], [/fruits-rouges/, "🍓"],
  ];
  function emojiFor(item, cat) {
    const main = (item && item.emoji) || EMOJI_ART[cat && cat.art] || "🍽️";
    const hit = item && EMOJI_WORDS.find(([re]) => re.test(item.id));
    return hit && hit[1] !== main ? [main, main, hit[1]] : [main];
  }
  function burst(fromEl, emojis) {
    if (!fromEl || !emojis || !emojis.length || reduceMotion() || !document.body.animate) return;
    const r = fromEl.getBoundingClientRect();
    if (!r.width) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const layer = document.createElement("div");
    layer.className = "burst";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    const n = 10;
    for (let i = 0; i < n; i++) {
      const e = document.createElement("span");
      e.textContent = emojis[i % emojis.length];
      e.style.left = `${cx}px`;
      e.style.top = `${cy}px`;
      e.style.fontSize = `${20 + Math.random() * 14}px`;
      layer.appendChild(e);
      const dx = (Math.random() - 0.5) * 200, dy = -110 - Math.random() * 130, rot = (Math.random() - 0.5) * 120;
      e.animate([
        { transform: "translate(-50%, -50%) scale(.2)", opacity: 0 },
        { transform: `translate(-50%, -50%) translate(${dx * 0.35}px, ${dy * 0.45}px) scale(1.15)`, opacity: 1, offset: 0.25 },
        { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(.85)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 500, delay: i * 28, easing: "cubic-bezier(.2, .7, .3, 1)", fill: "both" });
    }
    setTimeout(() => layer.remove(), 1900);
  }

  window.CN = {
    C, SITE, LANG, $, $$, esc, store, t, L, LFR, withLang, money, nf, casaParts, toMin, isOpen, hourLabel, clock,
    openLayer, closeLayer, toast, loadLeaflet, baseMap, pinIcon, distanceKm, inZone, startTracking, showTracker, waLink, shortNum,
    installNudge, roll, burst, emojiFor, reduceMotion,
  };

  /* ---------- Turning rings on the buttons: only those on screen turn (saves the phone's battery) ---------- */
  function ringsOnScreen() {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle("ring-off", !e.isIntersecting)));
    const seen = new WeakSet();
    const scan = () => document.querySelectorAll(".btn:not(.btn--text), .dish__add, .sig__add").forEach((b) => {
      if (seen.has(b)) return;
      seen.add(b);
      b.classList.add("ring-off");
      io.observe(b);
    });
    scan();
    new MutationObserver(() => { clearTimeout(ringsOnScreen.t); ringsOnScreen.t = setTimeout(scan, 100); }).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- Start ---------- */
  applyText();
  // the cart count in the header on every page (the order page keeps it up to date itself)
  const inCart = (store.get("cibo.cart.v1") || []).reduce((n, l) => n + (l.qty || 0), 0);
  $$(".js-cart-count").forEach((el) => { roll(el, inCart); el.hidden = !inCart; });
  setupHeader();
  setupTheme();
  ringsOnScreen();
  renderHero();
  renderReviews();
  renderInfo();
  updateStatus();
  setInterval(updateStatus, 60e3);
  setupInstall();
  setupInfoMap();
  resumeTracking();
})();
