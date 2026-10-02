// icons.js — the inline SVG icon set and the generated hero emblem. No imports beyond core.
//
// Unicode glyphs (◆ ▤ ✦ ❋ ☰) render differently on every platform, and some not at all, so the
// chrome draws its own icons. Everything is stroke-based on currentColor so it themes for free.

import { el } from "./core.js";

const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  hero: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m12 8 1.3 2.7 3 .4-2.2 2.1.5 3L12 14.8 9.4 16.2l.5-3-2.2-2.1 3-.4L12 8Z" fill="currentColor" stroke="none"/>',
  play: '<path d="M13.5 2.5 5 13.5h6l-1.5 8 8.5-11h-6l1.5-8Z" fill="currentColor"/>',
  solo: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>',
  combat: '<path d="M4 4l9 9M4 4v4M4 4h4"/><path d="M20 4l-9 9M20 4v4M20 4h-4"/><path d="M8 16l-3 3M16 16l3 3M9.5 14.5l-3 3M14.5 14.5l3 3"/>',
  journal: '<path d="M5 3.5h11.5A2.5 2.5 0 0 1 19 6v14.5H7.5A2.5 2.5 0 0 1 5 18V3.5Z"/><path d="M5 18a2.5 2.5 0 0 1 2.5-2.5H19"/><path d="M9 8h6M9 11h4"/>',
  more: '<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>',
  rules: '<path d="M4 5.5C6.5 4 9.5 4 12 5.5v14c-2.5-1.5-5.5-1.5-8 0v-14Z"/><path d="M12 5.5c2.5-1.5 5.5-1.5 8 0v14c-2.5-1.5-5.5-1.5-8 0"/>',
  npcs: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c2.9-.2 4.9 1.5 5.5 4.4"/>',
  gm: '<path d="M3 5h18v10H3z"/><path d="M8 19h8M12 15v4"/><path d="m7 9 2 2-2 2M11 13h4"/>',
  learn: '<path d="M2 9 12 4l10 5-10 5L2 9Z"/><path d="M6 11v5c3.5 2.5 8.5 2.5 12 0v-5"/><path d="M22 9v6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"/>',
  create: '<path d="M12 5v14M5 12h14"/>',
  die: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.3" cy="8.3" r="1.5" fill="currentColor"/><circle cx="15.7" cy="8.3" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="8.3" cy="15.7" r="1.5" fill="currentColor"/><circle cx="15.7" cy="15.7" r="1.5" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="1.3" fill="currentColor" stroke="none"/>',
  theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor"/>',
  oracle: '<path d="M12 2.5 14 9.5l7 2.5-7 2.5-2 7-2-7-7-2.5 7-2.5 2-7Z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  burst: '<path d="M12 1.5 14.3 8l6.7-2.4-3.9 5.9 5.4 3.6-6.8.4.9 6.9L12 17.6 7.4 22.4l.9-6.9-6.8-.4 5.4-3.6L3 5.6 9.7 8 12 1.5Z" fill="currentColor"/>',
};

/** An inline SVG icon. Decorative by default; label it with the surrounding control. */
export function icon(name, { size = 24, label = null } = {}) {
  const span = el("span", { class: `ico ico-${name}`, "aria-hidden": label ? null : "true", role: label ? "img" : null, "aria-label": label });
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.burst}</svg>`;
  return span;
}


/* ---------------------------------------------------------------- the hero emblem */

/** One colour per role, so a roster reads at a glance. Four-colour print plus its mixes. */
const ROLE_COLOURS = {
  Blaster: "#ff3d00", Brains: "#00a0e3", Brawn: "#d4006a", Controller: "#7a3cff",
  Defender: "#0067c5", Leader: "#ffd400", Striker: "#e50914", Wildcard: "#11a05a",
};

function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Initials for the emblem: the first letters of up to two words. */
function initials(name) {
  const words = String(name || "?").replace(/^the\s+/i, "").split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
}

/**
 * A deterministic chest emblem: a starburst in the role's colour, an ink ring and the hero's
 * initials. Used wherever a hero has no uploaded portrait; the same name always draws the same
 * badge, so a hero is recognisable across the roster, the header and the sheet.
 */
export function emblem(name, role, { portrait = null } = {}) {
  const wrap = el("span", { class: "emblem", "aria-hidden": "true" });
  if (portrait) {
    wrap.innerHTML = `<svg viewBox="0 0 100 100"><defs><clipPath id="pc"><circle cx="50" cy="50" r="44"/></clipPath></defs><image href="${String(portrait).replace(/"/g, "&quot;")}" x="6" y="6" width="88" height="88" clip-path="url(#pc)" preserveAspectRatio="xMidYMid slice"/><circle cx="50" cy="50" r="44" fill="none" stroke="#121018" stroke-width="5"/></svg>`;
    return wrap;
  }
  const h = hash(`${name}|${role}`);
  const fill = ROLE_COLOURS[role] || ["#ffd400", "#00a0e3", "#d4006a", "#11a05a"][h % 4];
  const points = 10 + (h % 4) * 2;
  const rot = (h >> 3) % 360;
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? 36 : 49;
    const a = (Math.PI * i) / points + (rot * Math.PI) / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  const ink = fill === "#ffd400" ? "#121018" : "#ffffff";
  const text = initials(name);
  const fs = text.length > 1 ? 34 : 44;
  wrap.innerHTML = `<svg viewBox="0 0 100 100">
    <polygon points="${pts.join(" ")}" fill="#121018" transform="translate(3 3)"/>
    <polygon points="${pts.join(" ")}" fill="${fill}" stroke="#121018" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="27" fill="${ink === "#ffffff" ? "#121018" : "#fffaee"}" stroke="#121018" stroke-width="3"/>
    <text x="50" y="51" text-anchor="middle" dominant-baseline="central" font-family="Bangers, Impact, sans-serif" font-size="${fs}" letter-spacing="1" fill="${ink === "#ffffff" ? fill : "#121018"}">${text.replace(/[<&>]/g, "")}</text>
  </svg>`;
  return wrap;
}
