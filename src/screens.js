// screens.js — home, rules library, compendium, roll log, settings & about.

import { el, clear, dieFace } from "./core.js";
import { modal, showToast, confirmModal, promptModal, chooseModal, announce, helpPanel } from "./ui.js";
import * as R from "./rules.js";
import { D } from "./rules.js";
import * as Derived from "./derived.js";
import * as Store from "./store.js";
import { Settings, TOGGLES, applyTheme } from "./settings.js";
import { lifecycleButtons, openLifecycle, stageCard } from "./combat.js";
import { openTeamWizard, listPregens, instantiatePregen } from "./wizard.js";
import { showNPC } from "./gm.js";
import { soloStageCard } from "./solo.js";
import { buyBaseUpgrade } from "./sheet.js";
import { NPC_RECIPE, NPC_HANDLING, CREATURE_NOTE } from "../data-npcs.js";
import { ADVERSARY_NOTE } from "../data-monsters.js";
import { PREGEN_NOTE } from "../data-pregens.js";
import * as Sync from "./sync.js";
import * as Journal from "./journal.js";

/* ---------------------------------------------------------------- home */

export function renderHome(mount) {
  clear(mount);
  const c = Store.activeCharacter();
  const chars = Store.listCharacters();
  const team = Store.getTeam();

  // One spine, not two. A solo player was being told to run the group lifecycle ("Start session"
  // -> "Start action scene") while the engine that actually generates their game sat on another
  // tab. When Crisis Mode is on, the solo thread is the thread.
  if (chars.length) mount.append(Settings.soloMode() ? soloStageCard() : stageCard());

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
      el("div", { class: "row-actions" },
        el("button", { class: "btn ghost", onclick: () => openTeamWizard(() => renderHome(mount)) }, "Edit team & base"),
        // The purchase lives in the karma dialog; someone looking at the base should still find it.
        el("button", { class: "btn ghost", onclick: () => buyBaseUpgrade(() => renderHome(mount)) },
          `Buy an upgrade — ${D.KARMA.costs.baseUpgrade} karma`))));
  }

  // The session lifecycle needs a hero to act on; showing it first is six buttons that cannot help.
  if (chars.length) mount.append(el("section", { class: "card" }, el("h3", { text: "Scene & session" }), lifecycleButtons()));

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
      el("p", { class: "muted small", text: PREGEN_NOTE }),
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

  // Newcomers hit the words before they hit the rules, so the glossary sits above the library and
  // answers to the same search box.
  const glossary = el("div", { class: "glossary" });
  const drawGlossary = () => {
    clear(glossary);
    const q = search.value.trim().toLowerCase();
    const hits = q
      ? D.GLOSSARY.filter((g) => g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q))
      : D.GLOSSARY;
    if (!hits.length) { glossary.append(el("p", { class: "muted small", text: "No word matches." })); return; }
    for (const g of hits) {
      glossary.append(el("details", { class: "gloss-entry", open: !!q && hits.length <= 3 },
        el("summary", {}, el("strong", { text: g.term })),
        el("p", { class: "small", text: g.def }),
        el("p", { class: "cite" }, el("a", { class: "rules-link", href: `#/rules/${g.rule}` }, "the full rule"))));
    }
  };
  search.addEventListener("input", drawGlossary);
  drawGlossary();

  mount.append(
    el("section", { class: "card" },
      el("h2", { text: "Rules library" }),
      el("p", { class: "muted small", text: "Search both the words and the rules. If a term in the app is unfamiliar, it is almost certainly explained below." }),
      search),
    el("section", { class: "card", id: "glossary" },
      el("h3", { text: `Words you'll see (${D.GLOSSARY.length})` }),
      el("p", { class: "muted small", text: "Plain-English definitions of everything the app calls by name." }),
      glossary),
    el("section", { class: "card" }, el("h3", { text: "The rules" }), results),
    orphanedRules(),
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

/**
 * Rules text that was extracted but had no route to the player: hazards, falling, weapon features,
 * vehicle handling, the time ladder crit healing uses, and the NPC-building recipe a solo player
 * needs because they are their own GM. Rendered from the data verbatim rather than re-summarised.
 */
function orphanedRules() {
  const card = el("section", { class: "card", id: "more-rules" }, el("h3", { text: "More rules" }),
    el("p", { class: "muted small", text: "Corners of the rules the other screens do not need often enough to show inline." }));

  card.append(detailsTable("Hazards", [["Hazard", "Rule"]].concat(
    Object.entries(D.HAZARDS).map(([k, v]) => [titleise(k), v]))));

  card.append(detailsTable("Falling", [["From", "Damage"]].concat([
    ["Elevated", D.FALLING.elevated], ["Sky high", D.FALLING.sky], ["In orbit", D.FALLING.orbit],
    ["Avoiding it", D.FALLING.roll]])));

  card.append(detailsTable("Weapon features", [["Feature", "What it does"]].concat(
    Object.entries(D.WEAPON_FEATURES).map(([k, v]) => [titleise(k), v]))));

  card.append(el("details", {}, el("summary", { text: "Vehicles in play" }),
    el("ul", { class: "small" }, ...D.VEHICLE_RULES.map((t) => el("li", { text: t })))));

  card.append(detailsTable("Healing times", [["Category"]].concat(D.TIME_CATEGORIES.map((t) => [t]))));

  card.append(el("details", {}, el("summary", { text: "Base upgrades — buying them later" }),
    el("ul", { class: "small" }, ...D.BASE_UPGRADE_RULES.map((t) => el("li", { text: t })))));

  // What a session is made of. The lifecycle bundles act on these; the shapes themselves were
  // never shown, so nothing told a new player what a briefing or an act is.
  card.append(el("details", {}, el("summary", { text: "The shape of a session" }),
    el("ul", { class: "small" }, ...D.LIFECYCLE.sceneTypes.map((t) => el("li", {},
      el("strong", { text: `${t.name}: ` }), t.desc))),
    el("p", { class: "muted small", text: D.LIFECYCLE.flow }),
    el("h4", { class: "section", text: "An adventure in three acts" }),
    el("ul", { class: "small" }, ...D.LIFECYCLE.actStructure.map((t) => el("li", { text: t })))));

  card.append(el("details", {}, el("summary", { text: "Building an NPC (you are the GM in solo play)" }),
    el("ol", { class: "small" }, ...NPC_RECIPE.map((r) => el("li", {},
      el("strong", { text: `${r.step}: ` }), r.desc))),
    el("h4", { class: "section", text: "Running them" }),
    el("ul", { class: "small" }, ...NPC_HANDLING.map((t) => el("li", { text: t })))));

  return card;
}

const titleise = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

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
      // Ch.6 prints one caveat over the animal list; it belongs with the animals, not in a data file.
      if (group === "Creatures") list.append(el("p", { class: "muted small", text: CREATURE_NOTE }));
      if (group === "Adversaries") list.append(el("p", { class: "muted small", text: ADVERSARY_NOTE }));
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


/* ---------------------------------------------------------------- journal screen */

const journalView = { kinds: null, allHeroes: false, query: "", openSessions: null };

/**
 * The campaign record, written as you play. Prose is the point, so the page reads like a diary:
 * sessions newest first, entries inside one oldest first, and the compose box where the next
 * entry goes. Mechanical entries are a projection of the raw log — consecutive dice collapse into
 * a single expandable row rather than flooding the page.
 */
export function renderJournal(mount, arg) {
  clear(mount);
  const chars = Store.listCharacters();
  const active = Store.activeCharacter();
  if (arg === "dice" && journalView.kinds === null) journalView.kinds = ["roll"];

  const scope = journalView.allHeroes || !active ? null : active.id;
  const open = Journal.openSession();
  if (journalView.openSessions === null) journalView.openSessions = new Set(open ? [open.id] : []);

  mount.append(journalHeader(mount, chars, scope, open));

  let groups = Journal.grouped({ characterId: scope, kinds: journalView.kinds });
  if (journalView.query.trim()) {
    const hits = new Set(Journal.search(journalView.query, { characterId: scope }).map((e) => e.id));
    groups = groups.map((g) => ({ ...g, entries: g.entries.filter((e) => hits.has(e.id)) }))
      .filter((g) => g.entries.length);
  }

  if (!groups.length && !open) {
    mount.append(el("div", { class: "empty" },
      el("h3", { text: journalView.query ? "Nothing matches" : "Nothing written yet" }),
      el("p", { text: journalView.query ? "Try a different word." : "Start a session, then write the first entry." })));
    return;
  }

  // An open session always shows, even before anything has landed in it.
  if (open && !groups.some((g) => g.session?.id === open.id)) {
    groups.unshift({ session: open, title: Journal.sessionTitle(open, Journal.load().sessions.length), entries: [] });
  }

  for (const g of groups) mount.append(sessionCard(g, mount, open));
}

function journalHeader(mount, chars, scope, open) {
  const st = Journal.stats();
  const card = el("section", { class: "card" },
    el("h2", { text: "Journal" }),
    helpPanel([
      "Your record of the campaign. Write whatever you like as you play — the dice, the solo checks and the scene boundaries file themselves around what you write.",
      "Sessions read newest first; inside a session the story reads top to bottom, the way it happened.",
      "Runs of dice collapse into one line. Tap it to see every roll. Tap any entry for its actions.",
    ]),
    el("p", { class: "stat-line", text: `${st.written} written · ${st.entries} entries · ${st.sessions} session${st.sessions === 1 ? "" : "s"}` }));

  const search = el("input", { class: "input", type: "search", placeholder: "Search the journal…",
    "aria-label": "Search the journal", value: journalView.query });
  search.addEventListener("input", () => {
    journalView.query = search.value;
    if (search.value.trim()) journalView.openSessions = "all";
    const at = search.selectionStart;
    renderJournal(mount);
    const again = document.querySelector('#screen input[type="search"]');
    if (again) { again.focus(); again.setSelectionRange(at, at); }
  });
  card.append(search);

  const filters = el("div", { class: "chiprow" });
  const chip = (label, kinds) => {
    const on = JSON.stringify(journalView.kinds) === JSON.stringify(kinds);
    return el("button", { class: `chip selectable ${on ? "selected" : ""}`,
      onclick: () => { journalView.kinds = on && kinds ? null : kinds; renderJournal(mount); } }, label);
  };
  filters.append(chip("Everything", null), chip("Written only", ["note"]), chip("Dice only", ["roll"]),
    chip("Solo", ["solo"]), chip("Scenes", ["lifecycle", "state"]));
  card.append(filters);

  const row = el("div", { class: "row-actions" },
    open
      ? el("button", { class: "btn ghost", onclick: () => { Journal.endSession(); renderJournal(mount); } }, "Close session")
      : el("button", { class: "btn", onclick: async () => {
          const t = await promptModal("Name this session, or leave blank.", { title: "Start a session" });
          if (t === null) return;
          Journal.startSession(t, Store.activeCharacterId());
          journalView.openSessions = new Set([Journal.openSession()?.id]);
          renderJournal(mount);
        } }, "Start a session"),
    el("button", { class: "btn ghost", onclick: () => openSessionPicker(mount) }, "Sessions…"),
    el("button", { class: "btn ghost", onclick: () => exportMarkdown(scope) }, "Export markdown"));
  card.append(row);

  if (chars.length > 1) {
    card.append(el("label", { class: "check" },
      el("input", { type: "checkbox", checked: journalView.allHeroes,
        onchange: (e) => { journalView.allHeroes = e.target.checked; renderJournal(mount); } }),
      " Show every hero's journal"));
  }
  return card;
}

const sessionIsOpen = (id) =>
  journalView.openSessions === "all" || (journalView.openSessions && journalView.openSessions.has(id));

function sessionCard(g, mount, openSession) {
  const id = g.session?.id || "__loose";
  const isCurrent = openSession && g.session?.id === openSession.id;
  const expanded = sessionIsOpen(id) || isCurrent;
  const card = el("section", { class: `card session ${isCurrent ? "current" : ""}` });

  const head = el("button", { class: "session-head", "aria-expanded": expanded ? "true" : "false",
    onclick: () => {
      if (journalView.openSessions === "all") journalView.openSessions = new Set([id]);
      else if (journalView.openSessions.has(id)) journalView.openSessions.delete(id);
      else journalView.openSessions.add(id);
      renderJournal(mount);
    } },
    el("span", { class: "session-caret", "aria-hidden": "true", text: expanded ? "▾" : "▸" }),
    el("span", {}, el("strong", { text: g.title }),
      el("span", { class: "muted small", text: ` · ${g.entries.length} entr${g.entries.length === 1 ? "y" : "ies"}${isCurrent ? " · open" : ""}` })));
  // The disclosure pattern: the button lives INSIDE a heading, so a screen-reader user can jump
  // between sessions by heading instead of only by walking the controls.
  card.append(el("h3", { class: "session-title" }, head));

  if (!expanded) return card;

  if (g.session) {
    const closed = !!g.session.endedAt;
    card.append(el("div", { class: "chosen-actions" },
      el("button", { class: "btn tiny ghost", onclick: async () => {
        const t = await promptModal("Name this session — an issue title works well.",
          { title: "Rename session", value: g.session.title || "" });
        if (t !== null) { Journal.retitleSession(g.session.id, t); renderJournal(mount); }
      } }, "Rename"),
      // Resuming a closed session files new entries under it again.
      closed ? el("button", { class: "btn tiny", onclick: () => {
        Journal.reopenSession(g.session.id);
        journalView.openSessions = new Set([g.session.id]);
        showToast(`Writing into "${g.title}" again.`, { variant: "good" });
        renderJournal(mount);
      } }, "Reopen") : null,
      el("button", { class: "btn tiny ghost", onclick: () => exportMarkdown(null, g.session.id) }, "Export"),
      el("button", { class: "btn tiny danger", onclick: () => wipeSession(g, mount) }, "Wipe")));
  }

  // Oldest first: a session reads the way it happened.
  const chronological = g.entries.slice().reverse();
  for (const item of Journal.aggregate(chronological)) {
    card.append(item.burst ? burstRow(item, mount) : entryRow(item, mount));
  }

  if (isCurrent) card.append(composeBox(mount));
  return card;
}

/** A run of dice as one line, expandable to every roll. */
function burstRow(burst, mount) {
  const wrap = el("div", { class: "jr-entry jr-burst" });
  const body = el("div", { class: "jr-burst-detail", hidden: true });
  const head = el("button", { class: "jr-burst-head", onclick: () => {
    body.hidden = !body.hidden;
    head.querySelector(".session-caret").textContent = body.hidden ? "▸" : "▾";
  } },
    el("span", { class: "session-caret", "aria-hidden": "true", text: "▸" }),
    el("span", { class: "jr-when", text: new Date(burst.from).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }),
    el("span", { text: Journal.burstSummary(burst) }));
  for (const e of burst.entries) body.append(entryRow(e, mount, { compact: true }));
  wrap.append(head, body);
  return wrap;
}

function entryRow(e, mount, { compact = false } = {}) {
  const meta = Journal.KINDS[e.kind] || { name: e.kind, icon: "•" };
  const isOracle = e.kind === "solo" && /→|answer|Engine|oracle/i.test(e.text);
  const row = el("div", { class: `jr-entry jr-${e.kind} ${compact ? "compact" : ""} ${isOracle ? "jr-oracle" : ""}` });

  const main = el("button", { class: "jr-main", onclick: () => {
    const acts = row.querySelector(".jr-actions");
    if (acts) acts.hidden = !acts.hidden;
  } },
    el("span", { class: "jr-head" },
      el("span", { class: "jr-icon", "aria-hidden": "true", text: meta.icon }),
      el("span", { class: "jr-when", text: new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }),
      compact ? null : el("span", { class: "jr-kind", text: meta.name })),
    el("span", { class: e.kind === "note" ? "jr-text written" : "jr-text", text: e.text }));
  row.append(main);

  if (e.kind === "roll" && e.detail?.dice?.length) {
    row.append(el("div", { class: "dice-row small" }, ...e.detail.dice.map((v) =>
      el("span", { class: `die ${v === 6 ? "six" : v === 1 ? "one" : ""}`, text: String(v) }))));
  }
  if (e.note) row.append(el("p", { class: "jr-note", text: e.note }));

  // Actions stay out of the way until the entry is tapped.
  row.append(el("div", { class: "jr-actions chosen-actions", hidden: true },
    isOracle ? el("button", { class: "btn tiny primary", onclick: () => {
      const box = document.querySelector("#jr-compose");
      if (box) { box.value = `${box.value}${box.value ? "\n\n" : ""}`; box.focus(); box.scrollIntoView({ block: "center" }); }
    } }, "Write from this") : null,
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
      if (await confirmModal("Remove this from the journal?", { title: "Remove", confirmLabel: "Remove", variant: "danger" })) {
        Journal.removeEntry(e.id); renderJournal(mount);
      }
    } }, "Remove")));
  return row;
}

/** Always present at the foot of the open session — no dialog, no mode. */
function composeBox(mount) {
  const ta = el("textarea", { class: "input", id: "jr-compose", rows: 3,
    placeholder: "What just happened? Write it however you like…", "aria-label": "Write a journal entry" });
  const save = () => {
    const text = ta.value.trim();
    if (!text) return;
    Journal.addNote(text, Store.activeCharacterId());
    ta.value = "";
    renderJournal(mount);
    const again = document.querySelector("#jr-compose");
    if (again) again.focus();
  };
  ta.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); save(); }
  });
  return el("div", { class: "jr-compose" }, ta,
    el("div", { class: "row-actions" },
      el("button", { class: "btn primary", onclick: save }, "Save entry"),
      el("span", { class: "muted small", text: "⌘/Ctrl + Enter" })));
}

/**
 * Wipe one session. Destroying a session heading should never silently destroy the writing under
 * it, so the choice is explicit — and either way it is undoable, since store.snapshot covers the
 * journal.
 */
async function wipeSession(g, mount) {
  const n = g.entries.length;
  const written = g.entries.filter((e) => e.kind === "note" || e.note).length;
  const choice = await modal({ title: `Wipe "${g.title}"?`,
    body: el("div", {},
      el("p", { text: `${n} entr${n === 1 ? "y" : "ies"} in this session${written ? `, ${written} of them written by you` : ""}.` }),
      el("p", { class: "muted small", text: "Keep my writing removes the session heading but leaves its entries in the journal, unfiled. Delete everything removes both." })),
    actions: [
      { label: "Cancel", value: null, variant: "ghost" },
      { label: "Keep my writing", value: "keep", variant: "" },
      { label: "Delete everything", value: "all", variant: "danger" },
    ] }).promise;
  if (!choice) return;
  Store.snapshot(`Wipe ${g.title}`);
  const res = Journal.deleteSession(g.session.id, { keepEntries: choice === "keep" });
  journalView.openSessions = null;
  renderJournal(mount);
  showToast(choice === "keep"
    ? `Session removed; ${res.entries} entr${res.entries === 1 ? "y" : "ies"} kept.`
    : `Session and ${res.entries} entr${res.entries === 1 ? "y" : "ies"} deleted.`,
    { variant: "warn", timeout: 9000,
      action: { label: "Undo", onClick: () => { Store.undo(); renderJournal(mount); showToast("Restored."); } } });
}

/** Pick any session to resume or wipe without scrolling to find it. */
async function openSessionPicker(mount) {
  const list = Journal.listSessions();
  if (!list.length) { showToast("No sessions yet.", { variant: "warn" }); return; }
  const pick = await chooseModal("Which session?", list.map((s) => ({
    label: s.label,
    hint: `${s.entries} entr${s.entries === 1 ? "y" : "ies"} · ${s.endedAt ? "closed" : "open"}`,
    value: s.id })));
  if (!pick) return;
  const chosen = list.find((s) => s.id === pick);
  if (!chosen.endedAt) {
    journalView.openSessions = new Set([pick]);
    renderJournal(mount);
    return;
  }
  const what = await chooseModal(chosen.label, [
    { label: "Reopen and write into it", hint: "New entries file under this session again", value: "reopen" },
    { label: "Just show it", hint: "Expand it where it sits", value: "show" },
  ]);
  if (!what) return;
  if (what === "reopen") {
    Journal.reopenSession(pick);
    showToast(`Writing into "${chosen.label}" again.`, { variant: "good" });
  }
  journalView.openSessions = new Set([pick]);
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
