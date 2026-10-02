// icons.js — the inline SVG icon set and the generated hero emblem. No imports beyond core.
//
// Unicode glyphs (◆ ▤ ✦ ❋ ☰) render differently on every platform, and some not at all, so the
// chrome draws its own icons. Everything is stroke-based on currentColor so it themes for free.

import { el } from "./core.js";

const P = {
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  map: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20Z"/><path d="M9 4v13.5M15 6.5V20"/>',
  hazard: '<path d="M12 3 22 20H2L12 3Z"/><path d="M12 10v5"/><circle cx="12" cy="17.6" r="1.1" fill="currentColor"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/>',
  log: '<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  // power types (Ch.3)
  attack: '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V10m0-1V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5V6.5a1.5 1.5 0 0 1 3 0V12c0 4-2.5 7-6 7-2.7 0-4.4-1.5-5.3-3.4L3.4 12.4a1.5 1.5 0 0 1 2.6-1.5L7 12.5"/>',
  control: '<path d="M12 12a2 2 0 1 0 2 2 4 4 0 1 0-4-4 6 6 0 1 0 6 6"/><path d="M19 4l-2.5 2.5M21 9h-3"/>',
  defense: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="M12 7v10M8 11h8"/>',
  modification: '<path d="M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12s10 3 10 6"/><path d="M8.5 7h7M8.5 17h7"/>',
  movement: '<path d="M3 12h11M3 7h7M3 17h7"/><path d="m14 6 7 6-7 6Z" fill="currentColor"/>',
  sensory: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  // conditions (Ch.3/4)
  stunned: '<circle cx="12" cy="14" r="5"/><path d="m5 4 .7 1.5L7.3 6l-1.6.6L5 8l-.6-1.4L3 6l1.4-.5L5 4Zm7-2 .7 1.5 1.6.5-1.6.6L12 6l-.6-1.4L10 4l1.4-.5L12 2Zm7 2 .7 1.5 1.6.5-1.6.6L19 8l-.6-1.4L17 6l1.4-.5L19 4Z" fill="currentColor"/>',
  afflicted: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/><path d="M9.5 14.5h5M12 12v5"/>',
  immobilised: '<rect x="3" y="9" width="8" height="6" rx="3"/><rect x="13" y="9" width="8" height="6" rx="3"/><path d="M9 12h6"/>',
  onFire: '<path d="M12 21c-4 0-6.5-2.7-6.5-6.3 0-3.7 3.3-5.8 4-9.7 2.6 1.6 3.7 3.9 3.5 6 .9-.6 1.6-1.6 1.8-2.8 2 1.8 3.7 4.2 3.7 6.6 0 3.5-2.6 6.2-6.5 6.2Z"/>',
  blinded: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><path d="M4 20 20 4"/>',
  controlled: '<path d="M12 12m-1 0a1 1 0 1 0 2 0 3 3 0 1 0-6 0 5 5 0 1 0 10 0 7 7 0 1 0-14 0"/>',
  darkness: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" fill="currentColor"/>',
  storm: '<path d="M7 16a4.5 4.5 0 1 1 1-8.9A5.5 5.5 0 0 1 18.5 9 3.5 3.5 0 0 1 18 16"/><path d="m13 12-3 5h4l-2 4" />',
  lowGravity: '<circle cx="12" cy="15" r="3"/><path d="M12 10V3m-3 3 3-3 3 3"/>',
  highGravity: '<circle cx="12" cy="7" r="3"/><path d="M12 12v9m-3-3 3 3 3-3"/>',
  // compendium groups
  minions: '<circle cx="6" cy="8" r="2.4"/><circle cx="12" cy="7" r="2.4"/><circle cx="18" cy="8" r="2.4"/><path d="M2 18c.4-2.8 2-4.3 4-4.3s3.6 1.5 4 4.3M8 17c.4-2.8 2-4.3 4-4.3s3.6 1.5 4 4.3M14 18c.4-2.8 2-4.3 4-4.3s3.6 1.5 4 4.3"/>',
  creature: '<circle cx="6" cy="9" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="14" cy="5.5" r="2"/><circle cx="18" cy="9" r="2"/><path d="M12 11c3 0 6 4.5 6 7 0 2-1.6 2.6-3 2.2-1.2-.3-2-.9-3-.9s-1.8.6-3 .9c-1.4.4-3-.2-3-2.2 0-2.5 3-7 6-7Z"/>',
  adversary: '<path d="M12 3c-4.4 0-8 3.2-8 7.5 0 2.5 1.2 4.5 3 5.8V20h10v-3.7c1.8-1.3 3-3.3 3-5.8C20 6.2 16.4 3 12 3Z"/><circle cx="9" cy="11" r="1.8" fill="currentColor"/><circle cx="15" cy="11" r="1.8" fill="currentColor"/><path d="M10 20v-2.5M14 20v-2.5"/>',
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
/** Which icon stands for a power type, a condition key or a compendium group. */
const ALIAS = { "NPC profiles": "npcs", Minions: "minions", Creatures: "creature", Adversaries: "adversary", Allies: "hero", Heroes: "hero", Hero: "hero" };
export function iconFor(key) {
  if (!key) return null;
  const k = ALIAS[key] || String(key).charAt(0).toLowerCase() + String(key).slice(1);
  return P[k] ? k : null;
}

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
