// gm.js — the opt-in GM screen: party panel, adversary drop-ins and every rollable table.

import { el, clear, d6 } from "./core.js";
import { modal, showToast, promptModal, chooseModal, helpPanel } from "./ui.js";
import * as R from "./rules.js";
import { D } from "./rules.js";
import * as Derived from "./derived.js";
import * as Store from "./store.js";
import { NPC_PROFILES, CREATURES } from "../data-npcs.js";
import { ADVERSARIES } from "../data-monsters.js";
import * as Sync from "./sync.js";
import * as Combat from "./combat.js";
import { icon, iconFor } from "./icons.js";

export function renderGM(mount) {
  clear(mount);
  mount.append(
    el("section", { class: "card" },
      el("h2", { text: "GM screen" }),
      el("p", { class: "muted small", text: "Player-facing tool with a GM panel: the party at a glance, adversary stat blocks and every generator table in the core rules." })),
    partyPanel(),
    threatGenerator(),
    tablesPanel(),
    adversaryPanel());
}

function partyPanel() {
  const chars = Store.listCharacters();
  const team = Store.getTeam();
  const card = el("section", { class: "card" }, el("h3", { text: "Party" }),
    helpPanel(["Every hero saved on this device, at a glance — vitals, karma, Reputation and armor.", "Peek opens a read-only summary of a hero's attributes, powers, talents and drawbacks; Open sheet makes that hero active and takes you to their sheet."]));
  if (!chars.length) card.append(el("p", { class: "muted", text: "No heroes on this device yet." }));
  for (const c of chars) {
    const s = Derived.summary(c);
    card.append(el("div", { class: "party-row" },
      el("div", {},
        el("strong", { text: c.identity.heroName || c.identity.realName || "Hero" }),
        el("p", { class: "muted small", text: `${R.findRank(c.identity.rank)?.name} · ${c.identity.role || "—"} · ${c.identity.occupation || "—"}` })),
      el("div", { class: "party-stats" },
        el("span", { text: `H ${c.state.health}/${s.maxHealth}` }),
        el("span", { text: `R ${c.state.resolve}/${s.maxResolve}` }),
        el("span", { text: `Karma ${c.state.karma}` }),
        el("span", { text: `Rep ${s.reputation}` }),
        s.armor.value ? el("span", { text: `Armor ${s.armor.value}` }) : null),
      el("div", { class: "chosen-actions" },
        el("button", { class: "btn tiny ghost", onclick: () => peekSheet(c) }, "Peek"),
        el("button", { class: "btn tiny", onclick: () => { Store.setActiveCharacter(c.id); location.hash = "#/sheet"; } }, "Open sheet"))));
  }
  if (team) {
    card.append(el("div", { class: "party-row" },
      el("div", {}, el("strong", { text: team.name || "The team" }),
        el("p", { class: "muted small", text: `${team.base?.location || "No base"} · ${(team.base?.upgrades || []).length} upgrade(s)` }))));
  }

  // In a campaign the party is bigger than this device. Members sync in live; local-only mode
  // never calls back, so the block simply never appears.
  const remote = el("div", { class: "remote-party" });
  card.append(remote);
  const localNames = new Set(chars.map((c) => (c.identity.heroName || "").toLowerCase()));
  Sync.subscribeParty((members) => {
    clear(remote);
    const others = Object.values(members || {})
      .filter((m) => m && m.displayName && !localNames.has(String(m.displayName).toLowerCase()));
    if (!others.length) return;
    remote.append(el("h4", { class: "section", text: `Also in this campaign (${others.length})` }));
    for (const m of others) {
      remote.append(el("div", { class: "party-row" },
        el("div", {}, el("strong", { text: m.displayName }),
          el("p", { class: "muted small", text: m.role === "gm" ? "GM" : "Player" }))));
    }
  });
  return card;
}

function peekSheet(c) {
  const s = Derived.summary(c);
  modal({ title: c.identity.heroName || "Hero", size: "wide",
    body: el("div", {},
      el("div", { class: "stat-tiles", role: "img", "aria-label": D.ATTRIBUTES.map((a) => `${a.short} ${s.attributes[a.key]}`).join(" · ") },
        ...D.ATTRIBUTES.map((a) => el("span", { class: "stat-tile" },
          el("span", { class: "stat-abbr", text: a.short }), el("span", { class: "stat-val", text: String(s.attributes[a.key]) })))),
      el("p", { class: "stat-line", text: `Health ${c.state.health}/${s.maxHealth} · Resolve ${c.state.resolve}/${s.maxResolve} · Slugfest ${s.slugfest} · Armor ${s.armor.value}` }),
      el("h4", { class: "section", text: "Powers" }),
      el("ul", {}, ...(c.powers || []).map((p) => el("li", { text: R.powerDisplayName(p) }))),
      el("h4", { class: "section", text: "Talents" }),
      el("p", { text: (c.talents || []).map((t) => t.name).join(", ") || "—" }),
      (c.drawbacks || []).length ? el("div", {}, el("h4", { class: "section", text: "Drawbacks" }),
        el("p", { text: c.drawbacks.map((d) => d.name).join(", ") })) : null),
    actions: [{ label: "Close", variant: "ghost" }] });
}

function threatGenerator() {
  const out = el("div", { class: "generator-output" });
  const card = el("section", { class: "card" },
    el("h3", { text: "Random threats" }),
    helpPanel(["The book's threat generators, chained the way the rules chain them.", "Criminal activity rolls a crime, a complication and a reward. City incident rolls a catalyst, incident, location and complication. Global danger rolls a category then that category's own table.", "Rolling here never changes character state."]),
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => { clear(out); out.append(...criminalActivity()); } }, "Criminal activity"),
      el("button", { class: "btn", onclick: () => { clear(out); out.append(...cityIncident()); } }, "City incident"),
      el("button", { class: "btn", onclick: () => { clear(out); out.append(...globalDanger()); } }, "Global danger"),
      el("button", { class: "btn ghost", onclick: () => { clear(out); const r = R.rollNamedTable(D.GM_TABLES.threatRewards); out.append(el("p", {}, el("strong", { text: `Reward (${r.value}): ` }), r.entry.text)); } }, "Threat reward"),
      el("button", { class: "btn ghost", onclick: () => { clear(out); const r = R.rollNamedTable(D.GM_TABLES.socialHooks); out.append(el("p", {}, el("strong", { text: `Social hook (${r.value}): ` }), r.entry.text)); } }, "Social hook")),
    out);
  return card;
}

function line(label, res) { return el("p", {}, el("strong", { text: `${label} (${res.value}): ` }), res.entry.text); }

function criminalActivity() {
  return [
    line("Crime", R.rollNamedTable(D.GM_TABLES.crime)),
    line("Complication", R.rollNamedTable(D.GM_TABLES.crimeComplications)),
    line("Reward", R.rollNamedTable(D.GM_TABLES.threatRewards)),
  ];
}

function cityIncident() {
  return [
    line("Catalyst", R.rollNamedTable(D.GM_TABLES.catalyst)),
    line("Incident", R.rollNamedTable(D.GM_TABLES.incidents)),
    line("Location", R.rollNamedTable(D.GM_TABLES.cityLocations)),
    line("Complication", R.rollNamedTable(D.GM_TABLES.incidentComplications)),
  ];
}

function globalDanger() {
  const cat = R.rollNamedTable(D.GM_TABLES.globalCategory);
  // Match the key case-insensitively: "Extra-dimensional" strips to "Extradimensional", which
  // does not equal the data's globalExtraDimensional, so an exact lookup silently dropped the
  // danger table on 1 category roll in 6 and printed only a category and a complication.
  const want = ("global" + cat.entry.text.replace(/[^a-z]/gi, "")).toLowerCase();
  const key = Object.keys(D.GM_TABLES).find((k) => k.toLowerCase() === want);
  const table = key ? D.GM_TABLES[key] : null;
  const rows = [line("Category", cat)];
  if (table) rows.push(line(table.name, R.rollNamedTable(table)));
  rows.push(line("Complication", R.rollNamedTable(D.GM_TABLES.globalComplications)));
  return rows;
}

function tablesPanel() {
  const card = el("section", { class: "card" }, el("h3", { text: "Rollable tables" }),
    helpPanel(["Every generator table in the core rules, individually rollable.", "Tables with a documented gap in the source re-roll automatically when a roll lands in it."]));
  const tables = [
    ...R.gmTableList(),
    { key: "baseEvents", name: "Base Events", die: "D66", entries: D.BASE_EVENTS.map((e) => ({ range: e.range, text: `${e.name} — ${e.desc}` })) },
    { key: "chase", name: "Chase Obstacles", die: "D66", entries: D.CHASE_OBSTACLES.map((e) => ({ range: e.range, text: `${e.name} — ${e.desc}` })) },
    { key: "component", name: "Vehicle Component Damage", die: "D6", entries: D.COMPONENT_DAMAGE.map((e) => ({ range: [e.roll, e.roll], text: `${e.name} — ${e.desc}` })) },
    { key: "powerSources", name: "Power Sources", die: "D66", entries: D.POWER_SOURCES.map((s) => ({ range: [s.roll, s.roll], text: `${s.name} — ${s.desc}` })) },
    { key: "knowledge", name: "Knowledgeable Subjects", die: "D6", entries: D.KNOWLEDGEABLE_SUBJECTS.map((s) => ({ range: [s.roll, s.roll], text: `${s.name} — ${s.desc}` })) },
  ];
  // Grouped by what each table generates, so thirty-odd chips read as six short rows.
  const GROUPS = [
    ["Criminal activity", ["crime", "crimeComplications", "threatRewards"]],
    ["City incidents", ["catalyst", "incidents", "cityLocations", "incidentComplications"]],
    ["Global dangers", (k) => k.startsWith("global")],
    ["Scenes and the team", ["socialHooks", "baseEvents"]],
    ["Action", ["chase", "component"]],
    ["Heroes", ["powerSources", "knowledge"]],
  ];
  const groupOf = (k) => (GROUPS.find(([, m]) => (typeof m === "function" ? m(k) : m.includes(k))) || ["Other"])[0];
  const rows = new Map();
  for (const t of tables) {
    const g = groupOf(t.key);
    if (!rows.has(g)) rows.set(g, el("div", { class: "chiprow" }));
    rows.get(g).append(el("button", { class: "chip", onclick: () => {
      const res = R.rollNamedTable(t);
      modal({ title: `${t.name} — ${res.value}`,
        body: el("div", {}, el("p", { class: "lede", text: res.entry.text }), t.gap ? el("p", { class: "muted small", text: t.gap }) : null),
        actions: [{ label: "OK", variant: "primary" }] });
    } }, t.name));
  }
  for (const [g] of [...GROUPS, ["Other"]]) {
    if (rows.has(g)) card.append(el("h4", { class: "section", text: g }), rows.get(g));
  }
  card.append(el("details", {}, el("summary", { text: "Critical injury table" }),
    el("table", { class: "data-table" },
      el("tr", {}, el("th", { text: "Roll" }), el("th", { text: "Injury" }), el("th", { text: "Healing" })),
      ...D.CRITICAL_INJURIES.map((c) => el("tr", {}, el("td", { text: String(c.roll) }), el("td", { text: `${c.name} ${c.desc}` }), el("td", { text: c.healing }))))));
  card.append(el("details", {}, el("summary", { text: "Zone terrain (wrecking)" }),
    el("table", { class: "data-table" },
      el("tr", {}, el("th", { text: "Terrain" }), el("th", { text: "Min STRENGTH" }), el("th", { text: "Attack bonus" })),
      ...D.ZONE_TERRAIN.map((t) => el("tr", {}, el("td", { text: t.name }), el("td", { text: String(t.minStrength) }), el("td", { text: `+${t.bonus}` }))))));
  return card;
}

function adversaryPanel() {
  const card = el("section", { class: "card" }, el("h3", { text: "Adversaries & NPCs" }),
    helpPanel(["Stock NPC profiles, animals, published adversaries and hero stat blocks.", "Open one to see its full stat block. Minion groups use a single Health equal to the number of minions."]));
  const search = el("input", { class: "input sticky-search", type: "search", placeholder: "Search NPC profiles, creatures and adversaries…", "aria-label": "Search adversaries and NPCs" });
  const list = el("div", { class: "npc-list" });
  const all = R.compendium();
  // Same filter as the Compendium: one group at a time instead of every stat block at once.
  const groups = ["Adversaries", ...new Set(all.map((n) => n.group).filter((g) => g !== "Adversaries")), "All"];
  const filter = el("div", { class: "segmented", role: "radiogroup", "aria-label": "Show" });
  const drawFilter = () => {
    clear(filter);
    for (const g of groups) {
      filter.append(el("button", { class: `chip ${gmGroup === g ? "selected" : ""}`, role: "radio", type: "button",
        "aria-checked": gmGroup === g ? "true" : "false", onclick: () => { gmGroup = g; drawFilter(); draw(); } }, g));
    }
  };
  const draw = () => {
    clear(list);
    const q = search.value.trim().toLowerCase();
    for (const n of all) {
      if (gmGroup !== "All" && n.group !== gmGroup && !q) continue;
      if (q && !n.name.toLowerCase().includes(q) && !(n.desc || n.descriptor || "").toLowerCase().includes(q)) continue;
      list.append(el("button", { class: "npc-row", "data-group": n.group, onclick: () => showNPC(n) },
        el("span", { class: "npc-avatar" }, icon(iconFor(n.group) || "npcs", { size: 22 })),
        el("div", { class: "npc-main" }, el("strong", { text: n.name }),
          el("p", { class: "muted small", text: `${n.group} · ${n.desc || n.descriptor || ""}` })),
        el("span", { class: "tap-hint", text: "▸" })));
    }
  };
  search.addEventListener("input", draw);
  drawFilter();
  draw();
  card.append(search, filter, list);
  return card;
}
let gmGroup = "Adversaries";

function altBlock(n) {
  const has = n.altAttrs || n.altHealth !== undefined || n.altResolve !== undefined || n.altSlugfest !== undefined;
  if (!has) return null;
  const line = [
    n.altHealth !== undefined ? `Health ${n.altHealth}` : null,
    n.altResolve !== undefined ? `Resolve ${n.altResolve}` : null,
    n.altSlugfest !== undefined ? `Slugfest ${n.altSlugfest}` : null,
  ].filter(Boolean).join(" · ");
  return el("div", { class: "alt-block" },
    el("h4", { class: "section", text: "Alternate form — reduced scores" }),
    n.altAttrs ? el("div", { class: "stat-tiles", role: "img", "aria-label": D.ATTRIBUTES.map((a) => `${a.short} ${n.altAttrs[a.key]}`).join(" · ") },
      ...D.ATTRIBUTES.map((a) => el("span", { class: "stat-tile" },
        el("span", { class: "stat-abbr", text: a.short }), el("span", { class: "stat-val", text: String(n.altAttrs[a.key] ?? "—") })))) : null,
    line ? el("p", { class: "stat-line", text: line }) : null,
    el("p", { class: "muted small", text: "In this form the powers listed below do not apply." }));
}

export function showNPC(n) {
  const attrLine = n.attrs ? D.ATTRIBUTES.map((a) => `${a.short} ${n.attrs[a.key]}`).join(" · ") : "";
  modal({ title: n.name, size: "wide",
    body: el("div", {},
      el("p", { class: "muted", text: n.desc || n.descriptor || "" }),
      n.asOf ? el("p", { class: "muted small", text: `As of: ${n.asOf}` }) : null,
      // The six scores as a stat strip; the same line stays readable to a screen reader.
      attrLine ? el("div", { class: "stat-tiles", role: "img", "aria-label": attrLine },
        ...D.ATTRIBUTES.map((a) => el("span", { class: "stat-tile" },
          el("span", { class: "stat-abbr", text: a.short }), el("span", { class: "stat-val", text: String(n.attrs[a.key] ?? "—") })))) : null,
      el("p", { class: "stat-line", text: [
        n.health !== undefined ? `Health ${n.health}` : null,
        n.resolve !== undefined ? `Resolve ${n.resolve}` : null,
        n.slugfest !== undefined ? `Slugfest ${n.slugfest}` : null,
        // EMANATION replaces the Slugfest bonus rather than adding to it (§3.5), so the book
        // prints it as a second damage value.
        n.slugfestEmanation !== undefined ? `Emanation damage ${n.slugfestEmanation}` : null,
        n.minion ? "Minions — group Health equals their number" : null,
        n.huge ? "Huge creature" : null,
      ].filter(Boolean).join(" · ") }),
      // Profiles with an alternate form print a second block; showing only one hid half the entry.
      altBlock(n),
      n.drive ? el("p", {}, el("strong", { text: "Drive: " }), n.drive) : null,
      n.flaw ? el("p", {}, el("strong", { text: "Flaw: " }), n.flaw) : null,
      n.powerSource ? el("p", {}, el("strong", { text: "Power source: " }), n.powerSource) : null,
      (n.powers || []).length ? el("div", {}, el("h4", { class: "section", text: "Powers" }), el("ul", {}, ...n.powers.map((p) => el("li", { text: p })))) : null,
      (n.traits || []).length ? el("p", {}, el("strong", { text: "Traits: " }), n.traits.join(", ")) : null,
      (n.talents || []).length ? el("p", {}, el("strong", { text: "Talents: " }), n.talents.join(", ")) : null,
      (n.drawbacks || []).length ? el("div", {}, el("h4", { class: "section", text: "Drawbacks" }), el("ul", {}, ...n.drawbacks.map((d) => el("li", { text: d })))) : null,
      (n.special || []).length ? el("div", {}, el("h4", { class: "section", text: "Special abilities" }), el("ul", {}, ...n.special.map((d) => el("li", { text: d })))) : null,
      (n.gear || []).length ? el("p", {}, el("strong", { text: "Gear: " }), n.gear.join(", ")) : null),
    actions: [
      { label: "Close", variant: "ghost" },
      // A stat block you are reading is usually one you are about to fight: put it on the board.
      { label: Store.getCombat()?.active ? "Add to the action scene" : "Start a scene with it", variant: "primary", onClick: () => { addToScene(n); } },
    ] });
}

/** Drop a compendium entry onto the action scene (starting one if none is running) and go there. */
async function addToScene(n) {
  let count = 1;
  if (n.minion) {
    count = Number(await promptModal("How many minions in the group?", { title: n.name, value: "5",
      hints: ["A minion group is one combatant whose Health equals the number of minions — each point of damage takes one down."] })) || 0;
    if (!count) return;
  }
  const combat = Combat.startActionScene();
  const profile = n.group === "Creatures" ? { ...n, slugfest: n.slugfest ?? 2 } : n;
  const cb = Combat.combatantFromProfile(profile, { count });
  if (["Allies", "Heroes", "Hero"].includes(n.group)) cb.side = "ally";
  Combat.joinCombat(combat, cb);
  showToast(`${cb.name} joins the action scene (card #${cb.card}).`, { variant: "good" });
  location.hash = "#/combat";
}
