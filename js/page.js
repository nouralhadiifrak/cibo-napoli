/* Cibo Napoli: text pages. French by default, English at ?lang=en (the page holds both). */
(function () {
  const en = new URLSearchParams(location.search).get("lang") === "en";
  document.documentElement.lang = en ? "en" : "fr";
  const tt = document.querySelector('[data-title-' + (en ? "en" : "fr") + ']');
  if (tt) document.title = tt.getAttribute("data-title-" + (en ? "en" : "fr"));
  document.querySelectorAll("[data-lang-link]").forEach((a) => {
    a.href = location.pathname + (a.dataset.langLink === "en" ? "?lang=en" : "");
    a.setAttribute("aria-current", (a.dataset.langLink === "en") === en ? "true" : "false");
  });
  if (en) document.querySelectorAll("a[data-keep-lang]").forEach((a) => { const h = a.getAttribute("href"); a.setAttribute("href", h + (h.includes("?") ? "&" : "?") + "lang=en"); });
})();
