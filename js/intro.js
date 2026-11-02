/*
 * Cibo Napoli: the opening animation.
 * 1. The 4 s film plays full screen: the pizza alone, the box slides in under it, the lid closes, the camera dives
 *    onto the logo and everything turns green (a tall film on phones, a wide one on computers).
 * 2. On its last frame the real logo is placed exactly over the logo in the film, then glides into its place in
 *    the header while the film fades away.
 * If the film can't play (autoplay blocked, slow network, old phone), the classic intro runs instead: the logo on
 * green with the tagline, then the same glide. A tap, a click or a key skips it. It plays once per visit
 * (sessionStorage), never with "reduce motion", and not at ?intro=0 (tests).
 * Kept on its own so the animation can be reworked later without touching the rest of the site.
 */
(function () {
  const intro = document.getElementById("intro");
  if (!intro) return;
  const html = document.documentElement;
  let seen = false;
  try { seen = sessionStorage.getItem("cibo.intro") === "1"; } catch (e) { /* storage blocked */ }
  const params = new URLSearchParams(location.search);
  const off = params.get("intro") === "0";
  const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const done = () => {
    html.classList.remove("intro-on");
    html.classList.add("intro-done");
    intro.remove();
  };
  if (seen || off || reduced) { done(); return; }
  try { sessionStorage.setItem("cibo.intro", "1"); } catch (e) { /* storage blocked */ }

  const logo = intro.querySelector(".intro__logo");
  const video = intro.querySelector(".intro__video");
  let finished = false;
  let mode = "";
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    if (video) { try { video.pause(); } catch (e) { /* ignore */ } }
    // show the header logo at once, so the logo never blinks out while the intro fades
    html.classList.remove("intro-on");
    html.classList.add("intro-done");
    intro.classList.add("is-leaving");
    setTimeout(done, 380);
  };

  // FLIP: move the big logo onto the header logo.
  const fly = () => {
    const target = document.querySelector(".brand__logo");
    if (finished || !target || !logo) return finish();
    const a = logo.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    if (!a.width || !b.width) return finish();
    const s = b.width / a.width;
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    intro.classList.add("is-flying");
    logo.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
    later(finish, 720);
  };

  // The logo on green, then the glide (about 3 s).
  const classic = () => {
    if (finished || mode === "classic") return;
    mode = "classic";
    intro.classList.remove("has-video");
    if (video) video.remove();
    timers.forEach(clearTimeout);
    timers.length = 0;
    later(fly, 2250);
    later(finish, 3300);
  };

  // Where the logo sits in each film's last frame, in the film's own pixels (logo-white is cut to its artwork).
  const LAST = {
    portrait: { w: 720, h: 1280, x: 125, y: 572, lw: 475, lh: 135 },
    landscape: { w: 1920, h: 1080, x: 691, y: 462, lw: 544, lh: 154 },
  };

  // Put the real logo exactly over the film's logo (the film fills the screen like object-fit: cover), then glide.
  const handoff = (kind) => {
    if (finished || mode !== "video") return;
    const L = LAST[kind];
    const r = intro.getBoundingClientRect();
    const s = Math.max(r.width / L.w, r.height / L.h);
    const ox = (r.width - L.w * s) / 2;
    const oy = (r.height - L.h * s) / 2;
    logo.style.cssText = `position:fixed;left:${ox + L.x * s}px;top:${oy + L.y * s}px;width:${L.lw * s}px;height:${L.lh * s}px;max-width:none;margin:0;transform:none;animation:none;`;
    intro.classList.add("is-handoff");
    requestAnimationFrame(() => requestAnimationFrame(fly));
  };

  const film = () => {
    if (!video || !video.canPlayType || !logo) return classic();
    const mp4 = video.canPlayType('video/mp4; codecs="avc1.4D401F"');
    const webm = video.canPlayType('video/webm; codecs="vp9"');
    if (!mp4 && !webm) return classic();
    mode = "video";
    // the small script right after the <video> tag (index.html) has usually started the download already
    const kind = video.dataset.kind || (window.innerWidth >= window.innerHeight ? "landscape" : "portrait");
    let started = false;
    video.muted = true;
    video.setAttribute("muted", "");
    video.addEventListener("playing", () => { started = true; }, { once: true });
    video.addEventListener("ended", () => handoff(kind), { once: true });
    video.addEventListener("error", () => { if (!started) classic(); }, { once: true });
    if (!video.dataset.kind) {
      video.poster = `/assets/intro/intro-poster-${kind}.jpg`;
      video.src = `/assets/intro/intro-${kind}.${mp4 ? "mp4" : "webm"}`;
    } else if (video.error) return classic();
    intro.classList.add("has-video");
    const p = video.play();
    if (p && p.catch) p.catch(() => { if (!started) classic(); });
    // phones on mobile data can be slow: the poster (the film's first picture) shows meanwhile, and if the film
    // still hasn't started after 4 s the classic intro plays
    later(() => { if (!started) classic(); }, 4000);
    // and never block the page, whatever happens
    later(finish, 10000);
  };

  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => window.addEventListener(ev, finish, { once: true, passive: true }));
  intro.querySelector(".intro__skip").addEventListener("click", finish);
  if (params.get("introvideo") === "0") classic(); else film();
})();
