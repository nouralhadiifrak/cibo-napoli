/*
 * Cibo Napoli: the customer site. Menu, cart, pickup or delivery (map, 4 km, flat fee), online order with live
 * tracking (js/orders.js; WhatsApp only as the way out), reviews, info, installable app.
 * Text comes from js/i18n.js (French by default, English at ?lang=en); details from js/config.js; the menu from
 * js/menu-data.js; drawn placeholders from js/art.js.
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
  const params = new URLSearchParams(location.search);
  const LANG = params.get("lang") === "en" ? "en" : "fr";
  const DICT = window.I18N[LANG];
  const t = (key, vars) => {
    let s = DICT[key] != null ? DICT[key] : window.I18N.fr[key] != null ? window.I18N.fr[key] : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  };
  const L = (v) => (v == null ? "" : typeof v === "string" ? v : v[LANG] || v.fr || "");
  const LFR = (v) => (v == null ? "" : typeof v === "string" ? v : v.fr || "");
  const withLang = (url) => (LANG === "en" ? url + (url.includes("?") ? "&" : "?") + "lang=en" : url);
  const money = (n) => `${Math.round(n)} ${C.currency}`;
  const nf = (n, d = 1) => n.toLocaleString(LANG === "en" ? "en-GB" : "fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---------- Time (Casablanca) ---------- */
  const now = () => new Date();
  function casaMinutes(d = now()) {
    const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: C.timeZone }).formatToParts(d);
    const h = +parts.find((p) => p.type === "hour").value;
    const m = +parts.find((p) => p.type === "minute").value;
    return h * 60 + m;
  }
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  function isOpen(d) {
    const m = casaMinutes(d);
    const open = toMin(C.hours.open);
    let close = toMin(C.hours.close);
    if (close <= open) close += 1440; // closes after midnight (or at midnight)
    return (m >= open && m < close) || (m + 1440 >= open && m + 1440 < close);
  }
  function hourLabel(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    if (h === 0 && m === 0) return LANG === "en" ? "midnight" : "minuit";
    if (LANG === "en") {
      if (h === 12 && m === 0) return "noon";
      const hh = h % 12 || 12;
      return `${hh}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "am" : "pm"}`;
    }
    return `${h}h${m ? String(m).padStart(2, "0") : ""}`;
  }
  const clock = (d) => d.toLocaleTimeString(LANG === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: C.timeZone });

  /* ---------- Menu helpers ---------- */
  const ITEMS = new Map();
  window.MENU.forEach((cat) => cat.items.forEach((it) => ITEMS.set(it.id, { item: it, cat })));
  const optionGroup = (item, cat) => {
    const key = item.options !== undefined ? item.options : cat.options;
    return key ? window.OPTION_GROUPS[key] : null;
  };
  const catFrom = (cat) => Math.min(...cat.items.map((i) => i.price).filter((p) => p != null));

  /* ---------- Static text ---------- */
  function applyText() {
    document.documentElement.lang = LANG;
    document.title = t("meta.title");
    const md = $('meta[name="description"]');
    if (md) md.setAttribute("content", t("meta.description"));
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    $$("[data-i18n-ph]").forEach((el) => { el.setAttribute("placeholder", t(el.dataset.i18nPh)); });
    $$("[data-lang-link]").forEach((a) => {
      const to = a.dataset.langLink;
      const u = new URL(location.href);
      if (to === "en") u.searchParams.set("lang", "en"); else u.searchParams.delete("lang");
      u.hash = "";
      a.href = u.pathname + u.search;
      a.setAttribute("aria-current", to === LANG ? "true" : "false");
    });
    $$("[data-keep-lang]").forEach((a) => { a.href = withLang(a.getAttribute("href")); });
    $("#order-legal").innerHTML = t("cart.legal", { terms: withLang("/conditions/"), privacy: withLang("/confidentialite/") });
    const share = '<svg class="ios__share" viewBox="0 0 24 24" aria-label="⎋"><path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    $("#ios-list").innerHTML = [1, 2, 3].map((i) => `<li>${esc(t("install.ios." + i)).replace("{icon}", share)}</li>`).join("");
    $("#cart-empty-art").innerHTML = window.ART.svg("pizza");
  }

  /* ---------- Hero ---------- */
  function renderHero() {
    const facts = $("#hero-facts");
    facts.innerHTML = [
      t("hero.fact.hours", { open: hourLabel(C.hours.open), close: hourLabel(C.hours.close) }),
      t("hero.fact.delivery", { km: C.delivery.maxKm, fee: money(C.delivery.fee) }),
      t("hero.fact.pickup"),
    ].map((f) => `<li>${esc(f)}</li>`).join("");
    const media = $("#hero-media");
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
      media.innerHTML = `<img class="hero__photo" src="${esc(H.image)}" alt="" fetchpriority="high">`;
    } else {
      media.innerHTML = `<div class="hero__plate">${window.ART.svg("pizza", "hero__pizza")}</div>`;
    }
    updateStatus();
    setInterval(updateStatus, 60e3);
  }
  function updateStatus() {
    const open = isOpen();
    $$("[data-status]").forEach((el) => {
      el.classList.toggle("is-open", open);
      el.classList.toggle("is-closed", !open);
      el.querySelector(".status__text").textContent = open ? t("status.open", { time: hourLabel(C.hours.close) }) : t("status.closed", { time: hourLabel(C.hours.open) });
    });
    renderCart();
  }

  /* ---------- Menu ---------- */
  function media(item, cat, cls) {
    if (item && item.image) {
      return `<img class="${cls}__img" src="${esc(item.image)}" alt="${esc(L(item.name))}" loading="lazy" width="600" height="600">`;
    }
    return `<span class="${cls}__art ${cls}__art--${cat.art}">${window.ART.svg(cat.art)}</span>`;
  }
  function renderMenu() {
    $("#cat-tiles").innerHTML = window.MENU.map((cat) => `
      <a class="cat-tile cat-tile--${cat.art}" href="#cat-${cat.id}" data-cat="${cat.id}">
        <span class="cat-tile__media">${cat.image ? `<img src="${esc(cat.image)}" alt="" loading="lazy">` : window.ART.svg(cat.art)}</span>
        <span class="cat-tile__text">
          <span class="cat-tile__name">${esc(L(cat.name))}</span>
          <span class="cat-tile__meta">${esc(cat.art === "drink" ? t("menu.drinks", { n: cat.items.length }) : cat.items.length === 1 ? t("menu.dish") : t("menu.dishes", { n: cat.items.length }))}${Number.isFinite(catFrom(cat)) ? ` · ${esc(t("menu.from", { price: money(catFrom(cat)) }))}` : ""}</span>
        </span>
      </a>`).join("");
    $("#cat-chips").innerHTML = window.MENU.map((cat) => `<a class="chip" href="#cat-${cat.id}" data-chip="${cat.id}">${esc(L(cat.name))}</a>`).join("");
    $("#menu-sections").innerHTML = window.MENU.map((cat) => `
      <section class="cat" id="cat-${cat.id}" aria-labelledby="cat-${cat.id}-title">
        <header class="cat__head">
          <h3 class="cat__title" id="cat-${cat.id}-title">${esc(L(cat.name))}</h3>
          ${cat.sub ? `<p class="cat__sub">${esc(L(cat.sub))}</p>` : ""}
        </header>
        <div class="dishes">
          ${cat.items.map((it) => `
            <article class="dish" id="dish-${it.id}" data-id="${it.id}">
              <div class="dish__media${it.image ? " has-photo" : ""}" ${it.image ? `role="button" tabindex="0" aria-label="${esc(t("menu.photo", { name: L(it.name) }))}"` : ""}>${media(it, cat, "dish")}</div>
              <div class="dish__body">
                <h4 class="dish__name">${esc(L(it.name))}</h4>
                ${it.desc ? `<p class="dish__desc">${esc(L(it.desc))}</p>` : ""}
                <div class="dish__foot">
                  <span class="dish__price${it.price == null ? " is-soon" : ""}">${it.price == null ? esc(t("menu.priceSoon")) : money(it.price)}</span>
                  <button class="dish__add" type="button" data-add="${it.id}" aria-label="${esc(t("menu.add", { name: L(it.name) }))}"${it.price == null ? " disabled" : ""}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
                  </button>
                </div>
              </div>
              <span class="dish__qty" data-qty="${it.id}" hidden></span>
            </article>`).join("")}
        </div>
      </section>`).join("");

    // the chip of the category on screen
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const id = e.target.id.replace("cat-", "");
          $$(".chip").forEach((c) => c.classList.toggle("is-active", c.dataset.chip === id));
          const chip = $(`.chip[data-chip="${id}"]`);
          const bar = $("#cat-chips");
          if (chip && bar) bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      $$(".cat").forEach((s) => io.observe(s));
    }
    $("#menu").addEventListener("click", (e) => {
      const tile = e.target.closest("[data-cat]");
      if (tile) installNudge();
      const add = e.target.closest("[data-add]");
      if (add) addFromMenu(add.dataset.add, add);
    });
    setupPhotos();
    updateQtyBadges();
  }

  /* ---------- Big photo (click on PC, long press on phones) ---------- */
  function setupPhotos() {
    const open = (el) => {
      const id = el.closest(".dish").dataset.id;
      const { item } = ITEMS.get(id);
      if (!item.image) return;
      const box = $("#lightbox");
      box.querySelector("img").src = item.image;
      box.querySelector("img").alt = L(item.name);
      box.querySelector(".lightbox__cap").textContent = L(item.name);
      openLayer(box);
    };
    let timer = null;
    let longPressed = false;
    const sections = $("#menu-sections");
    sections.addEventListener("pointerdown", (e) => {
      const m = e.target.closest(".dish__media.has-photo");
      if (!m || e.pointerType === "mouse") return;
      longPressed = false;
      timer = setTimeout(() => { longPressed = true; open(m); }, 420);
    });
    ["pointerup", "pointercancel", "pointerleave", "pointermove"].forEach((ev) => sections.addEventListener(ev, (e) => {
      if (ev === "pointermove" && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return;
      clearTimeout(timer);
    }));
    sections.addEventListener("contextmenu", (e) => { if (e.target.closest(".dish__media.has-photo")) e.preventDefault(); });
    sections.addEventListener("click", (e) => {
      const m = e.target.closest(".dish__media.has-photo");
      if (!m) return;
      if (longPressed) { longPressed = false; return; }
      open(m);
    });
    sections.addEventListener("keydown", (e) => {
      const m = e.target.closest(".dish__media.has-photo");
      if (m && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(m); }
    });
  }

  /* ---------- Layers (sheet, drawer, lightbox) ---------- */
  let lastFocus = null;
  function openLayer(el) {
    lastFocus = document.activeElement;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("is-open"));
    document.body.classList.add("has-layer");
    const f = el.querySelector("[data-autofocus]") || el.querySelector("button, [href], input, textarea");
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 50);
  }
  function closeLayer(el) {
    if (!el || el.hidden) return;
    el.classList.remove("is-open");
    setTimeout(() => { el.hidden = true; }, 220);
    if (!$$(".layer.is-open").length) document.body.classList.remove("has-layer");
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

  /* ---------- Cart ---------- */
  const CART_KEY = "cibo.cart.v1";
  let cart = (store.get(CART_KEY) || []).filter((l) => ITEMS.has(l.id) && ITEMS.get(l.id).item.price != null);
  const lineKey = (id, choice) => (choice ? `${id}|${choice}` : id);
  const linePrice = (l) => ITEMS.get(l.id).item.price;
  const cartCount = () => cart.reduce((n, l) => n + l.qty, 0);
  const subtotal = () => cart.reduce((n, l) => n + l.qty * linePrice(l), 0);
  const choiceName = (l) => {
    if (!l.choice) return "";
    const { item, cat } = ITEMS.get(l.id);
    const g = optionGroup(item, cat);
    const ch = g && g.choices.find((c) => c.id === l.choice);
    return ch ? L(ch.name) : "";
  };
  function saveCart() { store.set(CART_KEY, cart); renderCart(); updateQtyBadges(); }
  function addToCart(id, choice, fromEl) {
    const key = lineKey(id, choice);
    const line = cart.find((l) => l.key === key);
    if (line) line.qty += 1; else cart.push({ key, id, choice: choice || null, qty: 1 });
    saveCart();
    const { item } = ITEMS.get(id);
    toast(t("menu.added", { name: L(item.name) }));
    bump(fromEl);
  }
  function addFromMenu(id, btn) {
    const { item, cat } = ITEMS.get(id);
    if (item.price == null) return;
    const g = optionGroup(item, cat);
    if (g) openOptions(item, cat, g, btn); else addToCart(id, null, btn);
  }
  function bump(fromEl) {
    $$(".js-cart-count").forEach((el) => { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); });
    if (fromEl && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromEl.classList.remove("is-added"); void fromEl.offsetWidth; fromEl.classList.add("is-added");
    }
  }
  function updateQtyBadges() {
    const per = {};
    cart.forEach((l) => { per[l.id] = (per[l.id] || 0) + l.qty; });
    $$("[data-qty]").forEach((el) => {
      const n = per[el.dataset.qty] || 0;
      el.hidden = !n;
      el.textContent = n ? `×${n}` : "";
      el.setAttribute("aria-label", n ? t("menu.inCart", { n }) : "");
    });
  }

  /* ---------- Options sheet ---------- */
  function openOptions(item, cat, group, btn) {
    const sheet = $("#options");
    sheet.querySelector(".sheet__media").innerHTML = media(item, cat, "sheet");
    sheet.querySelector(".sheet__title").textContent = L(item.name);
    sheet.querySelector(".sheet__desc").textContent = item.desc ? L(item.desc) : "";
    sheet.querySelector(".sheet__group-title").textContent = L(group.title);
    sheet.querySelector(".sheet__choices").innerHTML = group.choices.map((c, i) => `
      <label class="choice">
        <input type="radio" name="opt" value="${c.id}"${i === 0 && !group.required ? " checked" : ""}>
        <span class="choice__box"><span class="choice__name">${esc(L(c.name))}</span>${c.price ? `<span class="choice__price">+${money(c.price)}</span>` : ""}</span>
      </label>`).join("");
    const go = sheet.querySelector(".sheet__add");
    go.textContent = t("opt.add", { price: money(item.price) });
    const err = sheet.querySelector(".sheet__error");
    err.textContent = "";
    go.onclick = () => {
      const picked = sheet.querySelector('input[name="opt"]:checked');
      if (!picked && group.required) { err.textContent = t("opt.required"); return; }
      closeLayer(sheet);
      addToCart(item.id, picked ? picked.value : null, btn);
    };
    openLayer(sheet);
  }

  /* ---------- Cart drawer ---------- */
  const DETAILS_KEY = "cibo.customer.v1";
  const saved = store.get(DETAILS_KEY) || {};
  const state = {
    mode: saved.mode === "delivery" ? "delivery" : "pickup",
    pin: saved.pin || null, // { lat, lng }
    sending: false,
  };
  const distanceKm = (a, b) => {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const pinKm = () => (state.pin ? distanceKm(SITE.location, state.pin) : null);
  const inZone = () => state.pin && pinKm() <= C.delivery.maxKm;
  const deliveryFee = () => (state.mode === "delivery" && inZone() ? C.delivery.fee : 0);
  const normPhone = (s) => {
    let d = String(s || "").replace(/[^\d+]/g, "");
    if (d.startsWith("+212")) d = "0" + d.slice(4);
    else if (d.startsWith("00212")) d = "0" + d.slice(5);
    else if (d.startsWith("212") && d.length === 12) d = "0" + d.slice(3);
    return /^0[5-7]\d{8}$/.test(d) ? d : null;
  };

  function renderCart() {
    const n = cartCount();
    $$(".js-cart-count").forEach((el) => { el.textContent = n; el.hidden = !n; });
    const bar = $("#cart-bar");
    if (bar) {
      bar.hidden = !n;
      bar.querySelector(".cart-bar__count").textContent = n === 1 ? t("cart.item") : t("cart.items", { n });
      bar.querySelector(".cart-bar__total").textContent = money(subtotal());
    }
    const drawer = $("#cart");
    if (!drawer) return;
    drawer.classList.toggle("is-empty", !n);
    $("#cart-lines").innerHTML = cart.map((l) => {
      const { item } = ITEMS.get(l.id);
      return `<li class="line" data-key="${esc(l.key)}">
        <div class="line__text"><span class="line__name">${esc(L(item.name))}</span>${l.choice ? `<span class="line__choice">${esc(choiceName(l))}</span>` : ""}
          <span class="line__unit">${money(item.price)}</span></div>
        <div class="stepper">
          <button type="button" data-step="-1" aria-label="${esc(l.qty === 1 ? t("cart.remove") : t("cart.less"))}">${l.qty === 1
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'}</button>
          <span class="stepper__n" aria-live="polite">${l.qty}</span>
          <button type="button" data-step="1" aria-label="${esc(t("cart.more"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
        </div>
        <span class="line__total">${money(l.qty * item.price)}</span>
      </li>`;
    }).join("");

    $$('input[name="mode"]').forEach((r) => { r.checked = r.value === state.mode; });
    $("#delivery-box").hidden = state.mode !== "delivery";
    $("#pickup-hint").hidden = state.mode !== "pickup";
    const zone = $("#zone-msg");
    if (state.mode === "delivery") {
      if (!state.pin) { zone.textContent = t("cart.pinFirst"); zone.className = "zone-msg"; }
      else if (inZone()) { zone.textContent = t("cart.inZone", { km: nf(pinKm()), fee: money(C.delivery.fee) }); zone.className = "zone-msg is-ok"; }
      else { zone.textContent = t("cart.outZone", { km: nf(pinKm()), max: C.delivery.maxKm }); zone.className = "zone-msg is-bad"; }
      ensureDeliveryMap();
    }
    $("#pay-note").textContent = t(state.mode === "delivery" ? "cart.pay.delivery" : "cart.pay.pickup");
    $("#sum-sub").textContent = money(subtotal());
    $("#sum-fee-row").hidden = state.mode !== "delivery";
    $("#sum-fee").textContent = state.mode === "delivery" ? (inZone() ? money(C.delivery.fee) : "—") : money(0);
    $("#sum-total").textContent = money(subtotal() + deliveryFee());
    const go = $("#order-btn");
    const open = isOpen();
    go.disabled = state.sending || !n || !open;
    go.textContent = state.sending ? t("cart.sending") : open ? t("cart.order", { total: money(subtotal() + deliveryFee()) }) : t("cart.closed", { time: hourLabel(C.hours.open) });
  }

  function setupCart() {
    const drawer = $("#cart");
    $$("[data-open-cart]").forEach((b) => b.addEventListener("click", () => { renderCart(); openLayer(drawer); }));
    $("#cart-lines").addEventListener("click", (e) => {
      const b = e.target.closest("[data-step]");
      if (!b) return;
      const key = b.closest(".line").dataset.key;
      const line = cart.find((l) => l.key === key);
      if (!line) return;
      line.qty += Number(b.dataset.step);
      if (line.qty <= 0) cart = cart.filter((l) => l !== line);
      saveCart();
    });
    $$('input[name="mode"]').forEach((r) => r.addEventListener("change", () => {
      state.mode = r.value;
      saveDetails();
      renderCart();
    }));
    const f = $("#order-form");
    f.elements.name.value = saved.name || "";
    f.elements.phone.value = saved.phone || "";
    f.elements.address.value = saved.address || "";
    ["name", "phone", "address"].forEach((k) => f.elements[k].addEventListener("input", saveDetails));
    f.elements.phone.addEventListener("blur", () => {
      const v = f.elements.phone.value.trim();
      $("#phone-err").textContent = v && !normPhone(v) ? t("cart.phoneBad") : "";
    });
    $("#gps-btn").addEventListener("click", useGps);
    f.addEventListener("submit", (e) => { e.preventDefault(); submitOrder(); });
    $("#cart-empty-cta").addEventListener("click", () => { closeLayer(drawer); });
  }
  function saveDetails() {
    const f = $("#order-form");
    store.set(DETAILS_KEY, { name: f.elements.name.value, phone: f.elements.phone.value, address: f.elements.address.value, pin: state.pin, mode: state.mode });
  }

  /* ---------- Maps (Leaflet, loaded only when needed) ---------- */
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
  const pinIcon = (Lf, cls) => Lf.divIcon({ className: `map-pin ${cls}`, html: "<span></span>", iconSize: [30, 30], iconAnchor: [15, 30] });
  const tiles = (Lf, map) => Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  let dmap = null, dmarker = null;
  function ensureDeliveryMap() {
    if (dmap) { setTimeout(() => dmap.invalidateSize(), 60); return; }
    const el = $("#delivery-map");
    if (!el || el.dataset.loading) return;
    el.dataset.loading = "1";
    loadLeaflet().then((Lf) => {
      dmap = Lf.map(el, { zoomControl: true, attributionControl: true }).setView([SITE.location.lat, SITE.location.lng], 13);
      tiles(Lf, dmap);
      Lf.circle([SITE.location.lat, SITE.location.lng], { radius: C.delivery.maxKm * 1000, color: "#1e5c34", weight: 2, dashArray: "6 6", fillColor: "#1e5c34", fillOpacity: 0.07 }).addTo(dmap);
      Lf.marker([SITE.location.lat, SITE.location.lng], { icon: pinIcon(Lf, "map-pin--shop"), keyboard: false, title: C.name }).addTo(dmap);
      dmap.on("click", (e) => setPin(e.latlng.lat, e.latlng.lng, false));
      if (state.pin) setPin(state.pin.lat, state.pin.lng, true);
      setTimeout(() => dmap.invalidateSize(), 250);
    }).catch(() => { delete el.dataset.loading; });
  }
  function setPin(lat, lng, pan) {
    state.pin = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
    if (dmap && window.L) {
      if (!dmarker) {
        dmarker = window.L.marker([lat, lng], { draggable: true, icon: pinIcon(window.L, "map-pin--you") }).addTo(dmap);
        dmarker.on("dragend", () => { const p = dmarker.getLatLng(); setPin(p.lat, p.lng, false); });
      } else dmarker.setLatLng([lat, lng]);
      if (pan) dmap.setView([lat, lng], Math.max(dmap.getZoom(), 15));
    }
    saveDetails();
    renderCart();
  }
  function useGps() {
    const msg = $("#zone-msg");
    if (!navigator.geolocation) { msg.textContent = t("cart.gpsFail"); return; }
    $("#gps-btn").disabled = true;
    navigator.geolocation.getCurrentPosition((p) => {
      $("#gps-btn").disabled = false;
      setPin(p.coords.latitude, p.coords.longitude, true);
    }, (err) => {
      $("#gps-btn").disabled = false;
      msg.textContent = t(err && err.code === 1 ? "cart.gpsDenied" : "cart.gpsFail");
      msg.className = "zone-msg is-bad";
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }
  function setupInfoMap() {
    const el = $("#info-map");
    if (!el) return;
    const go = () => loadLeaflet().then((Lf) => {
      if (el.dataset.ready) return;
      el.dataset.ready = "1";
      el.innerHTML = "";
      const map = Lf.map(el, { scrollWheelZoom: false, dragging: !Lf.Browser.mobile, tap: false }).setView([SITE.location.lat, SITE.location.lng], 13);
      tiles(Lf, map);
      Lf.circle([SITE.location.lat, SITE.location.lng], { radius: C.delivery.maxKm * 1000, color: "#1e5c34", weight: 2, dashArray: "6 6", fillColor: "#1e5c34", fillOpacity: 0.06 }).addTo(map);
      Lf.marker([SITE.location.lat, SITE.location.lng], { icon: pinIcon(Lf, "map-pin--shop"), title: C.name }).addTo(map);
    });
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "300px" });
      io.observe(el);
    } else go();
  }

  /* ---------- Ordering ---------- */
  const LAST_KEY = "cibo.order.v1";
  function orderLines() {
    return cart.map((l) => {
      const { item } = ITEMS.get(l.id);
      return { id: l.id, name: LFR(item.name), qty: l.qty, details: l.choice ? [choiceName(l)] : [], unit: item.price, total: l.qty * item.price };
    });
  }
  function whatsappText(o, num) {
    const lines = o.items.map((l) => `• ${l.qty} × ${l.name}${l.details.length ? ` (${l.details.join(", ")})` : ""} : ${l.total} DH`);
    return [
      `Bonjour ${C.name}, je voudrais commander${num ? ` (N° ${num})` : ""} :`,
      ...lines,
      "",
      `Sous-total : ${o.subtotal} DH`,
      o.mode === "delivery" ? `Livraison : ${o.delivery_fee} DH` : null,
      `Total : ${o.total} DH`,
      "",
      `Mode : ${o.mode === "delivery" ? "Livraison" : "À emporter"}`,
      `Nom : ${o.customer_name}`,
      `Téléphone : ${o.customer_phone}`,
      o.mode === "delivery" ? `Adresse : ${o.address}` : null,
      o.mode === "delivery" ? `Position : https://maps.google.com/?q=${o.lat},${o.lng}` : null,
      o.notes ? `Remarque : ${o.notes}` : null,
    ].filter((x) => x !== null).join("\n");
  }
  const waLink = (text) => `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
  const shortNum = (id) => id.slice(0, 4).toUpperCase();

  function missing() {
    const f = $("#order-form");
    if (!cart.length) return null;
    if (cart.some((l) => linePrice(l) == null)) return "cart.missing.price";
    if (!f.elements.name.value.trim()) return "cart.missing.name";
    if (!normPhone(f.elements.phone.value)) return "cart.missing.phone";
    if (state.mode === "delivery") {
      if (!state.pin) return "cart.missing.pin";
      if (!inZone()) return "cart.missing.zone";
      if (f.elements.address.value.trim().length < 4) return "cart.missing.address";
    }
    return null;
  }
  async function submitOrder() {
    const err = $("#order-err");
    err.textContent = "";
    if (!isOpen() || state.sending) return;
    const m = missing();
    if (m) {
      err.textContent = t(m);
      const target = { "cart.missing.name": "name", "cart.missing.phone": "phone", "cart.missing.address": "address" }[m];
      if (target) $("#order-form").elements[target].focus();
      return;
    }
    const f = $("#order-form");
    const items = orderLines();
    const sub = subtotal();
    const fee = deliveryFee();
    const order = {
      location: SITE.id,
      mode: state.mode,
      customer_name: f.elements.name.value.trim().slice(0, 60),
      customer_phone: normPhone(f.elements.phone.value),
      address: state.mode === "delivery" ? f.elements.address.value.trim().slice(0, 200) : null,
      lat: state.mode === "delivery" ? state.pin.lat : null,
      lng: state.mode === "delivery" ? state.pin.lng : null,
      distance_km: state.mode === "delivery" ? Math.round(pinKm() * 100) / 100 : null,
      notes: f.elements.notes.value.trim().slice(0, 300) || null,
      items,
      subtotal: sub,
      delivery_fee: fee,
      total: sub + fee,
      lang: LANG,
    };
    state.sending = true;
    renderCart();
    try {
      const { id, token } = await window.ORDERS.create(order);
      const rec = { id, token, at: Date.now(), mode: order.mode, total: order.total, wa: whatsappText(order, shortNum(id)) };
      store.set(LAST_KEY, rec);
      cart = [];
      f.elements.notes.value = "";
      saveCart();
      closeLayer($("#cart"));
      startTracking(rec);
    } catch (e) {
      if (e && e.code === "spam") {
        err.textContent = t("track.spam");
      } else if (e && e.code === "zone") {
        err.textContent = t("cart.missing.zone");
      } else {
        // Could not reach the restaurant's screen: WhatsApp is the way out (the cart stays as it is).
        const rec = { id: null, failed: true, at: Date.now(), mode: order.mode, total: order.total, wa: whatsappText(order) };
        closeLayer($("#cart"));
        showTracker(rec, null);
      }
    } finally {
      state.sending = false;
      renderCart();
    }
  }

  /* ---------- Live tracking ---------- */
  let stopWatch = null, trackTimer = null;
  function startTracking(rec) {
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
  const reviewUrl = () => `https://search.google.com/local/writereview?placeid=${SITE.placeId}`;

  /* ---------- Reviews and info ---------- */
  function renderReviews() {
    $("#reviews-list").innerHTML = window.REVIEWS.map((r) => `
      <figure class="review">
        <div class="review__stars" aria-label="${r.stars}/5">${"★".repeat(r.stars)}</div>
        <blockquote class="review__text" lang="${r.lang}">${esc(r.text)}</blockquote>
        <figcaption class="review__who"><span class="review__avatar" aria-hidden="true">${esc(r.author[0])}</span>${esc(r.author)}<span class="review__src">${esc(t("reviews.ago"))}</span></figcaption>
      </figure>`).join("");
    $$("[data-review-link]").forEach((a) => { a.href = reviewUrl(); });
  }
  function renderInfo() {
    $("#info-hours").textContent = `${t("info.everyday")} · ${hourLabel(C.hours.open)} – ${hourLabel(C.hours.close)}`;
    $("#info-address").textContent = [SITE.streetAddress, L(SITE.address)].filter(Boolean).join(", ");
    $$("[data-phone]").forEach((a) => { a.href = `tel:${SITE.phoneIntl}`; if (a.dataset.phone === "text") a.textContent = SITE.phone.replace(/(\d{2})(?=\d)/g, "$1 ").trim(); });
    $$("[data-wa]").forEach((a) => { a.href = `https://wa.me/${SITE.whatsapp}`; });
    $$("[data-maps]").forEach((a) => { a.href = SITE.googleMapsUrl; });
    $$("[data-insta]").forEach((a) => { a.href = SITE.instagram; if (a.dataset.insta === "text") a.textContent = SITE.instagramHandle; });
    $("#info-delivery").textContent = t("info.deliveryText", { km: C.delivery.maxKm, fee: money(C.delivery.fee) });
    $("#info-payment").textContent = t("info.paymentText");
    $("#year").textContent = new Date().getFullYear();
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 1800);
  }

  /* ---------- Installable app ---------- */
  let installEvt = null;
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const LATER_KEY = "cibo.install.later";
  function canInstall() { return !standalone() && (installEvt || isIOS()); }
  function refreshInstall() { $$("[data-install]").forEach((b) => { b.hidden = !canInstall(); }); }
  async function doInstall() {
    $("#install-banner").classList.remove("is-on");
    if (installEvt) {
      installEvt.prompt();
      try { await installEvt.userChoice; } catch (e) { /* closed */ }
      installEvt = null;
      refreshInstall();
    } else if (isIOS()) {
      openLayer($("#ios-steps"));
    }
  }
  let nudged = false;
  function installNudge() {
    if (nudged || !canInstall()) return;
    const later = store.get(LATER_KEY);
    if (later && Date.now() - later < 14 * 864e5) return;
    nudged = true;
    setTimeout(() => $("#install-banner").classList.add("is-on"), 1200);
  }
  function setupInstall() {
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; refreshInstall(); });
    window.addEventListener("appinstalled", () => { installEvt = null; refreshInstall(); $("#install-banner").classList.remove("is-on"); });
    $$("[data-install]").forEach((b) => b.addEventListener("click", doInstall));
    $("#install-go").addEventListener("click", doInstall);
    $("#install-later").addEventListener("click", () => { store.set(LATER_KEY, Date.now()); $("#install-banner").classList.remove("is-on"); });
    refreshInstall();
    setTimeout(installNudge, 10000);
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => { /* no offline copy */ }));
    }
    window.addEventListener("offline", () => toast(t("toast.offline")));
  }

  /* ---------- Header ---------- */
  function setupHeader() {
    const top = $(".topbar");
    const onScroll = () => top.classList.toggle("is-scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    $$("[data-go-order]").forEach((b) => b.addEventListener("click", (e) => {
      if (cart.length) { e.preventDefault(); renderCart(); openLayer($("#cart")); }
    }));
  }

  /* ---------- Start ---------- */
  applyText();
  renderHero();
  renderMenu();
  renderReviews();
  renderInfo();
  setupCart();
  renderCart();
  setupHeader();
  setupInstall();
  setupInfoMap();
  resumeTracking();
  // keep the cart and the tracker in step between tabs
  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) { cart = store.get(CART_KEY) || []; renderCart(); updateQtyBadges(); }
  });
  window.CIBO = { t, isOpen, distanceKm, normPhone, whatsappText };
})();
