/*
 * Cibo Napoli: table booking (/reserver/). Day (the next 14 days as buttons, or any day up to booking.maxDays),
 * time (half-hour slots), people, children, name and phone. The request goes to the staff screen (js/orders.js →
 * /commandes/, « Réservations »), where the staff confirm it by phone or WhatsApp. WhatsApp is the way out if
 * sending fails.
 */
(function () {
  const CN = window.CN;
  const { C, SITE, $, $$, esc, t } = CN;
  const B = C.booking;
  const f = $("#book-form");
  const state = { date: null, time: null, people: 2, kids: 0, hasKids: false, sending: false };
  const DETAILS_KEY = "cibo.customer.v1";
  const saved = CN.store.get(DETAILS_KEY) || {};

  const addDays = (day, n) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dayLabel = (day, opts) => new Date(day + "T12:00:00Z").toLocaleDateString(CN.LANG === "en" ? "en-GB" : "fr-FR", Object.assign({ timeZone: "UTC" }, opts));
  const today = () => CN.casaParts().date;
  const normPhone = (s) => {
    let d = String(s || "").replace(/[^\d+]/g, "");
    if (d.startsWith("+212")) d = "0" + d.slice(4);
    else if (d.startsWith("00212")) d = "0" + d.slice(5);
    else if (d.startsWith("212") && d.length === 12) d = "0" + d.slice(3);
    return /^0[5-7]\d{8}$/.test(d) ? d : null;
  };

  function slots() {
    const out = [];
    for (let m = CN.toMin(B.first); m <= CN.toMin(B.last); m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    return out;
  }
  // today: only times at least 30 minutes from now
  const slotOk = (day, s) => day !== today() || CN.toMin(s) >= CN.casaParts().minutes + 30;

  function renderDays() {
    const t0 = today();
    const days = [];
    for (let i = 0; i < 14; i++) days.push(addDays(t0, i));
    $("#book-days").innerHTML = days.map((d, i) => `
      <button type="button" class="day" data-day="${d}" aria-pressed="${state.date === d}">
        <span class="day__w">${esc(i === 0 ? (CN.LANG === "en" ? "Today" : "Aujourd'hui") : i === 1 ? (CN.LANG === "en" ? "Tomorrow" : "Demain") : dayLabel(d, { weekday: "short" }))}</span>
        <span class="day__d">${esc(dayLabel(d, { day: "numeric" }))}</span>
        <span class="day__m">${esc(dayLabel(d, { month: "short" }))}</span>
      </button>`).join("");
    const other = $("#book-date");
    other.min = t0;
    other.max = addDays(t0, B.maxDays);
    other.value = state.date && !days.includes(state.date) ? state.date : "";
  }
  function renderSlots() {
    const box = $("#book-slots");
    if (!state.date) { box.innerHTML = `<p class="hint">${esc(t("book.pickDay"))}</p>`; return; }
    const list = slots();
    const ok = list.filter((s) => slotOk(state.date, s));
    if (state.time && !ok.includes(state.time)) state.time = null;
    box.innerHTML = ok.length
      ? list.map((s) => `<button type="button" class="slot" data-time="${s}" aria-pressed="${state.time === s}"${slotOk(state.date, s) ? "" : " disabled"}>${s}</button>`).join("")
      : `<p class="hint">${esc(t("book.noSlots"))}</p>`;
  }
  function renderPeople() {
    $("#people-n").textContent = state.people;
    $("#people-less").disabled = state.people <= 1;
    $("#people-more").disabled = state.people >= B.maxPeople;
    $("#people-max").textContent = state.people >= B.maxPeople ? t("book.morePeople", { n: B.maxPeople }) : "";
    $$('input[name="kids"]').forEach((r) => { r.checked = (r.value === "yes") === state.hasKids; });
    $("#kids-box").hidden = !state.hasKids;
    if (state.hasKids) {
      state.kids = Math.min(Math.max(state.kids, 1), Math.max(1, state.people - 1));
      $("#kids-n").textContent = state.kids;
      $("#kids-less").disabled = state.kids <= 1;
      $("#kids-more").disabled = state.kids >= state.people - 1;
    }
  }
  function render() {
    $$("#book-days .day").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.day === state.date)));
    renderSlots();
    renderPeople();
    $("#book-btn").disabled = state.sending;
    $("#book-btn").textContent = t(state.sending ? "book.sending" : "book.submit");
  }

  const peopleText = (n, kids) => (n === 1 ? t("book.person") : t("book.persons", { n })) + (kids ? ` (${t("book.withKids", { n: kids })})` : "");
  function waText(b) {
    return [
      `Bonjour ${C.name}, je voudrais réserver une table :`,
      `Jour : ${new Date(b.date + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} à ${b.time}`,
      `Personnes : ${b.people}${b.kids ? ` (dont ${b.kids} enfant${b.kids > 1 ? "s" : ""})` : ""}`,
      `Nom : ${b.customer_name}`,
      `Téléphone : ${b.customer_phone}`,
      b.notes ? `Remarque : ${b.notes}` : null,
    ].filter(Boolean).join("\n");
  }

  async function submit(e) {
    e.preventDefault();
    const err = $("#book-err");
    err.textContent = "";
    let m = null;
    if (!state.date) m = "book.missing.date";
    else if (!state.time) m = "book.missing.time";
    else if (!f.elements.name.value.trim()) m = "cart.missing.name";
    else if (!normPhone(f.elements.phone.value)) m = "cart.missing.phone";
    if (m) { err.textContent = t(m); return; }
    const b = {
      location: SITE.id,
      date: state.date,
      time: state.time,
      people: state.people,
      kids: state.hasKids ? state.kids : 0,
      customer_name: f.elements.name.value.trim().slice(0, 60),
      customer_phone: normPhone(f.elements.phone.value),
      notes: f.elements.notes.value.trim().slice(0, 300) || null,
      lang: CN.LANG,
    };
    CN.store.set(DETAILS_KEY, Object.assign({}, CN.store.get(DETAILS_KEY) || {}, { name: f.elements.name.value, phone: f.elements.phone.value }));
    state.sending = true;
    render();
    let ok = true;
    try {
      await window.ORDERS.book(b);
    } catch (x) {
      if (x && x.code === "spam") { err.textContent = t("track.spam"); state.sending = false; render(); return; }
      ok = false;
    }
    state.sending = false;
    render();
    $("#book-done").hidden = false;
    f.hidden = true;
    $("#book-done-title").textContent = t(ok ? "book.sentTitle" : "book.failed");
    $("#book-done-text").textContent = ok ? t("book.sentText") : "";
    $("#book-summary").textContent = t("book.summary", { day: dayLabel(b.date, { weekday: "long", day: "numeric", month: "long" }), time: b.time, people: peopleText(b.people, b.kids) });
    const wa = $("#book-wa");
    wa.hidden = ok;
    wa.href = CN.waLink(waText(b));
    $("#book-done").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setup() {
    f.elements.name.value = saved.name || "";
    f.elements.phone.value = saved.phone || "";
    $("#book-days").addEventListener("click", (e) => {
      const b = e.target.closest("[data-day]");
      if (!b) return;
      state.date = b.dataset.day;
      $("#book-date").value = "";
      render();
    });
    $("#book-date").addEventListener("change", (e) => {
      const v = e.target.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= today() && v <= addDays(today(), B.maxDays)) state.date = v;
      render();
    });
    $("#book-slots").addEventListener("click", (e) => {
      const b = e.target.closest("[data-time]");
      if (!b || b.disabled) return;
      state.time = b.dataset.time;
      render();
    });
    $("#people-less").addEventListener("click", () => { state.people = Math.max(1, state.people - 1); render(); });
    $("#people-more").addEventListener("click", () => { state.people = Math.min(B.maxPeople, state.people + 1); render(); });
    $("#kids-less").addEventListener("click", () => { state.kids = Math.max(1, state.kids - 1); render(); });
    $("#kids-more").addEventListener("click", () => { state.kids = Math.min(state.people - 1, state.kids + 1); render(); });
    $$('input[name="kids"]').forEach((r) => r.addEventListener("change", () => {
      state.hasKids = r.value === "yes" && state.people > 1;
      if (r.value === "yes" && state.people === 1) { state.people = 2; state.hasKids = true; }
      render();
    }));
    f.addEventListener("submit", submit);
    $("#book-again").addEventListener("click", () => {
      $("#book-done").hidden = true;
      f.hidden = false;
      state.date = null; state.time = null;
      renderDays();
      render();
    });
    renderDays();
    render();
  }
  setup();
})();
