/*
 * Cibo Napoli: the home page's own parts (the hero and the reviews are drawn by js/common.js).
 *  - « La collection signature »: the 4 dishes of C.signature, read from js/menu-data.js. The cart button puts the
 *    dish straight in the cart (same storage as /commander/); a dish with a choice to make (pasta shape) opens it
 *    on the order page instead.
 *  - « Notre histoire »: real numbers counted from the menu, and the 3 photos of C.homePhotos (placeholders until
 *    the photos arrive).
 *  - « Des moments inoubliables »: the reviews slide sideways on phones, with arrows and dots.
 */
(function () {
  const { C, $, $$, esc, store, t, L, money, toast, roll, burst, emojiFor, reduceMotion } = window.CN;
  const MENU = window.MENU || [];
  const find = (id) => {
    for (const cat of MENU) { const item = cat.items.find((i) => i.id === id); if (item) return { item, cat }; }
    return null;
  };
  const CART_KEY = "cibo.cart.v1";
  const cartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8zM9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 11.5v5M9.5 14h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const camera = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="13.3" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

  /* ---------- Signature collection ---------- */
  function renderSignature() {
    const list = $("#sig-list");
    if (!list) return;
    const picks = (C.signature || []).map(find).filter(Boolean).slice(0, 4);
    list.innerHTML = picks.map(({ item, cat }) => {
      const name = L(item.name);
      const pic = item.image
        ? `<img src="${esc(item.image)}" alt="${esc(name)}" loading="lazy" width="600" height="600">`
        : `<span class="sig__art">${window.ART.svg(cat.art)}</span><span class="sig__soon">${camera}${esc(t("sig.photoSoon"))}</span>`;
      return `
        <article class="sig__card" data-sig="${esc(item.id)}">
          <div class="sig__media${item.image ? "" : " is-soon"}">${pic}</div>
          <h3 class="sig__name">${esc(name)}</h3>
          ${item.desc ? `<p class="sig__desc">${esc(L(item.desc))}</p>` : ""}
          <div class="sig__foot">
            <span class="sig__price">${money(item.price)}</span>
            <button class="sig__add" type="button" data-sig-add="${esc(item.id)}" aria-label="${esc(t("menu.add", { name }))}">${cartIcon}</button>
          </div>
        </article>`;
    }).join("");
    list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sig-add]");
      if (!b) return;
      const hit = find(b.dataset.sigAdd);
      if (!hit || hit.item.price == null) return;
      if (hit.item.options || hit.cat.options) { location.href = window.CN.withLang(`/commander/#dish-${hit.item.id}`); return; }
      const cart = store.get(CART_KEY) || [];
      const line = cart.find((l) => l.key === hit.item.id);
      if (line) line.qty += 1; else cart.push({ key: hit.item.id, id: hit.item.id, choice: null, qty: 1 });
      store.set(CART_KEY, cart);
      const n = cart.reduce((s, l) => s + (l.qty || 0), 0);
      $$(".js-cart-count").forEach((el) => { roll(el, n); el.hidden = !n; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); });
      b.classList.remove("is-added"); void b.offsetWidth; b.classList.add("is-added");
      burst(b, emojiFor(hit.item, hit.cat));
      toast(t("menu.added", { name: L(hit.item.name) }));
    });
    // phones: the cards sit side by side and drift slowly to the left, without end (a second copy follows the
    // first; it is hidden from screen readers and on computers). A finger swipes them as fast as it likes (native
    // scrolling); the drift stops while the finger is there and starts again a moment after.
    if (picks.length > 1) {
      $$(".sig__card", list).forEach((c) => {
        const k = c.cloneNode(true);
        k.classList.add("sig__card--clone");
        k.setAttribute("aria-hidden", "true");
        k.querySelectorAll("button").forEach((b) => b.setAttribute("tabindex", "-1"));
        list.appendChild(k);
      });
      const view = list.parentElement;
      const phone = () => window.matchMedia("(max-width: 899px)").matches;
      const SPEED = 22; // px per second
      let pos = 0, last = 0, holdUntil = 0, touching = false;
      const loopWidth = () => list.scrollWidth / 2;
      // keep the position inside the first copy, so it never reaches an end
      const wrap = () => {
        const w = loopWidth();
        if (w <= 0) return;
        if (view.scrollLeft >= w) view.scrollLeft -= w;
        else if (view.scrollLeft <= 0) view.scrollLeft += w;
        pos = view.scrollLeft;
      };
      const hold = (ms) => { holdUntil = performance.now() + ms; };
      // the finger (or its momentum) moved it if it is not where the drift left it
      const moved = () => Math.abs(view.scrollLeft - Math.round(pos)) > 2;
      const tick = (now) => {
        requestAnimationFrame(tick);
        const dt = last ? Math.min(64, now - last) : 0;
        last = now;
        if (moved()) { hold(2500); wrap(); return; }
        if (!phone() || reduceMotion() || touching || now < holdUntil || document.hidden) return;
        pos += (SPEED * dt) / 1000;
        if (Math.round(pos) !== view.scrollLeft) view.scrollLeft = Math.round(pos);
        if (view.scrollLeft >= loopWidth()) wrap();
      };
      view.addEventListener("touchstart", () => { touching = true; }, { passive: true });
      view.addEventListener("touchend", () => { touching = false; hold(2500); }, { passive: true });
      view.addEventListener("pointerdown", () => hold(2500));
      view.addEventListener("scroll", () => { if (moved()) { hold(2500); wrap(); } }, { passive: true });
      list.addEventListener("focusin", () => hold(60000));
      list.addEventListener("focusout", () => hold(1500));
      // start a little way in, so a swipe to the right works at once
      setTimeout(() => { if (phone()) { view.scrollLeft = 1; pos = view.scrollLeft; } }, 50);
      requestAnimationFrame(tick);
    }
  }

  /* ---------- Our story ---------- */
  function renderStory() {
    const stats = $("#story-stats");
    if (stats) {
      const pizze = MENU.find((c) => c.art === "pizza");
      const recipes = MENU.filter((c) => c.art !== "drink").reduce((n, c) => n + c.items.length, 0);
      stats.innerHTML = [
        [pizze ? pizze.items.length : 0, t("story.stat.pizzas")],
        [recipes, t("story.stat.dishes")],
        ["7/7", t("story.stat.days")],
      ].filter((s) => s[0]).map(([n, label]) => `<li><strong data-count="${esc(n)}">${esc(n)}</strong><span>${esc(label)}</span></li>`).join("");
      // the numbers roll up from zero when they come into view
      const nums = $$("[data-count]", stats);
      const zero = (v) => String(v).replace(/\d/g, "0");
      if ("IntersectionObserver" in window && !reduceMotion()) {
        nums.forEach((el) => roll(el, zero(el.dataset.count)));
        const io = new IntersectionObserver((entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          nums.forEach((el) => roll(el, el.dataset.count));
          io.disconnect();
        }, { threshold: 0.6 });
        io.observe(stats);
      } else nums.forEach((el) => roll(el, el.dataset.count));
    }
    const P = C.homePhotos || {};
    $$("[data-photo]").forEach((fig) => {
      const key = fig.dataset.photo;
      const label = t(`ph.${key}`);
      if (P[key]) {
        fig.innerHTML = `<img src="${esc(P[key])}" alt="" loading="lazy">`;
        fig.classList.remove("is-soon");
      } else {
        fig.innerHTML = `<span class="ph__in">${camera}<span>${esc(label)}</span></span>`;
        fig.classList.add("is-soon");
      }
    });
  }

  /* ---------- Reviews: faces, arrows, dots ---------- */
  function setupReviews() {
    const list = $("#reviews-list");
    if (!list) return;
    const faces = $("#xp-faces");
    if (faces) faces.innerHTML = (window.REVIEWS || []).slice(0, 4).map((r) => `<span>${esc(r.author[0])}</span>`).join("");
    const cards = $$(".review", list);
    const dots = $("#xp-dots");
    if (dots) {
      dots.innerHTML = cards.map((c, i) => `<button type="button" data-dot="${i}" aria-label="${esc(t("reviews.goto", { n: i + 1 }))}"></button>`).join("");
      dots.addEventListener("click", (e) => { const d = e.target.closest("[data-dot]"); if (d) go(+d.dataset.dot); });
    }
    const current = () => {
      const mid = list.scrollLeft + list.clientWidth / 2;
      let best = 0, dist = Infinity;
      cards.forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < dist) { dist = d; best = i; } });
      return best;
    };
    const go = (i) => {
      const c = cards[Math.max(0, Math.min(cards.length - 1, i))];
      if (c) list.scrollTo({ left: c.offsetLeft - (list.clientWidth - c.offsetWidth) / 2, behavior: "smooth" });
    };
    const sync = () => {
      const scrollable = list.scrollWidth > list.clientWidth + 4;
      document.querySelector(".xp__track").classList.toggle("is-scrollable", scrollable);
      const i = current();
      $$("[data-dot]").forEach((d, k) => d.setAttribute("aria-current", String(k === i)));
    };
    $$("[data-xp]").forEach((b) => b.addEventListener("click", () => go(current() + +b.dataset.xp)));
    let raf = 0;
    list.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener("resize", sync);
    sync();
    // phones: start on the first review
    list.scrollLeft = 0;
  }

  renderSignature();
  renderStory();
  setupReviews();
})();
