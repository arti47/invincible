// rules.js — pure lookups over the data libraries. No DOM, no state.

import * as D from "../data.js";
import { NPC_PROFILES, CREATURES } from "../data-npcs.js";
import { ADVERSARIES } from "../data-monsters.js";
import { PREGENS } from "../data-pregens.js";
import { tableLookup, d6, d66, roll2d6 } from "./core.js";

export { D };

const norm = (s) => String(s || "").trim().toLowerCase();

/* ---------------------------------------------------------------- powers */

/** Parse "Major PROTECTION (Armor 3)" / "BLAST: Burst Effect" style strings into a structured pick. */
export function parsePowerRef(str) {
  const raw = String(str).trim();
  const boostMatch = raw.match(/^(.+?):\s*(.+)$/);
  if (boostMatch && findPower(boostMatch[1])) {
    return { name: findPower(boostMatch[1]).name, level: 0, boost: boostMatch[2].trim() };
  }
  const levelMatch = raw.match(/^(Major|Massive|Monstrous)\s+(.*)$/i);
  let level = 0, rest = raw;
  if (levelMatch) { level = D.POWER_LEVELS.findIndex((l) => norm(l) === norm(levelMatch[1])); rest = levelMatch[2]; }
  const paren = rest.match(/^(.*?)\s*\((.*)\)\s*$/);
  let note = null;
  if (paren) { rest = paren[1]; note = paren[2]; }
  const inlineLevel = note && /^(Major|Massive|Monstrous)$/i.test(note);
  if (inlineLevel) { level = D.POWER_LEVELS.findIndex((l) => norm(l) === norm(note)); note = null; }
  const power = findPower(rest);
  return power ? { name: power.name, level, note } : { name: rest.trim(), level, note, unknown: true };
}

export function findPower(name) {
  const n = norm(name).replace(/\(s\)/g, "");
  return D.POWERS.find((p) => norm(p.name) === norm(name))
    || D.POWERS.find((p) => norm(p.name).replace(/\(s\)/g, "") === n)
    || D.POWERS.find((p) => norm(p.name).startsWith(n) && n.length > 3)
    || null;
}

export function powerLevelName(index) { return D.POWER_LEVELS[index] || "basic"; }

export function powerDisplayName(entry) {
  const lvl = entry.level ? `${D.POWER_LEVELS[entry.level]} ` : "";
  return `${lvl}${entry.name}`;
}

/** Value of a per-level field (damage, armor, move…) for a power entry. */
export function powerValue(power, field, level = 0) {
  if (!power || power[field] === undefined) return undefined;
  const v = power[field];
  if (Array.isArray(v)) return v[Math.min(level, v.length - 1)];
  return v;
}

export function powerAttribute(power, preferred) {
  if (!power) return "presence";
  if (power.rollAttr) return power.rollAttr;
  if (power.attack === "slugfest") return "fighting";
  if (power.attack === "shooting") return "agility";
  const type = D.POWER_TYPES[power.type];
  if (!type) return "presence";
  if (preferred && type.attr.includes(preferred)) return preferred;
  return type.attr[0];
}

export function powersByType() {
  const out = {};
  for (const t of Object.keys(D.POWER_TYPES)) out[t] = D.POWERS.filter((p) => p.type === t);
  return out;
}

/* ---------------------------------------------------------------- talents & drawbacks */

export function findTalent(name) {
  const clean = String(name || "").replace(/\s*\(.*\)\s*$/, "").replace(/\s*×\s*\d+$/, "").trim();
  const alias = D.TALENT_ALIASES[clean] || clean;
  return D.TALENTS.find((t) => norm(t.name) === norm(alias)) || null;
}

export function talentSubject(name) {
  const m = String(name || "").match(/\((.+)\)/);
  return m ? m[1] : null;
}

export function talentRanks(talents, name) {
  return (talents || []).filter((t) => norm(t.name) === norm(name)).reduce((a, t) => a + (t.rank || 1), 0);
}

export function hasTalent(character, name) {
  return (character?.talents || []).some((t) => norm(findTalent(t.name)?.name || t.name) === norm(name));
}

export function findDrawback(name) {
  const clean = String(name || "").replace(/\s*\(.*\)\s*$/, "").trim();
  return D.DRAWBACKS.find((d) => norm(d.name) === norm(clean)) || null;
}

export function hasDrawback(character, name) {
  return (character?.drawbacks || []).some((d) => norm(d.name) === norm(name));
}

/* ---------------------------------------------------------------- creation lookups */

export const findRank = (key) => D.RANKS.find((r) => r.key === key) || D.RANKS.find((r) => r.default);
export const findArchetype = (name) => D.ARCHETYPES.find((a) => norm(a.name) === norm(name)) || null;
export const findOccupation = (name) => D.OCCUPATIONS.find((o) => norm(o.name) === norm(name)) || null;

/* ---------------------------------------------------------------- gear */

export function findGear(name) {
  const n = norm(name);
  return D.WEAPONS.find((w) => norm(w.name) === n)
    || D.BODY_ARMOR.find((a) => norm(a.name) === n)
    || D.GENERAL_GEAR.find((g) => norm(g.name) === n)
    || D.VEHICLES.find((v) => norm(v.name) === n)
    || D.VEHICLE_WEAPONS.find((v) => norm(v.name) === n)
    || null;
}

export function allGear() {
  return [
    ...D.WEAPONS.map((w) => ({ ...w, category: "Weapon" })),
    ...D.BODY_ARMOR.map((a) => ({ ...a, category: "Armor" })),
    ...D.GENERAL_GEAR.map((g) => ({ ...g, category: "Gear" })),
    ...D.VEHICLES.map((v) => ({ ...v, category: "Vehicle" })),
    ...D.VEHICLE_WEAPONS.map((v) => ({ ...v, category: "Vehicle weapon" })),
  ];
}

/**
 * Purchase legality (Ch.4). Returns the required procedure — the roll itself lives in roller.js.
 * Audit A13.
 */
export function purchaseCheck({ resources, cost, restricted, streetwise, loan = 0 }) {
  if (restricted && !streetwise) {
    return { allowed: false, mode: "restricted", reason: "Restricted items cannot be purchased at any Resources score without the Streetwise talent." };
  }
  if (loan > 0) {
    if (resources <= 1) return { allowed: false, mode: "noLoan", reason: "Heroes with Resources 1 cannot get loans at all." };
    if (resources <= 3 && !streetwise) return { allowed: false, mode: "noLoan", reason: "Heroes with Resources 2-3 need the Streetwise talent to get a loan." };
  }
  const effective = resources + loan;
  if (effective > cost) return { allowed: true, mode: "automatic", reason: "Your Resources exceed the Cost — the purchase succeeds automatically." };
  if (effective === cost) return { allowed: true, mode: "roll", dice: effective, reason: "Roll dice equal to your Resources and score at least one 6. This roll cannot be pushed." };
  return { allowed: false, mode: "unaffordable", reason: "Your Resources are lower than the Cost. You need a loan (+1 or +2 Cost) to attempt this." };
}

/* ---------------------------------------------------------------- tables */

export function rollNamedTable(table) {
  const die = table.die || "D66";
  for (let i = 0; i < 20; i++) {
    const value = die === "D6" ? d6() : die === "2D6" ? roll2d6() : d66();
    const entry = tableLookup(table.entries, value);
    if (entry) return { value, entry, table };
  }
  return { value: null, entry: table.entries[0], table };
}

export function gmTableList() {
  return Object.entries(D.GM_TABLES).map(([key, t]) => ({ key, ...t }));
}

/* ---------------------------------------------------------------- compendium */

export function compendium() {
  return [
    ...NPC_PROFILES.map((n) => ({ ...n, group: n.minion ? "Minions" : "NPC profiles", source: "Ch.6" })),
    ...CREATURES.map((c) => ({ ...c, group: "Creatures", source: "Ch.6" })),
    ...ADVERSARIES.map((a) => ({ ...a, group: a.side === "ally" ? "Allies" : "Adversaries", source: "Ch.8" })),
    ...PREGENS.map((p) => ({ ...p, group: "Heroes", source: "Ch.8", hero: true })),
  ];
}

export { NPC_PROFILES, CREATURES, ADVERSARIES, PREGENS };

/* ---------------------------------------------------------------- rules library */

export function rulesEntry(id) { return D.RULES_LIBRARY.find((r) => r.id === id) || null; }

export function searchRules(query) {
  const q = norm(query);
  if (!q) return D.RULES_LIBRARY;
  return D.RULES_LIBRARY.filter((r) =>
    norm(r.title).includes(q) || norm(r.body).includes(q) || (r.tags || []).some((t) => norm(t).includes(q)));
}

export function findCondition(key) { return D.CONDITIONS.find((c) => c.key === key) || null; }

export function critEntry(rollValue, familyFriendly = false) {
  let v = Math.max(1, rollValue);
  if (familyFriendly && v > 9) v = 9;
  if (v >= 12) return D.CRITICAL_INJURIES[11];
  return D.CRITICAL_INJURIES[v - 1];
}
