// journal.js — the campaign record. One timeline per hero: dice rolls, solo engine results and
// lifecycle events flow in automatically, and the player writes alongside them.
//
// This is the store the roll log and the solo crisis log became. `store.rollLog()` is now a view
// over the journal's dice entries, so nothing that already wrote a roll had to change.

import { STORAGE_PREFIX, uid, deepClone } from "./core.js";

const KEY = `${STORAGE_PREFIX}journal`;

/** Routine dice are the only thing that prunes, and never if they carry a note. */
const DICE_CAP = 2000;

export const KINDS = {
  note: { name: "Written", icon: "✎" },
  roll: { name: "Dice", icon: "⚄" },
  solo: { name: "Solo", icon: "◉" },
  lifecycle: { name: "Scene", icon: "❋" },
  state: { name: "Hero", icon: "◆" },
};

function blank() { return { sessions: [], entries: [], schema: 1 }; }

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw || typeof raw !== "object") return blank();
    return { ...blank(), ...raw, sessions: raw.sessions || [], entries: raw.entries || [] };
  } catch { return blank(); }
}

function write(j) {
  try { localStorage.setItem(KEY, JSON.stringify(j)); } catch { /* quota — the prune below guards it */ }
  document.dispatchEvent(new CustomEvent("journal-changed"));
  return j;
}

export function load() { return read(); }
export function save(j) { return write(j); }
export function clearAll() { write(blank()); }

/* ---------------------------------------------------------------- sessions */

/** The session entries currently collect under, if one is open. */
export function openSession(j = read()) {
  return j.sessions.find((s) => !s.endedAt) || null;
}

export function startSession(title, characterId) {
  const j = read();
  const existing = openSession(j);
  if (existing) return existing;
  const s = { id: uid("sess"), title: title || "", characterId: characterId || null,
    startedAt: Date.now(), endedAt: null };
  j.sessions.push(s);
  write(j);
  return s;
}

export function endSession() {
  const j = read();
  const s = openSession(j);
  if (!s) return null;
  s.endedAt = Date.now();
  write(j);
  return s;
}

export function retitleSession(id, title) {
  const j = read();
  const s = j.sessions.find((x) => x.id === id);
  if (!s) return false;
  s.title = title;
  write(j);
  return true;
}

/** A session's default name when the player has not given it one. */
export function sessionTitle(s, index) {
  if (s.title) return s.title;
  const d = new Date(s.startedAt);
  return `Session ${index} — ${d.toLocaleDateString()}`;
}

/* ---------------------------------------------------------------- entries */

/**
 * Append one entry. Everything that happens in play comes through here, so the timeline is the
 * single source of truth rather than one of several parallel logs.
 */
export function record({ kind = "note", text = "", detail = null, characterId = null, at = Date.now() } = {}) {
  const j = read();
  const session = openSession(j);
  const entry = {
    id: uid("jr"), at, kind, text: String(text || ""), detail: detail ? deepClone(detail) : null,
    sessionId: session ? session.id : null,
    characterId: characterId || session?.characterId || null,
    note: "",
  };
  j.entries.push(entry);
  prune(j);
  write(j);
  return entry;
}

export function addNote(text, characterId = null) {
  return record({ kind: "note", text, characterId });
}

/** Attach the player's own words to an automatic entry — "this is where it went wrong". */
export function annotate(id, note) {
  const j = read();
  const e = j.entries.find((x) => x.id === id);
  if (!e) return false;
  e.note = String(note || "");
  write(j);
  return true;
}

export function editEntry(id, text) {
  const j = read();
  const e = j.entries.find((x) => x.id === id);
  if (!e) return false;
  e.text = String(text || "");
  write(j);
  return true;
}

export function removeEntry(id) {
  const j = read();
  const before = j.entries.length;
  j.entries = j.entries.filter((x) => x.id !== id);
  if (j.entries.length === before) return false;
  write(j);
  return true;
}

/**
 * Written entries, session boundaries and anything annotated are kept forever. Only routine dice
 * prune, and only past a generous cap, so a long campaign cannot fill localStorage.
 */
export function prune(j) {
  const dice = j.entries.filter((e) => e.kind === "roll" && !e.note);
  if (dice.length <= DICE_CAP) return j;
  const drop = new Set(dice.slice(0, dice.length - DICE_CAP).map((e) => e.id));
  j.entries = j.entries.filter((e) => !drop.has(e.id));
  return j;
}

/* ---------------------------------------------------------------- reading */

/** Entries newest first, optionally narrowed to one hero and/or a set of kinds. */
export function entries({ characterId = null, kinds = null } = {}) {
  const j = read();
  let list = j.entries.slice().sort((a, b) => b.at - a.at);
  if (characterId) list = list.filter((e) => e.characterId === characterId || e.characterId === null);
  if (kinds && kinds.length) list = list.filter((e) => kinds.includes(e.kind));
  return list;
}

/** The same entries, bundled under the session they happened in, newest session first. */
export function grouped({ characterId = null, kinds = null } = {}) {
  const j = read();
  const list = entries({ characterId, kinds });
  const order = j.sessions.slice().sort((a, b) => a.startedAt - b.startedAt);
  const numberOf = new Map(order.map((s, i) => [s.id, i + 1]));
  const bySession = new Map();
  for (const e of list) {
    const key = e.sessionId || "__loose";
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key).push(e);
  }
  const out = [];
  for (const s of order.slice().reverse()) {
    const items = bySession.get(s.id);
    if (!items || !items.length) continue;
    out.push({ session: s, title: sessionTitle(s, numberOf.get(s.id)), entries: items });
  }
  const loose = bySession.get("__loose");
  if (loose && loose.length) out.push({ session: null, title: "Outside any session", entries: loose });
  return out;
}

export function stats() {
  const j = read();
  return {
    entries: j.entries.length,
    written: j.entries.filter((e) => e.kind === "note").length,
    annotated: j.entries.filter((e) => e.note).length,
    sessions: j.sessions.length,
  };
}

/* ---------------------------------------------------------------- export */

const stamp = (at) => {
  const d = new Date(at);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

/** Readable markdown for the whole journal or one session. */
export function toMarkdown({ characterId = null, sessionId = null, heroName = null } = {}) {
  const groups = grouped({ characterId }).filter((g) => !sessionId || g.session?.id === sessionId);
  const lines = [`# ${heroName ? `${heroName} — journal` : "Campaign journal"}`, ""];
  for (const g of groups) {
    lines.push(`## ${g.title}`, "");
    for (const e of g.entries.slice().reverse()) {
      if (e.kind === "note") lines.push(`${stamp(e.at)} — ${e.text}`, "");
      else lines.push(`- *${stamp(e.at)}* **${KINDS[e.kind]?.name || e.kind}:** ${e.text}`);
      if (e.note) lines.push(`  > ${e.note}`, "");
    }
    lines.push("");
  }
  if (groups.length === 0) lines.push("_Nothing recorded yet._");
  return lines.join("\n");
}

/* ---------------------------------------------------------------- backup */

export function exportState() { return read(); }

export function importState(data) {
  if (!data || typeof data !== "object") return false;
  write({ ...blank(), ...data, sessions: data.sessions || [], entries: data.entries || [] });
  return true;
}
