// core.js — constants, DOM helpers and raw dice. No imports.

export const SUCCESS = 6;
export const BANE = 1;
export const SCHEMA_VERSION = 1;
export const STORAGE_PREFIX = "invincible:";

/* ---------------------------------------------------------------- DOM helpers */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

/* ---------------------------------------------------------------- utils */

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const ceilHalf = (n) => Math.ceil(n / 2);
export const uid = (p = "id") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const titleCase = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());
export const deepClone = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------------------------------------------------------------- dice */

export function d6() { return 1 + Math.floor(Math.random() * 6); }
export function d3() { return Math.ceil(d6() / 2); }
export function roll2d6() { return d6() + d6(); }
export function d66() { return d6() * 10 + d6(); }

/** Roll a dice pool. Returns the individual faces. Pool never drops below 1 (audit A1). */
export function pool(n) {
  const size = Math.max(1, Math.floor(n) || 0);
  return Array.from({ length: size }, () => d6());
}

export const countSixes = (dice) => dice.filter((d) => d === SUCCESS).length;
export const countOnes = (dice) => dice.filter((d) => d === BANE).length;

/** Roll on a table of { range:[lo,hi], ... } entries. */
export function tableLookup(entries, value) {
  return entries.find((e) => value >= e.range[0] && value <= e.range[1]) || null;
}

/** Roll a D66 table, re-rolling values that fall in a documented gap. */
export function rollTable(table, tries = 12) {
  const entries = table.entries || table;
  const die = table.die || "D66";
  for (let i = 0; i < tries; i++) {
    const value = die === "D6" ? d6() : die === "2D6" ? roll2d6() : d66();
    const hit = tableLookup(entries, value);
    if (hit) return { value, entry: hit };
  }
  const fallback = entries[0];
  return { value: fallback.range[0], entry: fallback };
}

/* ---------------------------------------------------------------- formatting */

export const dieFace = (v) => (v === SUCCESS ? "★" : v === BANE ? "✖" : String(v));
export const signed = (n) => (n >= 0 ? `+${n}` : String(n));
export function plural(n, one, many) { return `${n} ${n === 1 ? one : many || one + "s"}`; }
export function fmtRange(r) {
  if (!r) return "—";
  if (typeof r === "string") return r;
  return `${r[0]}/${r[1]}`;
}
