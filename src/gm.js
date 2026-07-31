// gm.js — the opt-in GM screen: party panel, adversary drop-ins and every rollable table.

import { el, clear, d6 } from "./core.js";
import { modal, showToast, promptModal, chooseModal, helpPanel } from "./ui.js";
import * as R from "./rules.js";
import { D } from "./rules.js";
import * as Derived from "./derived.js";
import * as Store from "./store.js";
import { NPC_PROFILES, CREATURES } from "../data-npcs.js";
import { ADVERSARIES } from "../data-monsters.js";

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
    helpPanel(["Every hero saved on this device, at a glance — vitals, karma, Reputation and armor.", "Peek opens a read-only summary of a hero's attributes, powers, talents and drawbacks."]));
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
      el("button", { class: "btn tiny ghost", onclick: () => peekSheet(c) }, "Peek")));
  }
  if (team) {
    card.append(el("div", { class: "party-row" },
      el("div", {}, el("strong", { text: team.name || "The team" }),
        el("p", { class: "muted small", text: `${team.base?.location || "No base"} · ${(team.base?.upgrades || []).length} upgrade(s)` }))));
  }
  return card;
}

function peekSheet(c) {
  const s = Derived.summary(c);
  modal({ title: c.identity.heroName || "Hero", size: "wide",
    body: el("div", {},
      el("p", { class: "stat-line", text: D.ATTRIBUTES.map((a) => `${a.short} ${s.attributes[a.key]}`).join(" · ") }),
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
  const key = "global" + cat.entry.text.replace(/[^a-z]/gi, "");
  const table = D.GM_TABLES[key];
  const rows = [line("Category", cat)];
  if (table) rows.push(line(table.name, R.rollNamedTable(table)));
  rows.push(line("Complication", R.rollNamedTable(D.GM_TABLES.globalComplications)));
  return rows;
}

function tablesPanel() {
  const card = el("section", { class: "card" }, el("h3", { text: "Rollable tables" }),
    helpPanel(["Every generator table in the core rules, individually rollable.", "Tables with a documented gap in the source re-roll automatically when a roll lands in it."]));
  const row = el("div", { class: "chiprow" });
  const tables = [
    ...R.gmTableList(),
    { key: "baseEvents", name: "Base Events", die: "D66", entries: D.BASE_EVENTS.map((e) => ({ range: e.range, text: `${e.name} — ${e.desc}` })) },
    { key: "chase", name: "Chase Obstacles", die: "D66", entries: D.CHASE_OBSTACLES.map((e) => ({ range: e.range, text: `${e.name} — ${e.desc}` })) },
    { key: "component", name: "Vehicle Component Damage", die: "D6", entries: D.COMPONENT_DAMAGE.map((e) => ({ range: [e.roll, e.roll], text: `${e.name} — ${e.desc}` })) },
    { key: "powerSources", name: "Power Sources", die: "D66", entries: D.POWER_SOURCES.map((s) => ({ range: [s.roll, s.roll], text: `${s.name} — ${s.desc}` })) },
    { key: "knowledge", name: "Knowledgeable Subjects", die: "D6", entries: D.KNOWLEDGEABLE_SUBJECTS.map((s) => ({ range: [s.roll, s.roll], text: `${s.name} — ${s.desc}` })) },
  ];
  for (const t of tables) {
    row.append(el("button", { class: "chip", onclick: () => {
      const res = R.rollNamedTable(t);
      modal({ title: `${t.name} — ${res.value}`,
        body: el("div", {}, el("p", { class: "lede", text: res.entry.text }), t.gap ? el("p", { class: "muted small", text: t.gap }) : null),
        actions: [{ label: "OK", variant: "primary" }] });
    } }, t.name));
  }
  card.append(row);
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
  const search = el("input", { class: "input", type: "search", placeholder: "Search NPC profiles, creatures and adversaries…" });
  const list = el("div", { class: "npc-list" });
  const all = R.compendium();
  const draw = () => {
    clear(list);
    const q = search.value.trim().toLowerCase();
    for (const n of all) {
      if (q && !n.name.toLowerCase().includes(q) && !(n.desc || n.descriptor || "").toLowerCase().includes(q)) continue;
      list.append(el("button", { class: "npc-row", onclick: () => showNPC(n) },
        el("div", {}, el("strong", { text: n.name }),
          el("p", { class: "muted small", text: `${n.group} · ${n.desc || n.descriptor || ""}` })),
        el("span", { class: "tap-hint", text: "▸" })));
    }
  };
  search.addEventListener("input", draw);
  draw();
  card.append(search, list);
  return card;
}

export function showNPC(n) {
  const attrLine = n.attrs ? D.ATTRIBUTES.map((a) => `${a.short} ${n.attrs[a.key]}`).join(" · ") : "";
  modal({ title: n.name, size: "wide",
    body: el("div", {},
      el("p", { class: "muted", text: n.desc || n.descriptor || "" }),
      n.asOf ? el("p", { class: "muted small", text: `As of: ${n.asOf}` }) : null,
      attrLine ? el("p", { class: "stat-line", text: attrLine }) : null,
      el("p", { class: "stat-line", text: [
        n.health !== undefined ? `Health ${n.health}` : null,
        n.resolve !== undefined ? `Resolve ${n.resolve}` : null,
        n.slugfest !== undefined ? `Slugfest ${n.slugfest}` : null,
        n.minion ? "Minions — group Health equals their number" : null,
        n.huge ? "Huge creature" : null,
      ].filter(Boolean).join(" · ") }),
      n.drive ? el("p", {}, el("strong", { text: "Drive: " }), n.drive) : null,
      n.flaw ? el("p", {}, el("strong", { text: "Flaw: " }), n.flaw) : null,
      n.powerSource ? el("p", {}, el("strong", { text: "Power source: " }), n.powerSource) : null,
      (n.powers || []).length ? el("div", {}, el("h4", { class: "section", text: "Powers" }), el("ul", {}, ...n.powers.map((p) => el("li", { text: p })))) : null,
      (n.traits || []).length ? el("p", {}, el("strong", { text: "Traits: " }), n.traits.join(", ")) : null,
      (n.talents || []).length ? el("p", {}, el("strong", { text: "Talents: " }), n.talents.join(", ")) : null,
      (n.drawbacks || []).length ? el("div", {}, el("h4", { class: "section", text: "Drawbacks" }), el("ul", {}, ...n.drawbacks.map((d) => el("li", { text: d })))) : null,
      (n.special || []).length ? el("div", {}, el("h4", { class: "section", text: "Special abilities" }), el("ul", {}, ...n.special.map((d) => el("li", { text: d })))) : null,
      (n.gear || []).length ? el("p", {}, el("strong", { text: "Gear: " }), n.gear.join(", ")) : null),
    actions: [{ label: "Close", variant: "ghost" }] });
}
