/*
 * Cibo Napoli: the order page (/commander/). Menu (tiles, category bar, dishes laid out as a road map by js/roadmap.js), options asked
 * before adding (pasta shape), big photo (click on PC, long press on phones), cart with pickup or delivery (map,
 * GPS or tap, the drawn zone, flat fee), then the order (js/orders.js) and the live tracker (js/common.js).
 */
(function () {
  const CN = window.CN;
  const { C, SITE, $, $$, esc, store, t, L, LFR, money, nf } = CN;

  const ITEMS = new Map();
  window.MENU.forEach((cat) => cat.items.forEach((it) => ITEMS.set(it.id, { item: it, cat })));
  const optionGroup = (item, cat) => {
    const key = item.options !== undefined ? item.options : cat.options;
    return key ? window.OPTION_GROUPS[key] : null;
  };
  const catFrom = (cat) => Math.min(...cat.items.map((i) => i.price).filter((p) => p != null));

  /* ---------- Menu ---------- */
  function media(item, cat, cls) {
    if (item && item.image) return `<img class="${cls}__img" src="${esc(item.image)}" alt="${esc(L(item.name))}" loading="lazy" width="600" height="600">`;
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
          <h2 class="cat__title" id="cat-${cat.id}-title">${esc(L(cat.name))}</h2>
          ${cat.sub ? `<p class="cat__sub">${esc(L(cat.sub))}</p>` : ""}
        </header>
        <div class="dishes road">
          ${cat.items.map((it) => `
            <article class="dish" id="dish-${it.id}" data-id="${it.id}">
              <div class="dish__media${it.image ? " has-photo" : ""}" ${it.image ? `role="button" tabindex="0" aria-label="${esc(t("menu.photo", { name: L(it.name) }))}"` : ""}>${media(it, cat, "dish")}<span class="dish__qty" data-qty="${it.id}" hidden></span></div>
              <div class="dish__body">
                <h3 class="dish__name">${esc(L(it.name))}</h3>
                ${it.desc ? `<p class="dish__desc">${esc(L(it.desc))}</p>` : ""}
                <div class="dish__foot">
                  <span class="dish__price${it.price == null ? " is-soon" : ""}">${it.price == null ? esc(t("menu.priceSoon")) : money(it.price)}</span>
                  <button class="dish__add" type="button" data-add="${it.id}" aria-label="${esc(t("menu.add", { name: L(it.name) }))}"${it.price == null ? " disabled" : ""}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
                  </button>
                </div>
              </div>
            </article>`).join("")}
        </div>
      </section>`).join("");

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const id = e.target.id.replace("cat-", "");
          $$(".chip").forEach((c) => c.classList.toggle("is-active", c.dataset.chip === id));
          const chip = $(`.chip[data-chip="${id}"]`);
          const bar = $("#cat-chips");
          if (chip && bar && bar.scrollTo) bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      $$(".cat").forEach((s) => io.observe(s));
    }
    $("#menu").addEventListener("click", (e) => {
      if (e.target.closest("[data-cat]")) CN.installNudge();
      const add = e.target.closest("[data-add]");
      if (add) addFromMenu(add.dataset.add, add);
    });
    setupPhotos();
    updateQtyBadges();
    if (window.ROADMAP) window.ROADMAP.watch($("#menu-sections"));
  }

  /* ---------- Big photo ---------- */
  function setupPhotos() {
    const open = (el) => {
      const { item } = ITEMS.get(el.closest(".dish").dataset.id);
      if (!item.image) return;
      const box = $("#lightbox");
      box.querySelector("img").src = item.image;
      box.querySelector("img").alt = L(item.name);
      box.querySelector(".lightbox__cap").textContent = L(item.name);
      CN.openLayer(box);
    };
    let timer = null, longPressed = false;
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
    CN.toast(t("menu.added", { name: L(ITEMS.get(id).item.name) }));
    bump(fromEl);
    const hit = ITEMS.get(id);
    CN.burst(fromEl, CN.emojiFor(hit.item, hit.cat));
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
      CN.closeLayer(sheet);
      addToCart(item.id, picked ? picked.value : null, btn);
    };
    CN.openLayer(sheet);
  }

  /* ---------- Cart drawer ---------- */
  const DETAILS_KEY = "cibo.customer.v1";
  const saved = store.get(DETAILS_KEY) || {};
  const state = { mode: saved.mode === "delivery" ? "delivery" : "pickup", pin: saved.pin || null, sending: false };
  const pinKm = () => (state.pin ? CN.distanceKm(SITE.location, state.pin) : null);
  const inZone = () => CN.inZone(state.pin);
  const deliveryFee = () => (state.mode === "delivery" && inZone() ? C.delivery.fee : 0);
  const normPhone = (s) => {
    let d = String(s || "").replace(/[^\d+]/g, "");
    if (d.startsWith("+212")) d = "0" + d.slice(4);
    else if (d.startsWith("00212")) d = "0" + d.slice(5);
    else if (d.startsWith("212") && d.length === 12) d = "0" + d.slice(3);
    return /^0[5-7]\d{8}$/.test(d) ? d : null;
  };

  const shownLines = new Map(); // the amounts last shown per cart line, so they roll from there
  function renderCart() {
    const n = cartCount();
    $$(".js-cart-count").forEach((el) => { CN.roll(el, n); el.hidden = !n; });
    const bar = $("#cart-bar");
    bar.hidden = !n;
    document.body.classList.toggle("has-cart-bar", !!n);
    bar.querySelector(".cart-bar__count").textContent = n === 1 ? t("cart.item") : t("cart.items", { n });
    CN.roll(bar.querySelector(".cart-bar__total"), money(subtotal()));
    const drawer = $("#cart");
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
    $$("#cart-lines .line").forEach((li) => {
      const l = cart.find((x) => x.key === li.dataset.key);
      const was = shownLines.get(l.key);
      const total = money(l.qty * ITEMS.get(l.id).item.price);
      CN.roll(li.querySelector(".line__total"), total, was ? was.total : total);
      CN.roll(li.querySelector(".stepper__n"), l.qty, was ? was.qty : l.qty);
      shownLines.set(l.key, { total, qty: l.qty });
    });
    $$('input[name="mode"]').forEach((r) => { r.checked = r.value === state.mode; });
    $("#delivery-box").hidden = state.mode !== "delivery";
    $("#pickup-hint").hidden = state.mode !== "pickup";
    const zone = $("#zone-msg");
    if (state.mode === "delivery") {
      if (!state.pin) { zone.textContent = t("cart.pinFirst"); zone.className = "zone-msg"; }
      else if (inZone()) { zone.textContent = t("cart.inZone", { km: nf(pinKm()), fee: money(C.delivery.fee) }); zone.className = "zone-msg is-ok"; }
      else { zone.textContent = t("cart.outZone"); zone.className = "zone-msg is-bad"; }
      if (!drawer.hidden) ensureDeliveryMap();
    }
    $("#pay-note").textContent = t(state.mode === "delivery" ? "cart.pay.delivery" : "cart.pay.pickup");
    CN.roll($("#sum-sub"), money(subtotal()));
    $("#sum-fee-row").hidden = state.mode !== "delivery";
    $("#sum-fee").textContent = state.mode === "delivery" ? (inZone() ? money(C.delivery.fee) : "—") : money(0);
    CN.roll($("#sum-total"), money(subtotal() + deliveryFee()));
    const go = $("#order-btn");
    const open = CN.isOpen();
    go.disabled = state.sending || !n || !open;
    go.textContent = state.sending ? t("cart.sending") : open ? t("cart.order", { total: money(subtotal() + deliveryFee()) }) : t("cart.closed", { time: CN.hourLabel(C.hours.open) });
  }
  function openCart() { CN.openLayer($("#cart")); renderCart(); }

  function setupCart() {
    $$("[data-open-cart]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); openCart(); }));
    $("#cart-lines").addEventListener("click", (e) => {
      const b = e.target.closest("[data-step]");
      if (!b) return;
      const line = cart.find((l) => l.key === b.closest(".line").dataset.key);
      if (!line) return;
      line.qty += Number(b.dataset.step);
      if (line.qty <= 0) cart = cart.filter((l) => l !== line);
      saveCart();
    });
    $$('input[name="mode"]').forEach((r) => r.addEventListener("change", () => { state.mode = r.value; saveDetails(); renderCart(); }));
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
    $("#cart-empty-cta").addEventListener("click", () => CN.closeLayer($("#cart")));
    $("#cart-empty-art").innerHTML = window.ART.svg("pizza");
    document.addEventListener("cibo-status", renderCart);
    // other pages send the customer here with ?panier=1 to open the cart
    if (new URLSearchParams(location.search).get("panier") === "1" && cart.length) setTimeout(openCart, 60);
    window.addEventListener("storage", (e) => {
      if (e.key === CART_KEY) { cart = store.get(CART_KEY) || []; renderCart(); updateQtyBadges(); }
    });
  }
  function saveDetails() {
    const f = $("#order-form");
    store.set(DETAILS_KEY, { name: f.elements.name.value, phone: f.elements.phone.value, address: f.elements.address.value, pin: state.pin, mode: state.mode });
  }

  /* ---------- Delivery map ---------- */
  let dmap = null, dmarker = null;
  function ensureDeliveryMap() {
    if (dmap) { setTimeout(() => dmap.invalidateSize(), 60); return; }
    const el = $("#delivery-map");
    if (el.dataset.loading) return;
    el.dataset.loading = "1";
    CN.loadLeaflet().then((Lf) => {
      dmap = CN.baseMap(Lf, el, { zoomControl: true });
      dmap.on("click", (e) => setPin(e.latlng.lat, e.latlng.lng, false));
      if (state.pin) setPin(state.pin.lat, state.pin.lng, true);
      setTimeout(() => dmap.invalidateSize(), 250);
    }).catch(() => { delete el.dataset.loading; });
  }
  function setPin(lat, lng, pan) {
    state.pin = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
    if (dmap && window.L) {
      if (!dmarker) {
        dmarker = window.L.marker([lat, lng], { draggable: true, icon: CN.pinIcon(window.L, "map-pin--you") }).addTo(dmap);
        dmarker.on("dragend", () => { const p = dmarker.getLatLng(); setPin(p.lat, p.lng, false); });
      } else dmarker.setLatLng([lat, lng]);
      if (pan) dmap.setView([lat, lng], Math.max(dmap.getZoom(), 14));
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

  /* ---------- Ordering ---------- */
  const LAST_KEY = "cibo.order.v1";
  function orderLines() {
    return cart.map((l) => {
      const { item } = ITEMS.get(l.id);
      return { id: l.id, name: LFR(item.name), qty: l.qty, details: l.choice ? [choiceName(l)] : [], unit: item.price, total: l.qty * item.price };
    });
  }
  function whatsappText(o, num) {
    return [
      `Bonjour ${C.name}, je voudrais commander${num ? ` (N° ${num})` : ""} :`,
      ...o.items.map((l) => `• ${l.qty} × ${l.name}${l.details.length ? ` (${l.details.join(", ")})` : ""} : ${l.total} DH`),
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
    if (!CN.isOpen() || state.sending) return;
    const m = missing();
    if (m) {
      err.textContent = t(m);
      const target = { "cart.missing.name": "name", "cart.missing.phone": "phone", "cart.missing.address": "address" }[m];
      if (target) $("#order-form").elements[target].focus();
      return;
    }
    const f = $("#order-form");
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
      items: orderLines(),
      subtotal: sub,
      delivery_fee: fee,
      total: sub + fee,
      lang: CN.LANG,
    };
    state.sending = true;
    renderCart();
    try {
      const { id, token } = await window.ORDERS.create(order);
      const rec = { id, token, at: Date.now(), mode: order.mode, total: order.total, wa: whatsappText(order, CN.shortNum(id)) };
      store.set(LAST_KEY, rec);
      cart = [];
      f.elements.notes.value = "";
      saveCart();
      CN.closeLayer($("#cart"));
      CN.startTracking(rec);
    } catch (e) {
      if (e && e.code === "spam") err.textContent = t("track.spam");
      else if (e && e.code === "zone") err.textContent = t("cart.missing.zone");
      else {
        // Could not reach the restaurant's screen: WhatsApp is the way out (the cart stays as it is).
        CN.closeLayer($("#cart"));
        CN.showTracker({ id: null, failed: true, at: Date.now(), mode: order.mode, total: order.total, wa: whatsappText(order) }, null);
      }
    } finally {
      state.sending = false;
      renderCart();
    }
  }

  renderMenu();
  setupCart();
  renderCart();
  window.CIBO = { normPhone, whatsappText };
})();
