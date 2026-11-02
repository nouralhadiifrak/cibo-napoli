/*
 * Cibo Napoli: the « road map » of the menu (/commander/).
 * In each category the plates sit left, right, left…; a thin golden line runs from one plate to the next with a
 * dot at each end, and drawn vegetables (basil, cherry tomatoes, garlic, chili, olives, mushroom) lie along the way.
 * The line is an SVG drawn over each .dishes.road from the plates' real positions, and drawn again whenever the
 * layout changes (phone turned, fonts or photos loaded). It draws itself in as it comes into view.
 * window.ROADMAP.draw(container) · window.ROADMAP.watch(rootElement)
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";

  // Drawn vegetables, 64 x 64, simple shapes with soft gradients (no stock photos).
  const VEG = [
    // basil sprig
    `<g><path d="M30 60c1-14 2-26 6-40" stroke="#3d7a2a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M33 30C20 30 10 22 8 10c13 0 24 7 25 20z" fill="url(#vg-leaf)"/>
      <path d="M35 24c4-11 13-18 25-18-1 12-10 20-25 18z" fill="url(#vg-leaf)"/>
      <path d="M31 46c-10 2-19-2-23-11 10-2 19 2 23 11z" fill="url(#vg-leaf)"/>
      <path d="M33 30L14 13M35 24l20-15M31 46L12 37" stroke="#cdeab4" stroke-opacity=".5" stroke-width="1" fill="none"/></g>`,
    // two cherry tomatoes
    `<g><circle cx="24" cy="38" r="15" fill="url(#vg-tom)"/><circle cx="44" cy="28" r="12" fill="url(#vg-tom)"/>
      <path d="M24 23l-5-4m5 4l5-5m-5 5l0-6m20 0l-4-4m4 4l4-4m-4 4v-5" stroke="#3f7d2c" stroke-width="2.4" stroke-linecap="round"/>
      <ellipse cx="18" cy="32" rx="4" ry="2.5" fill="#fff" opacity=".35" transform="rotate(-30 18 32)"/>
      <ellipse cx="40" cy="23" rx="3" ry="2" fill="#fff" opacity=".35" transform="rotate(-30 40 23)"/></g>`,
    // garlic bulb and a clove
    `<g><path d="M28 14c-2 6-14 12-14 26 0 10 8 16 16 16s16-6 16-16c0-14-12-20-14-26z" fill="url(#vg-garlic)"/>
      <path d="M30 18c-3 10-6 20-4 36M30 18c3 10 6 20 4 36M30 14V6" stroke="#c9bba3" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <path d="M50 52c-6 0-10-4-9-10 4 2 9 5 9 10z" fill="url(#vg-garlic)"/></g>`,
    // red chili
    `<g><path d="M14 52C26 48 44 36 50 16c2-4 6-3 6 1-2 22-20 38-40 40-4 0-6-4-2-5z" fill="url(#vg-chili)"/>
      <path d="M52 16c0-4 2-8 6-10" stroke="#3f7d2c" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M22 50c10-4 22-14 28-28" stroke="#fff" stroke-opacity=".3" stroke-width="2" fill="none" stroke-linecap="round"/></g>`,
    // olive branch
    `<g><path d="M8 54C22 44 36 30 56 10" stroke="#6b6a3a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M20 45c-6-6-14-6-16-4 4 6 10 7 16 4zM30 36c0-8 6-14 10-14 0 6-4 12-10 14zM42 24c6-4 13-3 15 0-5 4-11 4-15 0z" fill="url(#vg-olive-leaf)"/>
      <ellipse cx="26" cy="46" rx="5" ry="6.5" fill="url(#vg-olive)" transform="rotate(-30 26 46)"/>
      <ellipse cx="44" cy="34" rx="4.5" ry="6" fill="url(#vg-olive)" transform="rotate(-40 44 34)"/></g>`,
    // mushroom
    `<g><path d="M24 34h16l-2 20c0 3-12 3-12 0z" fill="#efe4d0"/>
      <path d="M8 34C8 20 20 12 32 12s24 8 24 22c-8 2-40 2-48 0z" fill="url(#vg-mush)"/>
      <circle cx="22" cy="24" r="3" fill="#fff" opacity=".22"/><circle cx="36" cy="20" r="2.4" fill="#fff" opacity=".22"/><circle cx="44" cy="28" r="2" fill="#fff" opacity=".22"/></g>`,
  ];
  const DEFS = `<defs>
    <linearGradient id="vg-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6cbc45"/><stop offset="1" stop-color="#2a6e22"/></linearGradient>
    <radialGradient id="vg-tom" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#ff6a50"/><stop offset=".6" stop-color="#d9261c"/><stop offset="1" stop-color="#8f1210"/></radialGradient>
    <linearGradient id="vg-garlic" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#d9ccb4"/></linearGradient>
    <linearGradient id="vg-chili" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9e1410"/><stop offset=".5" stop-color="#e2321f"/><stop offset="1" stop-color="#c41d14"/></linearGradient>
    <linearGradient id="vg-olive-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#93a35a"/><stop offset="1" stop-color="#55632e"/></linearGradient>
    <radialGradient id="vg-olive" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#7c8a3c"/><stop offset="1" stop-color="#3b4419"/></radialGradient>
    <radialGradient id="vg-mush" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#c79a6b"/><stop offset="1" stop-color="#7a4f2c"/></radialGradient>
  </defs>`;

  let defsDone = false;
  function ensureDefs() {
    if (defsDone) return;
    defsDone = true;
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("width", "0"); s.setAttribute("height", "0"); s.setAttribute("aria-hidden", "true");
    s.style.position = "absolute";
    s.innerHTML = DEFS;
    document.body.appendChild(s);
  }

  function draw(box) {
    const plates = Array.from(box.querySelectorAll(":scope > .dish > .dish__media"));
    let svg = box.querySelector(":scope > .road__line");
    if (!svg) {
      svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "road__line");
      svg.setAttribute("aria-hidden", "true");
      box.prepend(svg);
    }
    const W = box.clientWidth, H = box.clientHeight;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    if (plates.length < 1 || !W) { svg.innerHTML = ""; return; }
    const b = box.getBoundingClientRect();
    const P = plates.map((m) => {
      const r = m.getBoundingClientRect();
      return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, r: r.width / 2 };
    });
    const offset = Number(box.dataset.veg || 0);
    let paths = "", dots = "", veg = "";
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], c = P[i + 1];
      // leave each plate on its open side, a little below the middle, and arrive at the top of the next one
      const dir = c.x > a.x ? 1 : -1;
      const ang = dir > 0 ? Math.PI * 0.32 : Math.PI * 0.68;
      const sx = a.x + Math.cos(ang) * (a.r + 9), sy = a.y + Math.sin(ang) * (a.r + 9);
      const ang2 = dir > 0 ? -Math.PI * 0.68 : -Math.PI * 0.32;
      const ex = c.x + Math.cos(ang2) * (c.r + 9), ey = c.y + Math.sin(ang2) * (c.r + 9);
      const k = Math.max(40, (ey - sy) * 0.55);
      paths += `<path class="road__path" d="M${sx.toFixed(1)} ${sy.toFixed(1)} C${(sx + dir * 10).toFixed(1)} ${(sy + k).toFixed(1)} ${(ex - dir * 10).toFixed(1)} ${(ey - k).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"/>`;
      dots += `<circle class="road__dot" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4"/><circle class="road__dot" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="4"/>`;
      // a vegetable in the space the line leaves free: on the side the line comes from, halfway down
      const v = VEG[(i + offset) % VEG.length];
      const size = W < 640 ? 40 : 64;
      const vx = dir > 0 ? Math.max(4, a.x - a.r * 0.2 - size / 2) : Math.min(W - size - 4, a.x + a.r * 0.2 - size / 2);
      const vy = (sy + ey) / 2 - size / 2;
      const rot = ((i * 47 + offset * 31) % 70) - 35;
      veg += `<g class="road__veg" transform="translate(${vx.toFixed(1)} ${vy.toFixed(1)}) rotate(${rot} ${size / 2} ${size / 2}) scale(${size / 64})">${v}</g>`;
    }
    // wide screens: a few more lying beside the text, on the side away from the plate, like on a real table
    if (W >= 900) {
      P.forEach((p, i) => {
        if (i % 2) return;
        const size = 62;
        const x = p.x < W / 2 ? W - size - 6 : 6;
        const rot = ((i * 59 + offset * 17) % 80) - 40;
        veg += `<g class="road__veg" transform="translate(${x} ${(p.y - size / 2 + 30).toFixed(1)}) rotate(${rot} ${size / 2} ${size / 2}) scale(${size / 64})">${VEG[(i + offset + 3) % VEG.length]}</g>`;
      });
    }
    svg.innerHTML = `<g class="road__paths">${paths}</g>${veg}<g>${dots}</g>`;
    svg.querySelectorAll(".road__path").forEach((p) => {
      const len = p.getTotalLength ? p.getTotalLength() : 0;
      p.style.strokeDasharray = `${len} ${len}`;
      p.style.setProperty("--len", len);
    });
  }

  function watch(root) {
    ensureDefs();
    const boxes = Array.from(root.querySelectorAll(".dishes.road"));
    boxes.forEach((box, i) => { box.dataset.veg = String(i * 2); });
    const redraw = () => boxes.forEach(draw);
    let t = 0;
    const later = () => { clearTimeout(t); t = setTimeout(redraw, 80); };
    redraw();
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(later);
      boxes.forEach((b) => ro.observe(b));
    } else {
      window.addEventListener("resize", later);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
    window.addEventListener("load", later);
    root.addEventListener("load", later, true); // a photo loaded
    // the line draws itself as each category comes into view
    if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      boxes.forEach((b) => b.classList.add("is-waiting"));
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.remove("is-waiting"); e.target.classList.add("is-drawn"); io.unobserve(e.target); }
      }), { rootMargin: "0px 0px -15% 0px" });
      boxes.forEach((b) => io.observe(b));
    }
  }

  window.ROADMAP = { draw, watch };
})();
