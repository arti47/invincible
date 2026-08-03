// screens.js — home, rules library, compendium, roll log, settings & about.

import { el, clear, dieFace } from "./core.js";
import { modal, showToast, confirmModal, promptModal, announce, helpPanel } from "./ui.js";
import * as R from "./rules.js";
import { D } from "./rules.js";
import * as Derived from "./derived.js";
import * as Store from "./store.js";
import { Settings, TOGGLES, applyTheme } from "./settings.js";
import { lifecycleButtons, openLifecycle, stageCard } from "./combat.js";
import { openTeamWizard, listPregens, instantiatePregen } from "./wizard.js";
import { showNPC } from "./gm.js";
import * as Sync from "./sync.js";
import * as Journal from "./journal.js";

/* ---------------------------------------------------------------- home */

export function renderHome(mount) {
  clear(mount);
  const c = Store.activeCharacter();
  const chars = Store.listCharacters();
  const team = Store.getTeam();

  if (chars.length) mount.append(stageCard());

  // With an empty roster, learning the game comes before building a hero for it.
  if (!chars.length) {
    mount.append(el("section", { class: "card" },
      el("h1", { text: "Invincible Player" }),
      el("h3", { text: "New to the game?" }),
      el("p", { class: "muted small", text: "A step-by-step tutorial for first-time players — dice, fights, damage and karma — plus one for solo play with no GM." }),
      el("div", { class: "row-actions" },
        el("a", { class: "btn primary", href: "#/learn" }, "Start the tutorial"))));
  }

  mount.append(el("section", { class: "card hero-card" },
    chars.length ? el("h1", { text: "Invincible Player" }) : el("h2", { text: "Make a hero" }),
    el("p", { class: "muted", text: "Character creation, live tracking and the dice engine for Invincible — Superhero Roleplaying." }),
    el("div", { class: "row-actions" },
      el("a", { class: `btn ${chars.length ? "primary" : ""}`, href: "#/create" }, c ? "Create another hero" : "Create your hero"),
      el("button", { class: "btn", onclick: () => openPregens() }, "Play a published hero"),
      el("button", { class: "btn ghost", onclick: () => openTeamWizard(() => renderHome(mount)) }, team ? "Edit team" : "Create a team"))));

  if (chars.length) {
    const list = el("div", { class: "char-list" });
    for (const ch of chars) {
      const s = Derived.summary(ch);
      list.append(el("div", { class: `char-row ${ch.id === c?.id ? "active" : ""}` },
        el("button", { class: "char-pick", onclick: () => { Store.setActiveCharacter(ch.id); location.hash = "#/sheet"; } },
          el("strong", { text: ch.identity.heroName || ch.identity.realName || "Unnamed" }),
          el("span", { class: "muted small", text: `${R.findRank(ch.identity.rank)?.name} · H ${ch.state.health}/${s.maxHealth} · R ${ch.state.resolve}/${s.maxResolve} · Karma ${ch.state.karma}` })),
        el("button", { class: "btn tiny danger", onclick: async () => {
          if (await confirmModal(`Delete ${ch.identity.heroName || "this hero"}? This cannot be undone.`, { title: "Delete hero", variant: "danger", confirmLabel: "Delete" })) {
            Store.deleteCharacter(ch.id); renderHome(mount);
          }
        } }, "Delete")));
    }
    mount.append(el("section", { class: "card" }, el("h3", { text: "Your heroes" }), list));
  }

  if (team) {
    mount.append(el("section", { class: "card" },
      el("h3", { text: team.name || "Your team" }),
      team.purpose ? el("p", { text: team.purpose }) : null,
      el("p", { class: "muted small", text: `${team.base?.location || "No base yet"} — ${(team.base?.upgrades || []).map((u) => u.name).join(", ") || "no upgrades"}` }),
      el("button", { class: "btn ghost", onclick: () => openTeamWizard(() => renderHome(mount)) }, "Edit team & base")));
  }

  mount.append(el("section", { class: "card" }, el("h3", { text: "Scene & session" }), lifecycleButtons()));

  mount.append(el("section", { class: "card" },
    el("h3", { text: "Quick reference" }),
    el("p", { class: "muted small", text: "Roll dice equal to the attribute; one 6 succeeds and every extra 6 buys a stunt. Push once to re-roll everything that isn't a 6 or a 1 — each 1 then costs 1 stress." }),
    el("div", { class: "row-actions" },
      el("a", { class: "btn ghost", href: "#/rules" }, "Open the rules library"),
      el("a", { class: "btn ghost", href: "#/learn" }, "Tutorials"),
      el("a", { class: "btn ghost", href: "#/journal" }, "Journal"))));
}

async function openPregens() {
  const pregens = listPregens();
  const list = el("div", { class: "npc-list" });
  const m = modal({ title: "Published heroes", size: "wide",
    body: el("div", {},
      el("p", { class: "muted small", text: "Published stat blocks, playable as-is. Their Health and Resolve are the printed values rather than a point-built total." }),
      list),
    actions: [{ label: "Close", variant: "ghost" }] });
  for (const p of pregens) {
    list.append(el("div", { class: "npc-row" },
      el("button", { class: "npc-pick", onclick: () => showNPC({ ...p, group: "Hero" }) },
        el("strong", { text: p.name }), el("p", { class: "muted small", text: `${p.role} · ${p.descriptor}` })),
      el("button", { class: "btn tiny primary", onclick: async () => { m.close(); await instantiatePregen(p); } }, "Play")));
  }
}

/* ---------------------------------------------------------------- rules library */

export function renderRules(mount, anchor) {
  clear(mount);
  const search = el("input", { class: "input", type: "search", placeholder: "Search the rules…", "aria-label": "Search the rules" });
  const results = el("div", { class: "rules-list" });
  const draw = () => {
    clear(results);
    const entries = R.searchRules(search.value);
    if (!entries.length) results.append(el("p", { class: "muted", text: "Nothing matches." }));
    for (const e of entries) {
      results.append(el("details", { class: "rule-entry", id: `rule-${e.id}`, open: anchor === e.id },
        el("summary", {}, el("strong", { text: e.title }), el("span", { class: "muted small", text: ` ${e.chapter}` })),
        el("p", { text: e.body })));
    }
    if (anchor) {
      const node = results.querySelector(`#rule-${CSS.escape(anchor)}`);
      if (node) node.scrollIntoView({ block: "center" });
    }
  };
  search.addEventListener("input", draw);
  draw();

  mount.append(
    el("section", { class: "card" }, el("h2", { text: "Rules library" }), search, results),
    referenceTables());
}

function referenceTables() {
  const card = el("section", { class: "card" }, el("h3", { text: "Reference tables" }));
  card.append(detailsTable("Attribute scores", [["Score", "Description"]].concat(
    Object.entries(D.SCORE_DESCRIPTIONS).map(([k, v]) => [k, v]))));
  card.append(detailsTable("Hero ranks", [["Rank", "Points", "Max", "Powers", "Reputation"]].concat(
    D.RANKS.map((r) => [r.name, r.points, r.attrMax, r.powers, r.reputation]))));
  card.append(detailsTable("Lifting by STRENGTH", [["STRENGTH", "Can lift"]].concat(
    Object.entries(D.LIFT_TABLE).map(([k, v]) => [k, v]))));
  card.append(detailsTable("Standard of living", [["Resources", "Lifestyle"]].concat(
    Object.entries(D.STANDARD_OF_LIVING).map(([k, v]) => [k, v]))));
  card.append(detailsTable("Recovery", [["Time", "Health", "Resolve"]].concat(
    D.RECOVERY.map((r) => [r.span, r.health, r.resolve]))));
  card.append(detailsTable("Critical injuries", [["Roll", "Injury", "Healing"]].concat(
    D.CRITICAL_INJURIES.map((c) => [c.roll, `${c.name} ${c.desc}`, c.healing]))));
  card.append(detailsTable("Zone terrain", [["Terrain", "Min STRENGTH", "Attack bonus"]].concat(
    D.ZONE_TERRAIN.map((t) => [t.name, t.minStrength, `+${t.bonus}`]))));
  card.append(detailsTable("Weapons", [["Weapon", "Bonus", "Damage", "Range", "Cost", "Features"]].concat(
    D.WEAPONS.map((w) => [w.name, `+${w.bonus}`, w.damage || "—", w.range ? (Array.isArray(w.range) ? w.range.join("/") : w.range) : "—", `${w.cost}${w.restricted ? " R" : ""}`, (w.features || []).join(", ") || "—"]))));
  card.append(detailsTable("Body armor", [["Armor", "Rating", "Cost", "Notes"]].concat(
    D.BODY_ARMOR.map((a) => [a.name, a.armor, `${a.cost}${a.restricted ? " R" : ""}`, a.note]))));
  card.append(detailsTable("Vehicles", [["Vehicle", "Type", "Pass.", "Man.", "Speed", "Dur.", "Armor", "Cost"]].concat(
    D.VEHICLES.map((v) => [v.name, v.type, v.passengers ?? "—", v.maneuver ?? "—", v.speed, v.durability, v.armor, v.cost ?? "—"]))));
  card.append(detailsTable("Conditions", [["Condition", "Effect", "Removal"]].concat(
    D.CONDITIONS.map((c) => [c.name, c.desc, c.removal]))));
  return card;
}

function detailsTable(title, rows) {
  const [head, ...body] = rows;
  return el("details", {}, el("summary", { text: title }),
    el("div", { class: "table-scroll" },
      el("table", { class: "data-table" },
        el("tr", {}, ...head.map((h) => el("th", { text: String(h) }))),
        ...body.map((r) => el("tr", {}, ...r.map((cell) => el("td", { text: String(cell) })))))));
}

/* ---------------------------------------------------------------- compendium */

export function renderCompendium(mount) {
  clear(mount);
  const all = R.compendium();
  const search = el("input", { class: "input", type: "search", placeholder: "Search NPCs, creatures, adversaries and heroes…" });
  const list = el("div", { class: "npc-list" });
  const draw = () => {
    clear(list);
    const q = search.value.trim().toLowerCase();
    const groups = {};
    for (const n of all) {
      if (q && !n.name.toLowerCase().includes(q) && !(n.desc || n.descriptor || "").toLowerCase().includes(q)) continue;
      (groups[n.group] = groups[n.group] || []).push(n);
    }
    for (const [group, items] of Object.entries(groups)) {
      list.append(el("h4", { class: "section", text: `${group} (${items.length})` }));
      for (const n of items) {
        list.append(el("button", { class: "npc-row", onclick: () => showNPC(n) },
          el("div", {}, el("strong", { text: n.name }), el("p", { class: "muted small", text: n.desc || n.descriptor || "" })),
          el("span", { class: "tap-hint", text: "▸" })));
      }
    }
  };
  search.addEventListener("input", draw);
  draw();
  mount.append(el("section", { class: "card" },
    el("h2", { text: "Compendium" }),
    el("p", { class: "muted small", text: "Stock NPC profiles, animals, published adversaries and playable heroes." }),
    search, list));
}

/* ---------------------------------------------------------------- roll log */

export function renderRollLog(mount) {
  clear(mount);
  const log = Store.rollLog();
  const list = el("div", { class: "roll-log", "aria-live": "polite" });
  if (!log.length) list.append(el("p", { class: "muted", text: "No rolls yet." }));
  for (const r of log) {
    list.append(el("div", { class: "log-row" },
      el("div", { class: "log-head" },
        el("strong", { text: r.label }),
        el("span", { class: "muted small", text: new Date(r.ts).toLocaleTimeString() })),
      el("div", { class: "dice-row small" }, ...(r.dice || []).map((v) => el("span", { class: `die ${v === 6 ? "six" : v === 1 ? "one" : ""}`, text: String(v) }))),
      el("p", { class: "muted small", text: [
        r.characterName, r.attribute ? r.attribute.toUpperCase() : null, `pool ${r.pool}`,
        (r.mods || []).map((m) => `${m.label} ${m.value > 0 ? "+" : ""}${m.value}`).join(", ") || null,
        r.pushed ? `pushed ×${r.pushed}` : null,
        r.stressTaken ? `${r.stressTaken} stress` : null,
        r.outcome,
      ].filter(Boolean).join(" · ") })));
  }
  mount.append(el("section", { class: "card" },
    el("h2", { text: "Roll log" }),
    el("p", { class: "muted small", text: "Every roll is recorded with its pool, modifiers, faces and outcome — enough to re-derive it. Capped at the last 100." }),
    el("button", { class: "btn ghost", onclick: async () => {
      if (await confirmModal("Clear the roll log?", { title: "Clear log" })) { Store.clearRollLog(); renderRollLog(mount); }
    } }, "Clear log"),
    list));
}

/* ---------------------------------------------------------------- journal screen */

/**
 * The campaign record. One timeline per hero, grouped into sessions, with the dice and the
 * player's own words in the same place. Replaces the old roll-log screen, which is now the
 * "Dice" filter.
 */
export function renderJournal(mount, arg) {
  clear(mount);
  const chars = Store.listCharacters();
  const active = Store.activeCharacter();
  if (arg === "dice" && !journalFilter.kinds) journalFilter.kinds = ["roll"];

  const scope = journalFilter.allHeroes || !active ? null : active.id;
  const groups = Journal.grouped({ characterId: scope, kinds: journalFilter.kinds });
  const st = Journal.stats();
  const open = Journal.openSession();

  const head = el("section", { class: "card" },
    el("h2", { text: "Journal" }),
    helpPanel([
      "Everything that happens in play lands here: every roll, every solo check, every scene boundary — and whatever you write alongside them.",
      "Entries collect under the session they happened in. Start session and End session open and close one; in solo play an alert and Head home do the same job.",
      "Tap Note on any entry to add your own words to it. Written entries and anything you have annotated are never pruned.",
    ]),
    el("p", { class: "stat-line", text: `${st.entries} entries · ${st.written} written · ${st.annotated} annotated · ${st.sessions} session${st.sessions === 1 ? "" : "s"}` }),
    open ? el("p", { class: "good small", text: `Session open${open.title ? `: ${open.title}` : ""} — new entries are filing under it.` })
      : el("p", { class: "muted small", text: "No session open. Entries file loose until you start one." }),
    el("div", { class: "row-actions" },
      el("button", { class: "btn primary", onclick: () => writeEntry(mount) }, "Write an entry"),
      el("button", { class: "btn ghost", onclick: () => exportMarkdown(scope) }, "Export markdown")));

  // Filters: which kinds, and whose journal.
  const filters = el("div", { class: "chiprow" });
  const kindChip = (label, kinds) => {
    const on = JSON.stringify(journalFilter.kinds) === JSON.stringify(kinds);
    return el("button", { class: `chip selectable ${on ? "selected" : ""}`, onclick: () => {
      journalFilter.kinds = on ? null : kinds;
      renderJournal(mount);
    } }, label);
  };
  filters.append(
    kindChip("Everything", null),
    kindChip("Written only", ["note"]),
    kindChip("Dice only", ["roll"]),
    kindChip("Solo", ["solo"]),
    kindChip("Scenes", ["lifecycle", "state"]));
  head.append(filters);
  if (chars.length > 1) {
    head.append(el("label", { class: "check" },
      el("input", { type: "checkbox", checked: journalFilter.allHeroes,
        onchange: (e) => { journalFilter.allHeroes = e.target.checked; renderJournal(mount); } }),
      " Show every hero's journal"));
  }
  mount.append(head);

  if (!groups.length) {
    mount.append(el("div", { class: "empty" },
      el("h3", { text: "Nothing recorded yet" }),
      el("p", { text: "Roll some dice, or write the first entry." })));
    return;
  }

  for (const g of groups) {
    const card = el("section", { class: "card" });
    const title = el("h3", { text: g.title });
    card.append(el("div", { class: "identity-head" }, title,
      el("div", { class: "chosen-actions" },
        g.session ? el("button", { class: "btn tiny ghost", onclick: async () => {
          const t = await promptModal("Name this session — an issue title works well.",
            { title: "Rename session", value: g.session.title || "" });
          if (t !== null) { Journal.retitleSession(g.session.id, t); renderJournal(mount); }
        } }, "Rename") : null,
        el("button", { class: "btn tiny ghost", onclick: () => exportMarkdown(scope, g.session?.id) }, "Export"))));
    card.append(el("p", { class: "muted small", text: `${g.entries.length} entr${g.entries.length === 1 ? "y" : "ies"}` }));

    for (const e of g.entries) {
      card.append(entryRow(e, mount));
    }
    mount.append(card);
  }
}

const journalFilter = { kinds: null, allHeroes: false };

function entryRow(e, mount) {
  const meta = Journal.KINDS[e.kind] || { name: e.kind, icon: "•" };
  const row = el("div", { class: `jr-entry jr-${e.kind}` },
    el("div", { class: "jr-head" },
      el("span", { class: "jr-icon", "aria-hidden": "true", text: meta.icon }),
      el("span", { class: "jr-when", text: new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }),
      el("span", { class: "jr-kind", text: meta.name })),
    el("p", { class: e.kind === "note" ? "jr-text written" : "jr-text", text: e.text }));

  if (e.kind === "roll" && e.detail?.dice?.length) {
    row.append(el("div", { class: "dice-row small" }, ...e.detail.dice.map((v) =>
      el("span", { class: `die ${v === 6 ? "six" : v === 1 ? "one" : ""}`, text: String(v) }))));
  }
  if (e.note) row.append(el("p", { class: "jr-note", text: e.note }));

  row.append(el("div", { class: "chosen-actions" },
    el("button", { class: "btn tiny ghost", onclick: async () => {
      const n = await promptModal("Your own words about this moment.",
        { title: e.note ? "Edit note" : "Add a note", value: e.note || "", multiline: true });
      if (n !== null) { Journal.annotate(e.id, n); renderJournal(mount); }
    } }, e.note ? "Edit note" : "Note"),
    e.kind === "note" ? el("button", { class: "btn tiny ghost", onclick: async () => {
      const t = await promptModal("Edit this entry.", { title: "Edit", value: e.text, multiline: true });
      if (t !== null) { Journal.editEntry(e.id, t); renderJournal(mount); }
    } }, "Edit") : null,
    el("button", { class: "btn tiny ghost", onclick: async () => {
      if (await confirmModal("Remove this entry from the journal?", { title: "Remove", confirmLabel: "Remove", variant: "danger" })) {
        Journal.removeEntry(e.id); renderJournal(mount);
      }
    } }, "Remove")));
  return row;
}

async function writeEntry(mount) {
  const text = await promptModal("What happened? Write it however you like.",
    { title: "Journal entry", multiline: true });
  if (!text) return;
  Journal.addNote(text, Store.activeCharacterId());
  showToast("Written to the journal.", { variant: "good" });
  renderJournal(mount);
}

function exportMarkdown(characterId, sessionId = null) {
  const hero = characterId ? Store.getCharacter(characterId) : null;
  const md = Journal.toMarkdown({ characterId, sessionId,
    heroName: hero?.identity?.heroName || hero?.identity?.realName || null });
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: `journal-${new Date().toISOString().slice(0, 10)}.md` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Journal exported as markdown.", { variant: "good" });
}

/* ---------------------------------------------------------------- settings & about */

export function renderSettings(mount) {
  clear(mount);
  const card = el("section", { class: "card" }, el("h2", { text: "Settings" }));

  card.append(el("h3", { class: "section", text: "Theme" }));
  const themeRow = el("div", { class: "chiprow" });
  for (const t of ["system", "light", "dark"]) {
    themeRow.append(el("button", { class: `chip selectable ${Settings.theme() === t ? "selected" : ""}`,
      onclick: () => { Settings.setTheme(t); renderSettings(mount); } }, t === "system" ? "Follow system" : t));
  }
  card.append(themeRow);

  card.append(el("h3", { class: "section", text: "Features" }));
  for (const t of TOGGLES) {
    const input = el("input", { type: "checkbox", checked: Settings.enabled(t.key), onchange: (e) => {
      Settings.set(t.key, e.target.checked);
      showToast(`${t.name} ${e.target.checked ? "on" : "off"}.`);
      document.dispatchEvent(new CustomEvent("nav-refresh"));
    } });
    card.append(el("label", { class: "toggle-row" }, input,
      el("span", {}, el("strong", { text: t.name }), el("span", { class: "muted small", text: t.desc }))));
  }

  card.append(el("h3", { class: "section", text: "Backup" }));
  card.append(el("div", { class: "row-actions" },
    el("button", { class: "btn", onclick: exportJson }, "Export JSON"),
    el("button", { class: "btn", onclick: () => importJson(mount) }, "Import JSON"),
    el("button", { class: "btn ghost", onclick: copyJson }, "Copy to clipboard")));

  card.append(el("h3", { class: "section", text: "Mission data" }));
  card.append(el("p", { class: "muted small", text: "Clears the running action scene, challenges, the solo crisis board and the roll log, and resets every hero's scene and session flags. Heroes, the team, karma and advancement are kept." }));
  card.append(el("div", { class: "row-actions" },
    el("button", { class: "btn danger", onclick: () => wipeMission(mount) }, "Wipe all mission data")));

  card.append(el("h3", { class: "section", text: "Multiplayer" }));
  card.append(Sync.renderSyncPanel());

  card.append(el("h3", { class: "section", text: "About" }));
  card.append(el("p", { class: "muted small", text: "A personal play aid for Invincible — Superhero Roleplaying, built from the core rules. Mechanics only; all effect text is paraphrased. No setting or adventure content." }));
  card.append(el("details", {}, el("summary", { text: "House aids (not official rules)" }),
    el("ul", {}, ...D.HOUSE_AIDS.map((h) => el("li", { text: h })))));
  card.append(el("details", {}, el("summary", { text: "Known source gaps" }),
    el("ul", {},
      el("li", { text: "The social hooks table is missing rows 25–41; rolls there are re-rolled." }),
      el("li", { text: "The Crisis Mode timer table's proximity labels were partly truncated; the app follows the surrounding rules text." }))));
  mount.append(card);
}

async function wipeMission(mount) {
  const ok = await confirmModal(
    "This clears the running action scene, every challenge, the solo crisis board and the roll log, and resets each hero's scene and session flags. Heroes, the team and karma are kept. It can be undone once.",
    { title: "Wipe all mission data", confirmLabel: "Wipe it", variant: "danger" });
  if (!ok) return;
  const c = Store.wipeMissionData();
  showToast(`Mission data wiped — ${c.rollLog} log entries, ${c.tasks} challenge(s), ${c.heroes} hero(es) reset.`, {
    variant: "good", timeout: 8000,
    action: { label: "Undo", onClick: () => { Store.undo(); showToast("Mission data restored."); renderSettings(mount); } },
  });
  renderSettings(mount);
}

function exportJson() {
  const data = Store.exportBackupString();
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: `invincible-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Backup downloaded.", { variant: "good" });
}

async function copyJson() {
  try { await navigator.clipboard.writeText(Store.exportBackupString()); showToast("Backup copied to the clipboard.", { variant: "good" }); }
  catch { showToast("Could not access the clipboard — use Export JSON instead.", { variant: "warn" }); }
}

async function importJson(mount) {
  const input = el("input", { type: "file", accept: "application/json" });
  const area = el("textarea", { class: "input", rows: 6, placeholder: "…or paste the backup JSON here" });
  const m = modal({ title: "Import backup",
    body: el("div", {}, el("p", { text: "Importing replaces the heroes on this device unless you choose merge." }), input, area),
    actions: [
      { label: "Cancel", value: null, variant: "ghost" },
      { label: "Merge", value: "merge", variant: "" },
      { label: "Replace", value: "replace", variant: "warn" },
    ] });
  const mode = await m.promise;
  if (!mode) return;
  let text = area.value.trim();
  if (!text && input.files?.[0]) text = await input.files[0].text();
  if (!text) { showToast("Nothing to import.", { variant: "warn" }); return; }
  try {
    const n = Store.importBackup(text, { merge: mode === "merge" });
    showToast(`Imported ${n} hero(es).`, { variant: "good" });
    renderSettings(mount);
  } catch (e) {
    showToast(e.message || "Import failed.", { variant: "danger" });
  }
}
