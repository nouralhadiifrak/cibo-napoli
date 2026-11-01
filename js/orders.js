/*
 * Cibo Napoli: where orders go. One small API for the customer site, two ways behind it:
 *
 *  - DEMO MODE (CONFIG.orders.supabaseUrl is empty): orders live in this browser's localStorage. Open the staff
 *    screen /commandes/ in another tab of the same browser to accept them; both tabs see each other's changes at
 *    once (the "storage" event). The same rules as the real database are copied here: 5 orders per phone in
 *    10 minutes, personal details erased after 24 hours, orders deleted after 2 years.
 *  - SUPABASE: the customer adds an order and reads or cancels it with its secret token, sent in the
 *    "x-order-token" header (row level security, see supabase/schema.sql). Plain fetch calls: no library to load.
 *
 * window.ORDERS = { demo, create(order), get(id, token), cancel(id, token), watch(id, token, onChange) → stop,
 *                   DemoStore (used by the staff screen in demo mode) }
 */
(function () {
  const O = (window.CONFIG && window.CONFIG.orders) || {};
  const demo = !O.supabaseUrl;
  // Columns the customer may read back (the same list is granted to the anon role in supabase/schema.sql).
  const PUBLIC_COLS = "id,location,status,eta_minutes,accepted_at,refuse_reason,cancel_reason,cancelled_by,created_at,updated_at,mode,total";

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

  class OrderError extends Error {
    constructor(code, message) { super(message || code); this.code = code; }
  }

  /* ---------- Demo store (localStorage) ---------- */
  const KEY = "cibo.demo.orders.v1";
  const DemoStore = {
    read() {
      try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
    },
    write(list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { throw new OrderError("storage"); }
      // the storage event only reaches the other tabs; tell this one too
      window.dispatchEvent(new CustomEvent("cibo-demo-orders"));
    },
    // The database's scheduled clean-ups, run on every read in demo mode.
    tidy(list) {
      const now = Date.now();
      let changed = false;
      list = list.filter((o) => {
        const keep = now - Date.parse(o.created_at) < 2 * 365 * 864e5;
        if (!keep) changed = true;
        return keep;
      });
      list.forEach((o) => {
        if (!o.anonymized_at && now - Date.parse(o.created_at) > 864e5) {
          Object.assign(o, { customer_name: null, customer_phone: null, address: null, lat: null, lng: null, distance_km: null, notes: null, anonymized_at: new Date().toISOString() });
          changed = true;
        }
      });
      if (changed) DemoStore.write(list);
      return list;
    },
    all() { return DemoStore.tidy(DemoStore.read()); },
    insert(order) {
      const list = DemoStore.all();
      const tenMin = Date.now() - 10 * 60e3;
      if (list.filter((o) => o.customer_phone === order.customer_phone && Date.parse(o.created_at) > tenMin).length >= 5) {
        throw new OrderError("spam");
      }
      const now = new Date().toISOString();
      list.push(Object.assign({ status: "new", created_at: now, updated_at: now, eta_minutes: null, accepted_at: null,
        refuse_reason: null, cancel_reason: null, cancelled_by: null, anonymized_at: null, demo: true }, order));
      DemoStore.write(list);
    },
    update(id, patch) {
      const list = DemoStore.all();
      const o = list.find((x) => x.id === id);
      if (!o) return null;
      if (["done", "refused", "cancelled"].includes(o.status)) return o; // a finished order cannot change
      Object.assign(o, patch, { updated_at: new Date().toISOString() });
      if (patch.status === "accepted" && !o.accepted_at) o.accepted_at = o.updated_at;
      DemoStore.write(list);
      return o;
    },
    remove(ids) {
      DemoStore.write(DemoStore.all().filter((o) => !ids.includes(o.id)));
    },
    subscribe(cb) {
      const onStorage = (e) => { if (!e.key || e.key === KEY) cb(); };
      window.addEventListener("storage", onStorage);
      window.addEventListener("cibo-demo-orders", cb);
      return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("cibo-demo-orders", cb); };
    },
  };
  const publicView = (o) => {
    if (!o) return null;
    const out = {};
    PUBLIC_COLS.split(",").forEach((k) => { out[k] = o[k] === undefined ? null : o[k]; });
    return out;
  };

  /* ---------- Supabase (REST) ---------- */
  const rest = (path, opts = {}) => fetch(`${O.supabaseUrl}/rest/v1/${path}`, Object.assign({}, opts, {
    headers: Object.assign({ apikey: O.publishableKey, "Content-Type": "application/json" }, opts.headers || {}),
  }));
  async function fail(res) {
    let body = {};
    try { body = await res.json(); } catch (e) { /* not json */ }
    if (body && body.code === "P0001") throw new OrderError("spam", body.message);
    if (body && body.code === "P0002") throw new OrderError("zone", body.message);
    throw new OrderError("http", `${res.status} ${body.message || ""}`);
  }

  /* ---------- API ---------- */
  async function create(order) {
    order = Object.assign({ id: uuid(), token: uuid() }, order);
    if (demo) {
      DemoStore.insert(order);
    } else {
      const res = await rest("orders", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(order) });
      if (!res.ok) await fail(res);
    }
    return { id: order.id, token: order.token };
  }

  async function get(id, token) {
    if (demo) {
      const o = DemoStore.all().find((x) => x.id === id && x.token === token);
      return publicView(o);
    }
    const res = await rest(`orders?id=eq.${encodeURIComponent(id)}&select=${PUBLIC_COLS}`, { headers: { "x-order-token": token } });
    if (!res.ok) await fail(res);
    const rows = await res.json();
    return rows[0] || null;
  }

  // The customer may cancel only while the order waits (the database refuses it afterwards).
  async function cancel(id, token) {
    if (demo) {
      const o = DemoStore.all().find((x) => x.id === id && x.token === token);
      if (!o || o.status !== "new") throw new OrderError("too-late");
      DemoStore.update(id, { status: "cancelled", cancelled_by: "customer" });
      return;
    }
    const res = await rest(`orders?id=eq.${encodeURIComponent(id)}&status=eq.new`, {
      method: "PATCH",
      headers: { "x-order-token": token, Prefer: "return=representation" },
      body: JSON.stringify({ status: "cancelled", cancelled_by: "customer" }),
    });
    if (!res.ok) await fail(res);
    const rows = await res.json();
    if (!rows.length) throw new OrderError("too-late");
  }

  // Calls onChange(order) now and whenever the order changes (demo: at once; Supabase: checked every 5 s).
  function watch(id, token, onChange) {
    let last = "";
    let stopped = false;
    const check = async () => {
      if (stopped) return;
      try {
        const o = await get(id, token);
        const sig = JSON.stringify(o);
        if (sig !== last) { last = sig; onChange(o, null); }
      } catch (e) {
        onChange(undefined, e);
      }
    };
    check();
    if (demo) {
      const unsub = DemoStore.subscribe(check);
      return () => { stopped = true; unsub(); };
    }
    const timer = setInterval(() => { if (!document.hidden) check(); }, 5000);
    const onVis = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }

  window.ORDERS = { demo, create, get, cancel, watch, uuid, DemoStore, OrderError };
})();
