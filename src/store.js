// store.js — local/cloud persistence for characters, the team, combat and the roll log,
// plus JSON export/import and the one-step undo stack used by lifecycle bundles.

import { STORAGE_PREFIX, uid, deepClone, clamp } from "./core.js";
import { normalizeCharacter, blankCharacter, maxHealth, maxResolve } from "./derived.js";
import * as R from "./rules.js";
import * as Journal from "./journal.js";
import { D } from "./rules.js";

const K = {
  characters: `${STORAGE_PREFIX}characters`,
  active: `${STORAGE_PREFIX}activeCharacter`,
  team: `${STORAGE_PREFIX}team`,
  rollLog: `${STORAGE_PREFIX}rollLog`,
  combat: `${STORAGE_PREFIX}combat`,
  tasks: `${STORAGE_PREFIX}tasks`,
  campaign: `${STORAGE_PREFIX}campaign`,
};

const ROLL_LOG_CAP = 100;

function read(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); }
  catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

const listeners = new Set();
export function onStoreChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(what) {
  for (const fn of listeners) { try { fn(what); } catch (e) { console.error(e); } }
  document.dispatchEvent(new CustomEvent("store-changed", { detail: { what } }));
}

/* ---------------------------------------------------------------- undo */

let undoStack = null;

export function snapshot(label) {
  undoStack = { label, at: Date.now(), characters: read(K.characters, []), team: read(K.team, null),
    combat: read(K.combat, null), tasks: read(K.tasks, []),
    journal: Journal.exportState(),   // the roll log lives here now
    solo: localStorage.getItem(`${STORAGE_PREFIX}solo`) };
}
export function canUndo() { return !!undoStack; }
export function undoLabel() { return undoStack?.label || null; }
export function undo() {
  if (!undoStack) return false;
  write(K.characters, undoStack.characters);
  if (undoStack.team) write(K.team, undoStack.team); else localStorage.removeItem(K.team);
  if (undoStack.combat) write(K.combat, undoStack.combat); else localStorage.removeItem(K.combat);
  write(K.tasks, undoStack.tasks || []);
  if (undoStack.journal) Journal.importState(undoStack.journal);
  if (undoStack.solo) localStorage.setItem(`${STORAGE_PREFIX}solo`, undoStack.solo);
  else localStorage.removeItem(`${STORAGE_PREFIX}solo`);
  undoStack = null;
  emit("undo");
  return true;
}
export function clearUndo() { undoStack = null; }

/* ---------------------------------------------------------------- characters */

export function listCharacters() { return read(K.characters, []).map(normalizeCharacter); }

export function getCharacter(id) { return listCharacters().find((c) => c.id === id) || null; }

export function activeCharacterId() { return read(K.active, null); }

export function activeCharacter() {
  const id = activeCharacterId();
  const list = listCharacters();
  return list.find((c) => c.id === id) || list[0] || null;
}

export function setActiveCharacter(id) { write(K.active, id); emit("active"); }

export function saveCharacter(character) {
  const c = normalizeCharacter(character);
  c.updatedAt = Date.now();
  const list = read(K.characters, []);
  const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) list[i] = c; else list.push(c);
  write(K.characters, list);
  if (!activeCharacterId()) write(K.active, c.id);
  emit("characters");
  return c;
}

export function deleteCharacter(id) {
  write(K.characters, read(K.characters, []).filter((c) => c.id !== id));
  if (activeCharacterId() === id) write(K.active, listCharacters()[0]?.id || null);
  emit("characters");
}

export function createCharacter(overrides) {
  const c = blankCharacter({ id: `char_${uid("")}`, ...overrides });
  c.state.health = maxHealth(c);
  c.state.resolve = maxResolve(c);
  return saveCharacter(c);
}

/** Mutate the active character through a callback and persist. */
export function updateCharacter(mutator, { id } = {}) {
  const c = id ? getCharacter(id) : activeCharacter();
  if (!c) return null;
  const next = deepClone(c);
  mutator(next);
  return saveCharacter(next);
}

export function setVital(kind, value, { id } = {}) {
  return updateCharacter((c) => {
    const max = kind === "health" ? maxHealth(c) : maxResolve(c);
    c.state[kind] = clamp(Math.round(value), 0, max);
    if (kind === "health") c.state.broken = c.state.health <= 0;
  }, { id });
}

/* ---------------------------------------------------------------- team (group entity) */

export function blankTeam() {
  return {
    id: uid("team"), name: "", purpose: "", background: "", rank: "global",
    base: { location: "", description: "", upgrades: [] },
    vehicle: null, karmaPool: 0, members: [],
    createdAt: Date.now(),
  };
}

export function getTeam() { return read(K.team, null); }
export function saveTeam(team) { write(K.team, team); emit("team"); return team; }
export function deleteTeam() { localStorage.removeItem(K.team); emit("team"); }

/** Base upgrade cost: 10 karma, or 20 when nobody meets a Resources/occupation prerequisite (Ch.7). */
export function baseUpgradeCost(upgradeName, characters = listCharacters()) {
  const up = D.BASE_UPGRADES.find((u) => u.name === upgradeName);
  if (!up) return D.KARMA.costs.baseUpgrade;
  if (!up.prereq) return D.KARMA.costs.baseUpgrade;
  const team = getTeam();
  const isUpgradePrereq = D.BASE_UPGRADES.some((u) => u.name === up.prereq);
  if (isUpgradePrereq) return D.KARMA.costs.baseUpgrade; // never buyable around; validity checked separately
  const resMatch = /Resources\s+(\d)/.exec(up.prereq);
  const needed = resMatch ? Number(resMatch[1]) : null;
  const occupations = up.prereq.replace(/Resources\s+\d,?\s*/i, "").split(/,| or /).map((s) => s.trim()).filter(Boolean);
  const met = characters.some((c) => {
    const res = R.D ? undefined : undefined;
    const rating = c.identity?.resourcesBase ?? (R.findOccupation(c.identity?.occupation)?.resources || 0);
    if (needed && rating >= needed) return true;
    return occupations.some((o) => o && c.identity?.occupation === o);
  });
  void team;
  return met ? D.KARMA.costs.baseUpgrade : D.KARMA.costs.baseUpgradeNoPrereq;
}

export function upgradePrereqSatisfied(upgradeName) {
  const up = D.BASE_UPGRADES.find((u) => u.name === upgradeName);
  const team = getTeam();
  if (!up || !up.prereq || !team) return true;
  const isUpgradePrereq = D.BASE_UPGRADES.some((u) => u.name === up.prereq);
  if (!isUpgradePrereq) return true;
  return (team.base.upgrades || []).some((u) => u.name === up.prereq);
}

/* ---------------------------------------------------------------- karma (audit A14) */

export function karmaSpend(character, { kind, label, cost }) {
  const state = character.state;
  if (!state.session.spendUnlocked) {
    return { ok: false, reason: "Karma is spent only between sessions, in a safe location. End the session first." };
  }
  if (state.karma < cost) return { ok: false, reason: `Not enough karma: ${label} costs ${cost}, you have ${state.karma}.` };
  state.karma -= cost;
  character.advancementLog.push({ at: Date.now(), kind, label, cost });
  return { ok: true };
}

/** Training discount from the team base (Ch.7): 1/10 or 2/10 off personal improvements only. */
export function trainingDiscount() {
  const team = getTeam();
  const names = (team?.base?.upgrades || []).map((u) => u.name);
  if (names.includes("Training Simulator")) return D.KARMA.trainingDiscount.simulator;
  if (names.includes("Training Facilities")) return D.KARMA.trainingDiscount.facilities;
  return 0;
}

export function discountedCost(cost, { personal = true, trained = false } = {}) {
  if (!personal || !trained) return cost;
  const d = trainingDiscount();
  return d ? Math.round(cost * (1 - d)) : cost;
}

/* ---------------------------------------------------------------- roll log */

/**
 * The roll log is a view over the journal's dice entries — one timeline is the record (§6.1).
 * The shape callers already expect is reconstructed from each entry's detail.
 */
export function rollLog() {
  return Journal.entries({ kinds: ["roll"] }).map((e) => ({ id: e.id, ts: e.at, ...(e.detail || {}) }));
}

export function pushRollLog(entry) {
  const label = entry.label || "Roll";
  const faces = (entry.dice || []).join(" ");
  Journal.record({
    kind: "roll",
    text: `${label}${faces ? ` — ${faces}` : ""}${entry.outcome ? ` · ${entry.outcome}` : ""}`,
    detail: entry,
    characterId: entry.by || null,
  });
  emit("rollLog");
  return entry;
}

export function clearRollLog() {
  const j = Journal.load();
  j.entries = j.entries.filter((e) => e.kind !== "roll" || e.note);
  Journal.save(j);
  emit("rollLog");
}

/* ---------------------------------------------------------------- combat & tasks */

export function getCombat() { return read(K.combat, null); }
export function saveCombat(combat) { write(K.combat, combat); emit("combat"); return combat; }
export function clearCombat() { localStorage.removeItem(K.combat); emit("combat"); }

/**
 * Wipe everything the current mission produced — the action scene, challenges, the solo crisis
 * board, the roll log — and reset each hero's session and scene flags. Heroes, the team and their
 * karma survive: this clears the mission, not the campaign.
 */
export function wipeMissionData() {
  const cleared = {
    combat: !!read(K.combat, null),
    tasks: read(K.tasks, []).length,
    rollLog: rollLog().length,
    solo: !!localStorage.getItem(`${STORAGE_PREFIX}solo`),
    heroes: listCharacters().length,
  };
  snapshot("Wipe mission data");
  localStorage.removeItem(K.combat);
  localStorage.removeItem(K.tasks);
  localStorage.removeItem(`${STORAGE_PREFIX}solo`);
  // Clears the mission, not the campaign record: written and annotated journal entries survive.
  clearRollLog();
  const chars = listCharacters().map((c) => {
    c.state.scene = { wreckedZones: [], usedOncePerScene: [], energyDice: 0, barriers: [] };
    c.state.session = { ...c.state.session, karmaAnswers: {}, badKarmaAnswers: {}, wreckedZones: [], stage: "idle", spendUnlocked: true };
    c.state.conditions = {};
    c.updatedAt = Date.now();
    return c;
  });
  write(K.characters, chars);
  emit("wipe");
  return cleared;
}

export function getTasks() { return read(K.tasks, []); }
export function saveTasks(tasks) { write(K.tasks, tasks); emit("tasks"); return tasks; }

/* ---------------------------------------------------------------- campaign handle */

export function getCampaign() { return read(K.campaign, null); }
export function saveCampaign(c) { write(K.campaign, c); emit("campaign"); return c; }
export function clearCampaign() { localStorage.removeItem(K.campaign); emit("campaign"); }

/* ---------------------------------------------------------------- export / import */

export function exportBackup() {
  return {
    app: "invincible-player",
    version: 1,
    exportedAt: new Date().toISOString(),
    characters: read(K.characters, []),
    activeCharacter: read(K.active, null),
    team: read(K.team, null),
    rollLog: read(K.rollLog, []),
    tasks: read(K.tasks, []),
    combat: read(K.combat, null),
    journal: Journal.exportState(),
  };
}

export function exportBackupString() { return JSON.stringify(exportBackup(), null, 2); }

export function importBackup(json, { merge = false } = {}) {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  if (!data || data.app !== "invincible-player") throw new Error("This file is not an Invincible Player backup.");
  const incoming = (data.characters || []).map(normalizeCharacter);
  if (merge) {
    const existing = listCharacters();
    const byId = new Map(existing.map((c) => [c.id, c]));
    for (const c of incoming) byId.set(c.id, c);
    write(K.characters, Array.from(byId.values()));
  } else {
    write(K.characters, incoming);
    if (data.team !== undefined) { if (data.team) write(K.team, data.team); else localStorage.removeItem(K.team); }
    if (data.journal) Journal.importState(data.journal);
    else if (data.rollLog) write(K.rollLog, data.rollLog);   // pre-journal backup
    if (data.tasks) write(K.tasks, data.tasks);
    if (data.combat) write(K.combat, data.combat); else localStorage.removeItem(K.combat);
  }
  if (data.activeCharacter) write(K.active, data.activeCharacter);
  else if (incoming[0]) write(K.active, incoming[0].id);
  emit("import");
  return incoming.length;
}

export const STORAGE_KEYS = K;
