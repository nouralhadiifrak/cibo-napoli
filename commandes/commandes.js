/*
 * Cibo Napoli: the staff order screen (/commandes/), installable as its own app.
 *
 * Staff accounts see their own restaurant's orders; the owner's account sees every restaurant (the database
 * enforces it, see supabase/schema.sql). New orders arrive live (Realtime, plus a check every 20 s in case the
 * connection drops), ring and fill the screen until accepted (with a time) or refused (with a reason the customer
 * sees). Then: Ready (pickup) or On the way (delivery, with « Envoyer au livreur » on WhatsApp), then Done.
 * Orders older than 24 hours are hidden (their personal details are erased by then).
 * The owner follows the orders and the statistics, without the pop-up, the sound or the buttons.
 *
 * DEMO MODE (no Supabase in js/config.js): the orders of this browser (js/orders.js), and two buttons instead of
 * the sign-in form, to enter as the staff or as the owner.
 */
(function () {
  const C = window.CONFIG;
  const O = C.orders;
  const DEMO = window.ORDERS.demo;
  const Store = window.ORDERS.DemoStore;
  const POLL_MS = 20000;
  const RING_EVERY_MS = 2600;
  const DAY_START_HOUR = 6; // a service day runs from 06:00 to 06:00, Casablanca time
  const ETAS = [10, 15, 20, 30, 45, 60];
  const REASONS = ["Trop de commandes en ce moment", "Un article n'est plus disponible", "Adresse trop loin", "Nous sommes fermés"];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (o) => o.id.slice(0, 4).toUpperCase();
  const time = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: C.timeZone });
  const money = (n) => `${Math.round(n || 0).toLocaleString("fr-FR").replace(/\s/g, " ")} DH`;
  const minutesSince = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 60e3);
  const siteById = (id) => C.locations.find((l) => l.id === id);
  const phoneFmt = (p) => (p ? p.replace(/(\d{2})(?=\d)/g, "$1 ").trim() : "");
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } },
  };

  let db = null;          // Supabase client (real mode)
  let site = null;        // the account's restaurant (null for the owner)
  let owner = false;
  let orders = new Map(); // id → order, last 24 hours
  let alertId = null;
  let channel = null, pollTimer = null, ringTimer = null, audioCtx = null, wakeLock = null, installEvt = null;
  let period = "today";

  const show = (v) => ["login", "start", "app"].forEach((x) => { $("#" + x).hidden = x !== v; });
  const placeName = () => (owner ? (C.locations.length > 1 ? `${C.name} · tous les restaurants` : `${C.name} · propriétaire`) : site.name.fr);
  const mine = (o) => owner || o.location === site.id;

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("is-on"), 2600);
  }

  /* ---------- Sign-in ---------- */
  function loadSupabase() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve();
      const s = document.createElement("script");
      s.src = "/vendor/supabase/supabase-2.117.2.js";
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function boot() {
    document.body.classList.toggle("is-demo", DEMO);
    $("#demo-pill").hidden = !DEMO;
    if (DEMO) {
      $("#login-form").hidden = true;
      $("#demo-login").hidden = false;
      const role = store.get("cibo.demo.role");
      if (role) return enter(role === "owner", C.locations[0]);
      show("login");
      $$("[data-demo-role]").forEach((b) => b.addEventListener("click", () => {
        store.set("cibo.demo.role", b.dataset.demoRole);
        enter(b.dataset.demoRole === "owner", C.locations[0]);
      }));
      return;
    }
    try { await loadSupabase(); } catch (e) { show("login"); $("#login-error").textContent = "Chargement impossible. Vérifiez la connexion."; return; }
    db = window.supabase.createClient(O.supabaseUrl, O.publishableKey);
    $("#login-form").addEventListener("submit", signIn);
    const { data } = await db.auth.getSession();
    if (data && data.session) afterSignIn(); else show("login");
  }

  async function signIn(e) {
    e.preventDefault();
    const f = e.target;
    $("#login-error").textContent = "";
    $("#login-btn").disabled = true;
    const { error } = await db.auth.signInWithPassword({ email: f.elements.email.value.trim(), password: f.elements.password.value });
    $("#login-btn").disabled = false;
    if (error) { $("#login-error").textContent = "E-mail ou mot de passe incorrect."; return; }
    afterSignIn();
  }

  async function afterSignIn() {
    const { data, error } = await db.from("staff").select("location, role").maybeSingle();
    const isOwner = !!data && data.role === "owner";
    const s = data && siteById(data.location);
    if (error || !(isOwner || s)) {
      await db.auth.signOut();
      show("login");
      $("#login-error").textContent = error ? "Connexion impossible, réessayez." : "Ce compte n'est lié à aucun restaurant.";
      return;
    }
    enter(isOwner, s);
  }

  function enter(isOwner, s) {
    owner = isOwner;
    site = owner ? null : s;
    document.body.classList.toggle("is-owner", owner);
    $("#place").textContent = placeName();
    $("#start-place").textContent = placeName();
    if (owner) { startApp(); switchTab("stats"); } else show("start");
  }

  async function signOut() {
    stopLive();
    if (DEMO) store.del("cibo.demo.role"); else await db.auth.signOut();
    location.reload();
  }

  /* ---------- Start of service: sound and screen ---------- */
  function unlockAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) { audioCtx = null; }
  }
  // A two-tone bell, made in the page (no sound file to load).
  function ring() {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    [[880, 0], [1175, 0.18], [880, 0.5], [1175, 0.68]].forEach(([f, at]) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.6, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.32);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0 + at); o.stop(t0 + at + 0.34);
    });
    if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
  }
  async function keepAwake() {
    try {
      if ("wakeLock" in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => { wakeLock = null; });
      }
    } catch (e) { /* not allowed: the screen may sleep */ }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !owner) keepAwake(); });

  function startApp() {
    show("app");
    if (!owner) { unlockAudio(); keepAwake(); }
    startLive();
    renderStats();
  }

  /* ---------- Orders: load and live updates ---------- */
  async function loadOrders() {
    const since = new Date(Date.now() - 24 * 3600e3).toISOString();
    if (DEMO) {
      orders = new Map(Store.all().filter((o) => mine(o) && o.created_at >= since).map((o) => [o.id, o]));
    } else {
      let q = db.from("orders").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(300);
      if (!owner) q = q.eq("location", site.id);
      const { data, error } = await q;
      $("#offline").hidden = !error;
      if (error) return;
      orders = new Map(data.map((o) => [o.id, o]));
    }
    render();
  }
  function startLive() {
    loadOrders();
    if (DEMO) {
      Store.subscribe(() => { loadOrders(); if (!$("#tab-stats").hidden) renderStats(); });
    } else {
      channel = db.channel("orders-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
          const o = p.new && p.new.id ? p.new : null;
          if (p.eventType === "DELETE" && p.old) orders.delete(p.old.id);
          else if (o && mine(o)) orders.set(o.id, o);
          render();
        })
        .subscribe((status) => { $("#offline").hidden = status === "SUBSCRIBED"; });
    }
    pollTimer = setInterval(loadOrders, POLL_MS);
  }
  function stopLive() {
    clearInterval(pollTimer);
    clearInterval(ringTimer);
    if (channel && db) db.removeChannel(channel);
  }

  async function update(id, patch) {
    if (owner) return;
    if (DEMO) {
      Store.update(id, patch);
      return loadOrders();
    }
    const { data, error } = await db.from("orders").update(patch).eq("id", id).select().maybeSingle();
    if (error) { toast("Échec de l'envoi. Réessayez."); return; }
    if (data) { orders.set(data.id, data); render(); }
  }

  /* ---------- Board ---------- */
  const STATUS = { new: "Nouvelle", accepted: "Acceptée", ready: "Prête", on_the_way: "En route", done: "Terminée", refused: "Refusée", cancelled: "Annulée" };
  function itemsHtml(o) {
    return `<ul class="items">${(o.items || []).map((l) => `<li><b>${l.qty} ×</b> ${esc(l.name)}${l.details && l.details.length ? ` <span class="opt">${esc(l.details.join(", "))}</span>` : ""}<span class="items__p">${money(l.total)}</span></li>`).join("")}</ul>`;
  }
  function mapLink(o) { return `https://maps.google.com/?q=${o.lat},${o.lng}`; }
  function cardHtml(o, big) {
    const s = o.status;
    const eta = o.accepted_at && o.eta_minutes ? new Date(Date.parse(o.accepted_at) + o.eta_minutes * 60e3) : null;
    const who = o.anonymized_at ? `<p class="muted">Coordonnées effacées (24 h)</p>` : `
      <p class="who"><b>${esc(o.customer_name)}</b> · <a href="tel:${esc(o.customer_phone)}">${esc(phoneFmt(o.customer_phone))}</a></p>
      ${o.mode === "delivery" ? `<p class="addr">📍 ${esc(o.address)}${o.distance_km != null ? ` <span class="muted">(${String(o.distance_km).replace(".", ",")} km)</span>` : ""} · <a href="${mapLink(o)}" target="_blank" rel="noopener">Carte</a></p>` : ""}`;
    const actions = owner || big ? "" : {
      accepted: `${o.mode === "delivery"
        ? `<button class="btn btn--green" data-do="on_the_way" data-id="${o.id}">En route</button><button class="btn btn--line" data-do="driver" data-id="${o.id}">Envoyer au livreur</button>`
        : `<button class="btn btn--green" data-do="ready" data-id="${o.id}">Prête</button>`}
        <button class="btn btn--ghost" data-do="cancel" data-id="${o.id}">Annuler</button>`,
      ready: `<button class="btn btn--green" data-do="done" data-id="${o.id}">Terminée</button>`,
      on_the_way: `<button class="btn btn--green" data-do="done" data-id="${o.id}">Livrée</button><button class="btn btn--line" data-do="driver" data-id="${o.id}">Renvoyer au livreur</button>`,
      new: `<button class="btn btn--red" data-do="open" data-id="${o.id}">Répondre</button>`,
    }[s] || "";
    return `<article class="order order--${s}" data-id="${o.id}">
      <header class="order__head">
        <span class="order__num">N° ${num(o)}</span>
        <span class="tag tag--${o.mode}">${o.mode === "delivery" ? "Livraison" : "À emporter"}</span>
        <span class="tag tag--s-${s}">${STATUS[s]}</span>
        <span class="order__time">${time(o.created_at)} · ${minutesSince(o.created_at)} min</span>
      </header>
      ${owner && C.locations.length > 1 ? `<p class="muted">${esc(siteById(o.location).name.fr)}</p>` : ""}
      ${who}
      ${itemsHtml(o)}
      ${o.notes ? `<p class="notes">📝 ${esc(o.notes)}</p>` : ""}
      <p class="order__total">${o.mode === "delivery" ? `<span class="muted">dont livraison ${money(o.delivery_fee)}</span>` : ""}<b>${money(o.total)}</b></p>
      ${eta && (s === "accepted") ? `<p class="eta-line">⏱ Prête vers ${time(eta.toISOString())}</p>` : ""}
      ${s === "refused" && o.refuse_reason ? `<p class="muted">Motif : ${esc(o.refuse_reason)}</p>` : ""}
      ${s === "cancelled" ? `<p class="muted">Annulée par ${o.cancelled_by === "staff" ? "le restaurant" : "le client"}${o.cancel_reason ? ` · ${esc(o.cancel_reason)}` : ""}</p>` : ""}
      ${actions ? `<div class="order__actions">${actions}</div>` : ""}
    </article>`;
  }
  function render() {
    const all = Array.from(orders.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const groups = {
      new: all.filter((o) => o.status === "new").reverse(),
      doing: all.filter((o) => ["accepted", "ready", "on_the_way"].includes(o.status)).reverse(),
      done: all.filter((o) => ["done", "refused", "cancelled"].includes(o.status)),
    };
    const empty = { new: "Aucune commande en attente.", doing: "Rien en préparation.", done: "Rien pour le moment." };
    Object.keys(groups).forEach((k) => {
      $("#list-" + k).innerHTML = groups[k].length ? groups[k].map((o) => cardHtml(o)).join("") : `<p class="empty">${empty[k]}</p>`;
      $("#n-" + k).textContent = groups[k].length || "";
    });
    $("#count-new").textContent = groups.new.length;
    $("#count-new").hidden = !groups.new.length;
    document.title = `${groups.new.length ? `(${groups.new.length}) ` : ""}Commandes · ${C.name}`;
    if (!owner) handleAlert(groups.new);
  }

  /* ---------- New order alert ---------- */
  function handleAlert(waiting) {
    if (alertId && !waiting.some((o) => o.id === alertId)) closeAlert();
    if (!alertId && waiting.length) openAlert(waiting[0]);
    clearInterval(ringTimer);
    if (waiting.length) { ring(); ringTimer = setInterval(ring, RING_EVERY_MS); }
  }
  function openAlert(o) {
    alertId = o.id;
    $("#alert-title").textContent = `N° ${num(o)} · ${o.mode === "delivery" ? "Livraison" : "À emporter"} · ${money(o.total)}`;
    $("#alert-body").innerHTML = cardHtml(o, true);
    $("#alert-accept").hidden = false;
    $("#alert-refuse").hidden = true;
    $("#reason-other").value = "";
    $$("#reasons .reason").forEach((r) => r.classList.remove("is-on"));
    $("#alert").hidden = false;
  }
  function closeAlert() { alertId = null; $("#alert").hidden = true; }
  function setupAlert() {
    $("#eta-btns").innerHTML = ETAS.map((m) => `<button class="btn btn--green" type="button" data-eta="${m}">${m} min</button>`).join("");
    $("#reasons").innerHTML = REASONS.map((r) => `<button class="reason" type="button">${esc(r)}</button>`).join("");
    $("#eta-btns").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-eta]");
      if (!b || !alertId) return;
      const id = alertId;
      closeAlert();
      await update(id, { status: "accepted", eta_minutes: Number(b.dataset.eta) });
      toast(`Commande acceptée · ${b.dataset.eta} min`);
    });
    $("#refuse-open").addEventListener("click", () => { $("#alert-accept").hidden = true; $("#alert-refuse").hidden = false; });
    $("#refuse-back").addEventListener("click", () => { $("#alert-accept").hidden = false; $("#alert-refuse").hidden = true; });
    $("#reasons").addEventListener("click", (e) => {
      const r = e.target.closest(".reason");
      if (!r) return;
      $$("#reasons .reason").forEach((x) => x.classList.toggle("is-on", x === r));
      $("#reason-other").value = "";
    });
    $("#refuse-go").addEventListener("click", async () => {
      const picked = $("#reasons .reason.is-on");
      const reason = ($("#reason-other").value.trim() || (picked && picked.textContent) || "").slice(0, 120);
      if (!reason) { toast("Choisissez un motif."); return; }
      const id = alertId;
      closeAlert();
      await update(id, { status: "refused", refuse_reason: reason });
    });
  }

  /* ---------- Card buttons ---------- */
  function driverText(o) {
    return [
      `🛵 Livraison ${C.name} · N° ${num(o)}`,
      `Client : ${o.customer_name}`,
      `Téléphone : ${phoneFmt(o.customer_phone)}`,
      `Adresse : ${o.address}`,
      `📍 ${mapLink(o)}`,
      "",
      ...(o.items || []).map((l) => `• ${l.qty} × ${l.name}${l.details && l.details.length ? ` (${l.details.join(", ")})` : ""}`),
      "",
      `À encaisser : ${money(o.total)} (espèces)`,
      o.notes ? `Remarque : ${o.notes}` : null,
    ].filter((x) => x !== null).join("\n");
  }
  function setupBoard() {
    $("#tab-orders").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-do]");
      if (!b) return;
      const o = orders.get(b.dataset.id);
      if (!o) return;
      const what = b.dataset.do;
      if (what === "open") return openAlert(o);
      if (what === "driver") {
        // No number: WhatsApp asks which contact (the driver) to send it to.
        window.open(`https://wa.me/?text=${encodeURIComponent(driverText(o))}`, "_blank", "noopener");
        return;
      }
      if (what === "cancel") {
        const reason = prompt("Motif de l'annulation (vu par le client) :", "");
        if (reason === null) return;
        if (!reason.trim()) { toast("Indiquez un motif."); return; }
        return update(o.id, { status: "cancelled", cancelled_by: "staff", cancel_reason: reason.trim().slice(0, 120) });
      }
      b.disabled = true;
      await update(o.id, { status: what });
    });
  }

  /* ---------- Statistics ---------- */
  // Casablanca wall-clock parts of a date.
  function parts(d) {
    const p = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short", timeZone: C.timeZone }).formatToParts(d);
    const get = (t) => p.find((x) => x.type === t).value;
    return { y: +get("year"), m: +get("month"), d: +get("day"), h: +get("hour"), wd: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) };
  }
  // The service day an order belongs to, as "YYYY-MM-DD" (before 06:00 counts as the day before).
  function serviceDay(d) {
    const shifted = new Date(d.getTime() - DAY_START_HOUR * 3600e3);
    const p = parts(shifted);
    return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  }
  const addDays = (day, n) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  function range(p) {
    const today = serviceDay(new Date());
    const wd = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
    const monthStart = today.slice(0, 8) + "01";
    const prevMonthStart = (() => { const d = new Date(monthStart + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); })();
    return {
      today: [today, today], yesterday: [addDays(today, -1), addDays(today, -1)],
      week: [addDays(today, -wd), today], lastweek: [addDays(today, -wd - 7), addDays(today, -wd - 1)],
      month: [monthStart, today], lastmonth: [prevMonthStart, addDays(monthStart, -1)],
    }[p];
  }
  const dayLabel = (day) => new Date(day + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  async function statsOrders(from, to) {
    // a little wider than the range; serviceDay() then keeps the right ones
    const a = new Date(from + "T00:00:00Z").toISOString();
    const b = new Date(addDays(to, 2) + "T00:00:00Z").toISOString();
    if (DEMO) return Store.all().filter((o) => mine(o) && o.created_at >= a && o.created_at < b);
    let q = db.from("orders").select("created_at, status, mode, total, delivery_fee, items, location").gte("created_at", a).lt("created_at", b).limit(5000);
    if (!owner) q = q.eq("location", site.id);
    const { data, error } = await q;
    if (error) { toast("Statistiques indisponibles."); return []; }
    return data;
  }

  async function renderStats() {
    const [from, to] = range(period);
    $$("#periods [data-p]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.p === period ? "true" : "false"));
    $("#stats-range").textContent = from === to ? dayLabel(from) : `Du ${dayLabel(from)} au ${dayLabel(to)}`;
    const list = (await statsOrders(from, to)).filter((o) => { const d = serviceDay(new Date(o.created_at)); return d >= from && d <= to; });
    const done = list.filter((o) => o.status === "done");
    const revenue = done.reduce((n, o) => n + o.total, 0);
    const lost = list.filter((o) => o.status === "refused" || o.status === "cancelled").length;
    const deliv = done.filter((o) => o.mode === "delivery").length;
    const tiles = [
      ["Commandes reçues", list.length],
      ["Terminées", done.length],
      ["Chiffre d'affaires", money(revenue)],
      ["Panier moyen", done.length ? money(revenue / done.length) : "—"],
      ["Livraison / À emporter", `${deliv} / ${done.length - deliv}`],
      ["Refusées ou annulées", lost],
    ];
    $("#stats-tiles").innerHTML = tiles.map(([k, v]) => `<div class="tile"><span class="tile__k">${esc(k)}</span><span class="tile__v">${esc(v)}</span></div>`).join("");

    const best = new Map();
    done.forEach((o) => (o.items || []).forEach((l) => {
      const b = best.get(l.name) || { qty: 0, total: 0 };
      b.qty += l.qty; b.total += l.total;
      best.set(l.name, b);
    }));
    const top = Array.from(best.entries()).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
    $("#stats-best").innerHTML = top.length
      ? top.map(([n, b]) => `<li><span class="best__name">${esc(n)}</span><span class="best__q">${b.qty}</span><span class="best__t">${money(b.total)}</span></li>`).join("")
      : `<li class="empty">Pas encore de ventes sur cette période.</li>`;

    // one day: orders by hour; longer: revenue by day (single series, one colour, value on hover)
    let bars;
    if (from === to) {
      $("#stats-bars-title").textContent = "Commandes par heure";
      const byH = {};
      list.forEach((o) => { const h = parts(new Date(o.created_at)).h; byH[h] = (byH[h] || 0) + 1; });
      const hours = [];
      for (let h = 11; h <= 25; h++) hours.push(h % 24);
      bars = hours.map((h) => ({ label: `${h}h`, value: byH[h] || 0, text: `${h}h : ${byH[h] || 0} commande${(byH[h] || 0) > 1 ? "s" : ""}` }));
    } else {
      $("#stats-bars-title").textContent = "Chiffre d'affaires par jour";
      const byD = {};
      done.forEach((o) => { const d = serviceDay(new Date(o.created_at)); byD[d] = (byD[d] || 0) + o.total; });
      bars = [];
      for (let d = from; d <= to; d = addDays(d, 1)) bars.push({ label: String(+d.slice(8)), value: byD[d] || 0, text: `${dayLabel(d)} : ${money(byD[d] || 0)}` });
    }
    const max = Math.max(1, ...bars.map((b) => b.value));
    $("#stats-bars").innerHTML = `<div class="bars__plot">${bars.map((b) => `
      <div class="bars__col" title="${esc(b.text)}" tabindex="0" aria-label="${esc(b.text)}">
        <span class="bars__bar" style="height:${Math.round((b.value / max) * 100)}%"></span>
      </div>`).join("")}</div>
      <div class="bars__axis">${bars.map((b, i) => `<span>${bars.length > 16 && i % 3 ? "" : esc(b.label)}</span>`).join("")}</div>`;
  }

  /* ---------- Demo helpers ---------- */
  // Example orders over the last 5 weeks, clearly marked as demo, so the statistics can be shown.
  function seed() {
    const menu = [["Bella Margarita", 45], ["Al Pollo", 55], ["Peperoni", 55], ["Capricciosa", 59], ["Diavola", 65], ["Cibo Napoli", 95], ["Truffe Mafia", 85], ["Alfredo", 55, "Tagliatelle"], ["Bolognaise", 59, "Spaghetti"], ["Pesto Rosso", 60, "Fusilli"], ["Lasagne Nonna", 70], ["Ravioli Pollo", 60], ["Milanese Pollo", 69], ["Tiramisu", 30], ["Panna cotta mangue", 25]];
    const list = Store.read();
    for (let i = 0; i < 140; i++) {
      const at = new Date(Date.now() - Math.random() * 35 * 864e5);
      const h = 12 + Math.floor(Math.random() * 12);
      at.setUTCHours(h - 1, Math.floor(Math.random() * 60));
      if (at > new Date()) continue;
      const items = [];
      for (let k = 0, n = 1 + Math.floor(Math.random() * 3); k < n; k++) {
        const [name, price, opt] = menu[Math.floor(Math.random() * menu.length)];
        const qty = 1 + (Math.random() < 0.25 ? 1 : 0);
        items.push({ id: name, name, qty, details: opt ? [opt] : [], unit: price, total: qty * price });
      }
      const mode = Math.random() < 0.55 ? "delivery" : "pickup";
      const sub = items.reduce((n, l) => n + l.total, 0);
      const fee = mode === "delivery" ? C.delivery.fee : 0;
      const r = Math.random();
      list.push({ id: window.ORDERS.uuid(), token: window.ORDERS.uuid(), location: C.locations[0].id, created_at: at.toISOString(), updated_at: at.toISOString(),
        status: r < 0.88 ? "done" : r < 0.95 ? "refused" : "cancelled", mode, customer_name: null, customer_phone: null, address: null, lat: null, lng: null,
        notes: null, items, subtotal: sub, delivery_fee: fee, total: sub + fee, lang: "fr", anonymized_at: at.toISOString(), demo: true, example: true });
    }
    Store.write(list);
    toast("Exemples ajoutés.");
    renderStats();
  }

  /* ---------- Push notifications ---------- */
  const b64ToBytes = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
  async function enablePush() {
    if (DEMO || !O.vapidPublicKey) { toast("Disponible après la mise en service (Supabase)."); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { toast("Ce téléphone ne permet pas les notifications ici. Installez l'app d'abord."); return; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("Notifications refusées dans les réglages."); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(O.vapidPublicKey) });
    const j = sub.toJSON();
    const { data: u } = await db.auth.getUser();
    const { error } = await db.from("push_subscriptions").upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: u.user.id, device: navigator.userAgent.slice(0, 300) }, { onConflict: "endpoint" });
    toast(error ? "Échec de l'enregistrement." : "Notifications activées sur ce téléphone.");
  }
  async function testPush() {
    if (DEMO || !O.vapidPublicKey) { toast("Disponible après la mise en service (Supabase)."); return; }
    const { data: s } = await db.auth.getSession();
    const r = await fetch(`${O.supabaseUrl}/functions/v1/push`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session.access_token}`, apikey: O.publishableKey }, body: JSON.stringify({ mode: "test" }) });
    const j = await r.json().catch(() => ({}));
    toast(r.ok ? `Envoyée à ${j.phones || 0} téléphone(s).` : "Échec de l'envoi.");
  }

  /* ---------- Menu, tabs, install ---------- */
  function switchTab(tab) {
    $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false"));
    $("#tab-orders").hidden = tab !== "orders";
    $("#tab-stats").hidden = tab !== "stats";
    if (tab === "stats") renderStats();
  }
  function setupChrome() {
    $$("[data-tab]").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
    $("#periods").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) { period = b.dataset.p; renderStats(); } });
    const menu = $("#menu");
    $("#menu-btn").addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; $("#menu-btn").setAttribute("aria-expanded", String(!menu.hidden)); });
    document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest("#menu")) { menu.hidden = true; $("#menu-btn").setAttribute("aria-expanded", "false"); } });
    menu.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      menu.hidden = true;
      const act = b.dataset.act;
      if (act === "sound") { unlockAudio(); ring(); }
      if (act === "push") enablePush();
      if (act === "push-test") testPush();
      if (act === "logout") signOut();
      if (act === "seed") seed();
      if (act === "clear" && confirm("Effacer toutes les commandes de démo de ce navigateur ?")) { Store.write([]); loadOrders(); renderStats(); }
      if (act === "install" && installEvt) { installEvt.prompt(); installEvt = null; $("#install-btn").hidden = true; }
    });
    $("#start-btn").addEventListener("click", startApp);
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; $("#install-btn").hidden = false; });
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/commandes/sw.js", { scope: "/commandes/" }).catch(() => {});
    setInterval(() => { if (!$("#app").hidden) render(); }, 60e3); // minutes since
  }

  setupAlert();
  setupBoard();
  setupChrome();
  boot();
})();
