/*
 * Cibo Napoli: the opening animation (about 1.6 s). The logo appears on green with the tagline, then glides
 * into its place in the header while the green lifts away. A tap, a click or a key skips it. It plays once per
 * visit (sessionStorage), never with "reduce motion", and not at ?intro=0 (tests).
 * Kept on its own so the animation can be reworked later without touching the rest of the site.
 */
(function () {
  const intro = document.getElementById("intro");
  if (!intro) return;
  const html = document.documentElement;
  let seen = false;
  try { seen = sessionStorage.getItem("cibo.intro") === "1"; } catch (e) { /* storage blocked */ }
  const off = new URLSearchParams(location.search).get("intro") === "0";
  const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const done = () => {
    html.classList.remove("intro-on");
    html.classList.add("intro-done");
    intro.remove();
  };
  if (seen || off || reduced) { done(); return; }
  try { sessionStorage.setItem("cibo.intro", "1"); } catch (e) { /* storage blocked */ }

  const logo = intro.querySelector(".intro__logo");
  const target = document.querySelector(".brand__logo");
  let finished = false;
  const timers = [];
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    intro.classList.add("is-leaving");
    setTimeout(done, 380);
  };
  // FLIP: move the big logo onto the header logo.
  const fly = () => {
    if (finished || !target || !logo) return finish();
    const a = logo.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    if (!a.width || !b.width) return finish();
    const s = b.width / a.width;
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    intro.classList.add("is-flying");
    logo.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
    timers.push(setTimeout(finish, 520));
  };
  timers.push(setTimeout(fly, 1000));
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => window.addEventListener(ev, finish, { once: true, passive: true }));
  intro.querySelector(".intro__skip").addEventListener("click", finish);
  // never block the page, whatever happens
  timers.push(setTimeout(finish, 1900));
})();
