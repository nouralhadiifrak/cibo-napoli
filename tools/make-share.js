#!/usr/bin/env node
/*
 * Cibo Napoli: draws the share image (assets/share.jpg, 1200 x 630) shown when the site is shared on WhatsApp,
 * Facebook… Needs Playwright and Chromium.  node tools/make-share.js
 * Once the owner sends a real dish photo, this can be redone with the photo.
 */
const path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..");
const f = (p) => "file://" + path.join(root, p);
const html = `<!doctype html><html><head><style>
@font-face { font-family: P; src: url("${f("assets/fonts/pinyon-script-latin.woff2")}"); }
@font-face { font-family: PD; font-style: italic; src: url("${f("assets/fonts/playfair-display-italic-latin.woff2")}"); }
@font-face { font-family: D; src: url("${f("assets/fonts/dm-sans-latin.woff2")}"); }
html,body { margin:0; width:1200px; height:630px; }
body { position:relative; background: radial-gradient(circle at 50% 42%, #27703f, #1e5c34 50%, #143f24); color:#fff; font-family:D; overflow:hidden; }
.chk { position:absolute; left:0; right:0; height:36px; background-color:#fffdf8;
  background-image: linear-gradient(45deg,#1e5c34 25%,transparent 25%,transparent 75%,#1e5c34 75%), linear-gradient(45deg,#1e5c34 25%,transparent 25%,transparent 75%,#1e5c34 75%);
  background-size:36px 36px; background-position:0 0,18px 18px; }
.t { top:0 } .b { bottom:0 }
.c { position:absolute; top:36px; bottom:36px; left:0; right:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
img { width:720px; }
.tag { font-family:P; font-size:58px; margin-top:6px; }
.line { margin-top:18px; font-family:PD; font-style:italic; font-size:34px; color:#fbe9c9; }
.small { margin-top:10px; font-size:22px; letter-spacing:.12em; text-transform:uppercase; color:rgba(255,255,255,.8); }
</style></head><body><div class="chk t"></div><div class="c">
<img src="${f("assets/brand/logo-white-1200.png")}">
<div class="tag">La Buona Cucina Napolitana</div>
<div class="line">Le goût de l'Italie dans votre assiette</div>
<div class="small">Pizzeria napolitaine · El Mansouria</div>
</div><div class="chk b"></div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const tmp = path.join(require("os").tmpdir(), "cibo-share.html");
  require("fs").writeFileSync(tmp, html);
  await p.goto("file://" + tmp, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(root, "assets/share.jpg"), type: "jpeg", quality: 86 });
  await b.close();
  console.log("assets/share.jpg written");
})();
