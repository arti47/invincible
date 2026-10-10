// art.js — the app's own spot illustrations and data graphics, drawn as inline SVG.
//
// Original flat comic art only (no setting art, logos or characters — §11). Every piece is
// decorative (aria-hidden) unless it carries a number, in which case it is labelled by its caller
// and the same number is always also shown as text. Colours come from the theme tokens.

import { el } from "./core.js";

const wrap = (cls, svg, label = null) => {
  const s = el("span", { class: `art art-${cls}`, "aria-hidden": label ? null : "true", role: label ? "img" : null, "aria-label": label });
  s.innerHTML = svg;
  return s;
};

/** A night skyline: the backdrop for Home, Solo and the Action board. */
export function skyline() {
  const b = [[0, 70, 26], [24, 48, 22], [44, 82, 30], [72, 34, 20], [90, 60, 34], [122, 22, 18], [138, 52, 28], [164, 76, 24],
    [186, 40, 30], [214, 64, 22], [234, 28, 26], [258, 58, 32], [288, 44, 20], [306, 72, 28], [332, 36, 24], [354, 62, 22], [374, 50, 26]];
  const blocks = b.map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${120 - y}"/>`).join("");
  const windows = b.flatMap(([x, y, w], i) => Array.from({ length: Math.floor((120 - y - 10) / 12) }, (_, r) =>
    ((i + r) % 3 ? `<rect x="${x + 5}" y="${y + 8 + r * 12}" width="4" height="5"/>` : "") + ((i + r) % 2 ? `<rect x="${x + w - 9}" y="${y + 8 + r * 12}" width="4" height="5"/>` : ""))).join("");
  return wrap("skyline", `<svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice">
    <circle cx="330" cy="26" r="16" class="moon"/>
    <g class="towers">${blocks}<rect x="128" y="8" width="2" height="16"/><rect x="241" y="12" width="2" height="18"/></g>
    <g class="windows">${windows}</g></svg>`);
}

/** A caped hero standing tall, cape in the role colour. */
export function heroFigure(colour = "#ffd400") {
  return wrap("hero", `<svg viewBox="0 0 120 160">
    <path class="cape" fill="${colour}" d="M60 40C34 58 22 112 8 156h104C98 112 86 58 60 40Z"/>
    <g class="body">
      <circle cx="60" cy="27" r="14"/>
      <path d="M41 47q19-8 38 0l3 48-11 3-2 54H59l1-50-1 50H49l-2-54-11-3Z"/>
      <path d="M44 50 29 74l12 9 7-12M76 50l15 24-12 9-7-12"/>
    </g>
    <path class="crest" d="m60 56 6 8-6 8-6-8Z"/></svg>`);
}

/** An adversary's mask — the compendium and the board's foe side. */
export function villainMask() {
  return wrap("villain", `<svg viewBox="0 0 120 90">
    <path class="mask" d="M6 30C20 8 44 4 60 18 76 4 100 8 114 30c-4 30-22 50-40 50-8 0-12-8-14-14-2 6-6 14-14 14C28 80 10 60 6 30Z"/>
    <path class="eye" d="M24 36c8-6 20-6 26 4-8 6-20 6-26-4ZM96 36c-8-6-20-6-26 4 8 6 20 6 26-4Z"/>
    <path class="brow" d="M20 26l30 10M100 26 70 36"/></svg>`);
}

/** Headquarters: the team base. */
export function headquarters() {
  return wrap("base", `<svg viewBox="0 0 200 120">
    <path class="ground" d="M0 112h200v8H0z"/>
    <path class="hq" d="M30 112V60l40-20v72Zm40 0V40h60v72Zm60 0V64l40 16v32Z"/>
    <path class="dome" d="M78 40a22 22 0 0 1 44 0Z"/><path class="mast" d="M100 18v-14M94 10h12"/>
    <g class="lights"><rect x="84" y="56" width="10" height="8"/><rect x="106" y="56" width="10" height="8"/><rect x="84" y="76" width="10" height="8"/><rect x="106" y="76" width="10" height="8"/><rect x="42" y="72" width="8" height="8"/><rect x="146" y="88" width="8" height="8"/></g></svg>`);
}

/** A radar sweep: the encounter timer's picture. Blips show how close the enemy is. */
export function radar(blips = 0) {
  const pts = [[70, 46], [88, 74], [52, 82], [96, 52], [62, 60], [80, 92]].slice(0, Math.max(0, Math.min(6, blips)));
  return wrap("radar", `<svg viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="54" class="ring"/><circle cx="60" cy="60" r="36" class="ring"/><circle cx="60" cy="60" r="18" class="ring"/>
    <path d="M60 6v108M6 60h108" class="ring"/>
    <path d="M60 60 60 6A54 54 0 0 1 106 32Z" class="sweep"/>
    ${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" class="blip"/>`).join("")}</svg>`);
}

/**
 * The crisis level as a dial: three bands for the Ch.9 phases (0–3 low, 4–7 medium, 8–10 high)
 * and a needle on the current level. The level itself is always printed beside it.
 */
export function crisisDial(level, label) {
  const ang = (v) => Math.PI * (1 - v / 10);
  const pt = (v, r) => [100 + r * Math.cos(ang(v)), 100 - r * Math.sin(ang(v))];
  const arc = (a, b, cls) => {
    const [x1, y1] = pt(a, 80), [x2, y2] = pt(b, 80);
    return `<path class="band ${cls}" d="M${x1.toFixed(1)} ${y1.toFixed(1)}A80 80 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  };
  const ticks = Array.from({ length: 11 }, (_, v) => { const [a, b] = pt(v, 66), [c, d] = pt(v, 58); return `<path class="tick" d="M${a.toFixed(1)} ${b.toFixed(1)}L${c.toFixed(1)} ${d.toFixed(1)}"/>`; }).join("");
  const [nx, ny] = pt(Math.max(0, Math.min(10, level)), 70);
  return wrap("dial", `<svg viewBox="0 0 200 112">
    ${arc(0, 3.5, "low")}${arc(3.5, 7.5, "medium")}${arc(7.5, 10, "high")}${ticks}
    <path class="needle" d="M100 100L${nx.toFixed(1)} ${ny.toFixed(1)}"/><circle cx="100" cy="100" r="8" class="hub"/></svg>`, label);
}

/**
 * The six attributes as a hexagon: physical on the left half (magenta), mental on the right
 * (cyan), the hero's shape filled in yellow. Scores are always printed in the tiles beside it.
 */
export function attributeHex(scores, max = 12, label = null) {
  const keys = ["fighting", "agility", "strength", "reason", "intuition", "presence"];
  const short = ["FTG", "AGL", "STR", "RSN", "ITN", "PRS"];
  // FTG top-left, going round anticlockwise so physical sits left and mental right.
  const angles = [-120, 180, 120, 60, 0, -60].map((d) => (d * Math.PI) / 180);
  const at = (i, r) => [110 + r * Math.cos(angles[i]), 100 + r * Math.sin(angles[i])];
  const poly = (r) => angles.map((_, i) => at(i, r).map((n) => n.toFixed(1)).join(",")).join(" ");
  const grid = [0.25, 0.5, 0.75, 1].map((f) => `<polygon class="grid" points="${poly(78 * f)}"/>`).join("");
  const spokes = angles.map((_, i) => { const [x, y] = at(i, 78); return `<path class="spoke ${i < 3 ? "phys" : "ment"}" d="M110 100L${x.toFixed(1)} ${y.toFixed(1)}"/>`; }).join("");
  const shape = keys.map((k, i) => at(i, 78 * Math.max(0.06, Math.min(1, (scores[k] || 0) / max))).map((n) => n.toFixed(1)).join(",")).join(" ");
  const labels = keys.map((k, i) => { const [x, y] = at(i, 94); return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="${i < 3 ? "phys" : "ment"}">${short[i]} ${scores[k] ?? ""}</text>`; }).join("");
  return wrap("hex", `<svg viewBox="0 0 220 200">${grid}${spokes}<polygon class="shape" points="${shape}"/>${labels}</svg>`, label);
}

/** A crisis timer as a bomb whose fuse burns down rung by rung. */
export function bomb(stepsLeft, total) {
  const f = total ? Math.max(0, Math.min(1, stepsLeft / total)) : 0;
  const len = 6 + 46 * f;
  const ex = 58 + len * 0.72, ey = 26 - len * 0.5;
  return wrap("bomb", `<svg viewBox="0 0 120 100">
    <circle cx="46" cy="60" r="32" class="shell"/><path d="M32 46a16 16 0 0 1 12-8" class="shine"/>
    <rect x="50" y="22" width="16" height="12" rx="2" transform="rotate(30 58 28)" class="cap"/>
    <path d="M62 24Q${(58 + ex) / 2 + 6} ${(26 + ey) / 2 - 10} ${ex.toFixed(1)} ${ey.toFixed(1)}" class="fuse"/>
    <path d="M${ex.toFixed(1)} ${(ey - 8).toFixed(1)}l2 6 6-2-4 5 5 4-6 1 1 6-4-5-4 5 1-6-6-1 5-4-4-5 6 2Z" class="spark"/></svg>`);
}

/** An objective as a road: milestones from the start rung to the goal flag. */
export function road(done, total) {
  const n = Math.max(1, total);
  const x = (i) => 10 + (i * 180) / n;
  const y = (i) => 40 + (i % 2 ? -12 : 12);
  const path = Array.from({ length: n + 1 }, (_, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(i)}`).join(" ");
  const stops = Array.from({ length: n + 1 }, (_, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(i)}" r="${i === n ? 0 : 5}" class="stop ${i < done ? "done" : ""}"/>`).join("");
  const here = Math.max(0, Math.min(n, done));
  return wrap("road", `<svg viewBox="0 0 200 80">
    <path d="${path}" class="track"/>${stops}
    <path d="M${x(n).toFixed(1)} ${y(n)}v-26l16 7-16 7" class="flag"/>
    <circle cx="${x(here).toFixed(1)}" cy="${y(here)}" r="8" class="you"/></svg>`);
}

/** An ally group as a squad of tokens: one per status step left, the rest struck out. */
export function squad(left, total) {
  const n = Math.max(1, total);
  const w = 200 / n;
  const tokens = Array.from({ length: n }, (_, i) => {
    const cx = w * i + w / 2, on = i < left;
    return `<g class="tok ${on ? "on" : "off"}"><circle cx="${cx.toFixed(1)}" cy="24" r="9"/><path d="M${(cx - 14).toFixed(1)} 58c1-12 7-18 14-18s13 6 14 18Z"/>${on ? "" : `<path class="x" d="M${(cx - 12).toFixed(1)} 14l24 40M${(cx + 12).toFixed(1)} 14l-24 40"/>`}</g>`;
  }).join("");
  return wrap("squad", `<svg viewBox="0 0 200 62">${tokens}</svg>`);
}

/** Which scene an empty state on each route shows. */
export function sceneFor(route) {
  if (route === "combat" || route === "compendium" || route === "gm") return villainMask();
  if (route === "solo") return radar(2);
  return skyline();
}

/** Shattered glass radiating from an impact point — laid over a broken hero's header. */
export function shatter() {
  const cx = 150, cy = 46;
  const rays = [[0, -46], [60, -40], [130, 6], [80, 74], [10, 74], [-70, 74], [-150, 30], [-140, -30], [-60, -46]];
  const lines = rays.map(([dx, dy]) => `M${cx} ${cy}L${cx + dx} ${cy + dy}`).join("");
  const rings = [18, 38].map((r) => rays.map(([dx, dy], i) => {
    const k = r / Math.hypot(dx, dy); const [nx, ny] = rays[(i + 1) % rays.length]; const k2 = r / Math.hypot(nx, ny);
    return `M${(cx + dx * k).toFixed(1)} ${(cy + dy * k).toFixed(1)}L${(cx + nx * k2).toFixed(1)} ${(cy + ny * k2).toFixed(1)}`;
  }).join("")).join("");
  return wrap("shatter", `<svg viewBox="0 0 300 120" preserveAspectRatio="none"><path class="crack" d="${lines}${rings}"/><circle cx="${cx}" cy="${cy}" r="5" class="impact"/></svg>`);
}
