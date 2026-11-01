/*
 * Cibo Napoli: drawn placeholders, shown wherever there is no photo yet (hero, category tiles, dishes).
 * Plain inline SVG (no file to load), in the brand colours. ART.svg(name, extraClass) returns the markup.
 */
(function () {
  const C = {
    crust: "#e2a95b", crustDark: "#b8742f", sauce: "#c8312b", sauceDark: "#9e231f", cheese: "#fbf3df",
    basil: "#2f7d3c", basilLight: "#4a9a52", plate: "#ffffff", plateRim: "#efe6d3", pasta: "#f1cf74",
    pastaDark: "#d9ad48", cream: "#fffaf0", glass: "#dff1f5", choco: "#6b4226",
  };
  const leaf = (x, y, r, s = 1) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M0 0c6-9 18-10 24 0-6 10-18 9-24 0z" fill="${C.basil}"/><path d="M2 0h20" stroke="${C.basilLight}" stroke-width="1.4" stroke-linecap="round"/></g>`;
  const tomatoHalf = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><circle r="8" fill="${C.sauce}"/><circle r="5.5" fill="#e4574d"/><circle cx="-2" cy="-1" r="1" fill="${C.cheese}"/><circle cx="2" cy="1.5" r="1" fill="${C.cheese}"/></g>`;

  const pizza = () => `
    <defs><radialGradient id="crustG" cx="50%" cy="50%" r="50%"><stop offset="78%" stop-color="${C.crust}"/><stop offset="100%" stop-color="${C.crustDark}"/></radialGradient></defs>
    <circle cx="100" cy="100" r="92" fill="url(#crustG)"/>
    <g fill="${C.crustDark}" opacity=".55"><circle cx="40" cy="58" r="3"/><circle cx="158" cy="62" r="2.5"/><circle cx="150" cy="150" r="3.2"/><circle cx="52" cy="152" r="2.4"/><circle cx="100" cy="14" r="2"/><circle cx="186" cy="104" r="2"/></g>
    <path d="M100 22c40 0 76 32 78 76 2 44-34 80-78 80S22 146 22 100 58 22 100 22z" fill="${C.sauce}"/>
    <g fill="${C.cheese}">
      <path d="M70 52c12-6 26 2 24 14s-20 14-28 6-6-16 4-20z"/>
      <path d="M128 60c10-4 22 4 20 14s-16 12-24 6-6-16 4-20z"/>
      <path d="M56 104c12-4 24 6 20 16s-18 12-26 4-4-16 6-20z"/>
      <path d="M112 112c14-6 28 4 26 16s-22 14-30 6-6-16 4-22z"/>
      <path d="M90 146c10-4 22 4 18 12s-16 10-22 4-4-12 4-16z"/>
      <path d="M140 136c8-2 16 4 14 10s-12 8-16 4-4-12 2-14z"/>
    </g>
    ${tomatoHalf(102, 86, 0)}${tomatoHalf(76, 132, 30)}${tomatoHalf(150, 100, 60)}
    ${leaf(84, 70, -30, 1.1)}${leaf(120, 128, 20, 1.15)}${leaf(60, 92, 60, .9)}${leaf(132, 82, 120, .9)}`;

  const pasta = () => `
    <ellipse cx="100" cy="122" rx="90" ry="52" fill="${C.plateRim}"/>
    <ellipse cx="100" cy="116" rx="90" ry="52" fill="${C.plate}"/>
    <ellipse cx="100" cy="116" rx="62" ry="34" fill="#f6efe1"/>
    <g fill="none" stroke="${C.pasta}" stroke-width="7" stroke-linecap="round">
      <path d="M52 112c10-22 30-24 40-6s28 16 40-4 26-10 22 10"/>
      <path d="M48 124c14-14 28-10 38 2s30 12 42-6 24-6 26 6"/>
      <path d="M64 98c12-14 28-12 34 0s22 14 36-2"/>
    </g>
    <g fill="none" stroke="${C.pastaDark}" stroke-width="2" stroke-linecap="round" opacity=".6">
      <path d="M58 132c14-10 28-6 36 4s26 8 38-4"/>
    </g>
    <path d="M70 104c12-16 46-18 60-2 8 10-6 22-30 22s-40-8-30-20z" fill="${C.sauce}" opacity=".92"/>
    <g fill="${C.cheese}" opacity=".9"><circle cx="86" cy="104" r="3"/><circle cx="110" cy="100" r="2.5"/><circle cx="100" cy="112" r="2.2"/></g>
    ${leaf(96, 92, -40, 1.1)}${leaf(100, 92, 210, .9)}`;

  const ravioli = () => {
    const one = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-24" y="-24" width="48" height="48" rx="7" fill="${C.pasta}"/><rect x="-24" y="-24" width="48" height="48" rx="7" fill="none" stroke="${C.pastaDark}" stroke-width="5" stroke-dasharray="3 4"/><ellipse cx="0" cy="0" rx="13" ry="12" fill="#f7dc8f"/></g>`;
    return `
    <ellipse cx="100" cy="124" rx="90" ry="50" fill="${C.plateRim}"/>
    <ellipse cx="100" cy="118" rx="90" ry="50" fill="${C.plate}"/>
    ${one(70, 110, -12)}${one(128, 104, 10)}${one(100, 134, 4)}
    <path d="M58 132c20 8 64 10 88-2" stroke="${C.sauce}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>
    ${leaf(92, 86, -20, 1)}`;
  };

  const lasagna = () => `
    <ellipse cx="100" cy="150" rx="88" ry="30" fill="${C.plateRim}"/>
    <ellipse cx="100" cy="146" rx="88" ry="30" fill="${C.plate}"/>
    <g transform="translate(40 58)">
      <path d="M0 30l60-26 60 26v58l-60 26-60-26z" fill="${C.pasta}"/>
      <path d="M60 4l60 26-60 26L0 30z" fill="${C.cheese}"/>
      <g fill="${C.sauce}"><path d="M60 64l60-26v10l-60 26z"/><path d="M60 84l60-26v10l-60 26z"/><path d="M0 38l60 26v10L0 48z"/><path d="M0 58l60 26v10L0 68z"/></g>
      <g fill="#f4e1a6" opacity=".9"><path d="M60 56l60-26v6l-60 26z"/><path d="M0 30l60 26v6L0 36z"/></g>
      <g fill="${C.crustDark}" opacity=".5"><circle cx="40" cy="22" r="3"/><circle cx="74" cy="30" r="2.5"/><circle cx="88" cy="20" r="3"/></g>
      ${tomatoHalf(62, 22, 0)}${leaf(66, 18, -25, .9)}
    </g>`;

  const plate = () => `
    <rect x="16" y="56" width="168" height="112" rx="16" fill="${C.plateRim}"/>
    <rect x="16" y="50" width="168" height="112" rx="16" fill="${C.plate}"/>
    <ellipse cx="66" cy="104" rx="34" ry="24" fill="#c9883e"/>
    <ellipse cx="66" cy="102" rx="30" ry="20" fill="#dca159"/>
    <g fill="#b97a34" opacity=".55"><circle cx="54" cy="96" r="2.5"/><circle cx="72" cy="94" r="2"/><circle cx="64" cy="110" r="2.4"/><circle cx="80" cy="106" r="2"/></g>
    <g fill="#f5c84c" stroke="#e0aa2c" stroke-width="1.2">
      <rect x="128" y="70" width="9" height="60" rx="3" transform="rotate(14 132 100)"/>
      <rect x="142" y="72" width="9" height="58" rx="3" transform="rotate(-8 146 100)"/>
      <rect x="156" y="74" width="9" height="56" rx="3" transform="rotate(10 160 100)"/>
      <rect x="136" y="80" width="9" height="56" rx="3" transform="rotate(-18 140 108)"/>
    </g>
    <path d="M96 116c8-16 28-18 34-2 4 12-10 22-22 20s-16-8-12-18z" fill="${C.sauce}"/>
    <g fill="none" stroke="${C.pasta}" stroke-width="4" stroke-linecap="round"><path d="M100 120c6-8 14-8 18 0s10 6 12-2"/></g>
    ${leaf(58, 88, -30, .8)}`;

  const dessert = () => `
    <ellipse cx="100" cy="172" rx="62" ry="12" fill="${C.plateRim}"/>
    <path d="M58 40h84l-8 112c-1 10-10 18-20 18H86c-10 0-19-8-20-18z" fill="${C.glass}" opacity=".85"/>
    <path d="M64 92h72l-5 58c-1 8-8 14-16 14H85c-8 0-15-6-16-14z" fill="${C.cream}"/>
    <path d="M62 70h76l-2 26c-10 6-24 4-36 0s-26-6-36 0z" fill="${C.sauce}"/>
    <path d="M62 70h76" stroke="${C.sauceDark}" stroke-width="3"/>
    <circle cx="86" cy="62" r="9" fill="${C.sauce}"/><circle cx="83" cy="59" r="2" fill="#f08a80"/>
    <path d="M90 54c4-8 12-10 18-8-4 6-10 9-18 8z" fill="${C.basil}"/>
    <path d="M58 40h84" stroke="#bcdfe6" stroke-width="4" stroke-linecap="round"/>`;

  const drink = () => `
    <ellipse cx="100" cy="176" rx="50" ry="10" fill="${C.plateRim}"/>
    <path d="M62 50h76l-10 118c-1 6-6 10-12 10H84c-6 0-11-4-12-10z" fill="${C.glass}" opacity=".9"/>
    <path d="M66 82h68l-7 84c-1 5-5 8-10 8H83c-5 0-9-3-10-8z" fill="#7a2a1e" opacity=".88"/>
    <g fill="#fff" opacity=".7"><circle cx="88" cy="140" r="3"/><circle cx="108" cy="120" r="2.4"/><circle cx="98" cy="104" r="2"/><circle cx="114" cy="152" r="2.6"/></g>
    <rect x="84" y="94" width="16" height="14" rx="3" fill="#fff" opacity=".55" transform="rotate(-12 92 100)"/>
    <rect x="104" y="100" width="14" height="13" rx="3" fill="#fff" opacity=".5" transform="rotate(10 110 106)"/>
    <path d="M116 30l-14 120" stroke="${C.sauce}" stroke-width="6" stroke-linecap="round"/>
    <path d="M116 30l-14 120" stroke="#fff" stroke-width="2" stroke-dasharray="6 8" stroke-linecap="round"/>
    <circle cx="134" cy="56" r="14" fill="#f2c94c"/><circle cx="134" cy="56" r="10" fill="#f8de85"/>`;

  const ARTS = { pizza, pasta, ravioli, lasagna, plate, dessert, drink };

  window.ART = {
    svg(name, cls = "") {
      const draw = ARTS[name] || ARTS.pizza;
      return `<svg class="art ${cls}" viewBox="0 0 200 200" aria-hidden="true" focusable="false">${draw()}</svg>`;
    },
  };
})();
