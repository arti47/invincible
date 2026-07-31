// settings.js — feature/content toggles. Off by default; explicit choice beats defaults.

import { STORAGE_PREFIX } from "./core.js";

const KEY = (k) => `${STORAGE_PREFIX}setting:${k}`;

function read(k) {
  try { const v = localStorage.getItem(KEY(k)); return v === null ? undefined : JSON.parse(v); }
  catch { return undefined; }
}
function write(k, v) {
  try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch { /* storage unavailable */ }
}

export const TOGGLES = [
  { key: "gmScreen", name: "GM screen", desc: "Adds a GM tab with a party panel, adversary drop-ins and every rollable table." },
  { key: "soloMode", name: "Solo play (Crisis Mode)", desc: "Adds the Crisis Mode assistant: event checks, response engines and all four timer types." },
  { key: "familyFriendly", name: "Family-friendly critical injuries", desc: "Treats every critical injury result of 9 or higher as Cracked skull — an option offered by the rulebook." },
  { key: "manualDice", name: "Manual dice entry", desc: "Lets you type the faces you rolled with physical dice instead of rolling digitally." },
  { key: "advancedAutomation", name: "Advanced automation", desc: "Auto-applies fire intensity, ongoing conditions and per-scene flags during combat." },
];

export const Settings = {
  get(k) { return read(k); },
  set(k, v) { write(k, v); document.dispatchEvent(new CustomEvent("settings-changed", { detail: { key: k, value: v } })); },
  toggle(k) { const next = !this.enabled(k); this.set(k, next); return next; },
  enabled(k) { return read(k) === true; },
  isSet(k) { return read(k) !== undefined; },

  gmScreen() { return this.enabled("gmScreen"); },
  soloMode() { return this.enabled("soloMode"); },
  familyFriendly() { return this.enabled("familyFriendly"); },
  manualDice() { return this.enabled("manualDice"); },
  advancedAutomation() { return this.enabled("advancedAutomation"); },

  // Theme: "system" (default) | "light" | "dark"
  theme() { return read("theme") || "system"; },
  setTheme(t) {
    write("theme", t);
    applyTheme();
    document.dispatchEvent(new CustomEvent("settings-changed", { detail: { key: "theme", value: t } }));
  },
};

export function applyTheme() {
  const t = Settings.theme();
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}
