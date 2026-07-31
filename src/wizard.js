// wizard.js — character creation (14 steps, Ch.2), the team wizard (Ch.7) and pregen instantiation.

import { el, clear, d3, d6, d66, clamp, uid, deepClone } from "./core.js";
import { modal, showToast, confirmModal, chooseModal, announce, selectField } from "./ui.js";
import * as R from "./rules.js";
import { D } from "./rules.js";
import * as Derived from "./derived.js";
import { blankCharacter, normalizeCharacter, creationBudget, validateCharacter, maxHealth, maxResolve, ATTR_KEYS } from "./derived.js";
import * as Store from "./store.js";
import { PREGENS } from "../data-pregens.js";

const STEPS = [
  "Rank", "Archetype & Role", "Attributes", "Powers", "Power sources",
  "Talents & Drawbacks", "Occupation", "Personality", "Names & Team",
];

let draft = null;
let step = 0;
let host = null;

export function startWizard(mount, { fromPregen = null } = {}) {
  host = mount;
  draft = fromPregen ? pregenToCharacter(fromPregen) : blankCharacter();
  step = fromPregen ? STEPS.length - 1 : 0;
  render();
}

export function isActive() { return !!draft; }

function render() {
  if (!host) return;
  clear(host);
  const budget = creationBudget(draft);
  host.append(
    el("div", { class: "wizard" },
      el("div", { class: "wizard-steps", role: "list" },
        ...STEPS.map((s, i) => el("button", {
          class: `wizard-step ${i === step ? "current" : ""} ${i < step ? "done" : ""}`,
          role: "listitem", "aria-current": i === step ? "step" : null,
          onclick: () => { step = i; render(); },
        }, `${i + 1}. ${s}`))),
      el("div", { class: "wizard-body" }, renderStep(budget)),
      el("div", { class: "wizard-nav" },
        el("button", { class: "btn ghost", disabled: step === 0, onclick: () => { step = Math.max(0, step - 1); render(); } }, "Back"),
        el("span", { class: "budget", text: `${budget.remaining} attribute point${budget.remaining === 1 ? "" : "s"} left · ${budget.powerSlots}/${budget.rank.powers} power slots` }),
        step < STEPS.length - 1
          ? el("button", { class: "btn primary", onclick: () => { step = Math.min(STEPS.length - 1, step + 1); render(); } }, "Next")
          : el("button", { class: "btn primary", onclick: finish }, "Create hero"))));
}

function renderStep(budget) {
  switch (step) {
    case 0: return stepRank();
    case 1: return stepArchetype();
    case 2: return stepAttributes(budget);
    case 3: return stepPowers(budget);
    case 4: return stepSources();
    case 5: return stepTalents();
    case 6: return stepOccupation();
    case 7: return stepPersonality();
    default: return stepFinish();
  }
}

/* ---------------------------------------------------------------- step 1: rank */

function stepRank() {
  const wrap = el("div", {});
  wrap.append(el("p", { class: "lede", text: "Your rank sets your attribute points, your maximum score, how many powers you start with and your Reputation. Decide it with the group — Global Guardian is the default." }));
  for (const rank of D.RANKS) {
    wrap.append(el("button", {
      class: `card selectable ${draft.identity.rank === rank.key ? "selected" : ""}`,
      onclick: () => { draft.identity.rank = rank.key; render(); },
    },
      el("h3", { text: rank.name }),
      el("p", { text: rank.desc }),
      el("p", { class: "stat-line", text: `${rank.points} attribute points · max ${rank.attrMax} · ${rank.powers} powers · Reputation ${rank.reputation} · ${rank.baseUpgrades} base upgrade${rank.baseUpgrades === 1 ? "" : "s"}` })));
  }
  return wrap;
}

/* ---------------------------------------------------------------- step 2: archetype */

function stepArchetype() {
  const wrap = el("div", {});
  wrap.append(el("p", { class: "lede", text: "An archetype is an optional template you customise freely. All sixteen from the rulebook are here — building from scratch is always legal too." }));
  wrap.append(selectField("Archetype",
    [{ value: "", label: "No archetype — build from scratch" },
      ...D.ARCHETYPES.map((a) => ({ value: a.name, label: a.name, hint: a.role }))],
    draft.identity.archetype,
    (v) => {
      if (!v) { draft.identity.archetype = ""; render(); return; }
      const a = R.findArchetype(v);
      if (a) applyArchetype(a);
      render();
    }));

  const chosen = R.findArchetype(draft.identity.archetype);
  if (chosen) {
    wrap.append(el("div", { class: "card tight" },
      el("p", { text: chosen.blurb }),
      el("p", { class: "stat-line", text: `Role: ${chosen.role}` }),
      el("p", { class: "stat-line", text: `Suggested powers: ${chosen.powers.join(", ")}` }),
      el("p", { class: "muted small", text: "Selecting an archetype fills your attributes and powers with its suggestions — change any of them freely in the next steps." })));
  } else {
    wrap.append(el("p", { class: "muted small", text: "Building from scratch: choose your role, attributes, powers and talents freely." }));
  }

  wrap.append(selectField("Role", D.ROLES.map((r) => ({ value: r.name, label: r.name, hint: r.desc })),
    draft.identity.role, (v) => { draft.identity.role = v; render(); }, { placeholder: "Choose a role…" }));
  return wrap;
}

function applyArchetype(a) {
  draft.identity.archetype = a.name;
  draft.identity.role = a.role;
  const rank = R.findRank(draft.identity.rank);
  // Suggested arrays are tuned for Global Guardian; re-point proportionally for other ranks.
  const suggested = { ...a.attributes };
  const total = ATTR_KEYS.reduce((n, k) => n + suggested[k], 0);
  const target = rank.points;
  const scaled = {};
  for (const k of ATTR_KEYS) scaled[k] = clamp(Math.max(1, Math.round(suggested[k] * target / total)), 1, rank.attrMax);
  balanceTo(scaled, target, rank.attrMax);
  draft.attributes = scaled;
  draft.powers = a.powers.slice(0, rank.powers).map((p) => {
    const parsed = R.parsePowerRef(p);
    return { name: parsed.name, level: parsed.level || 0, boosts: parsed.boost ? [parsed.boost] : [], limits: [], note: parsed.note || "" };
  });
  draft.identity.reputationBase = rank.reputation;
}

function balanceTo(attrs, target, max) {
  let total = ATTR_KEYS.reduce((n, k) => n + attrs[k], 0);
  let guard = 200;
  while (total !== target && guard-- > 0) {
    const keys = ATTR_KEYS.slice().sort((a, b) => attrs[b] - attrs[a]);
    if (total > target) {
      const k = keys.find((k2) => attrs[k2] > 1);
      if (!k) break;
      attrs[k] -= 1; total -= 1;
    } else {
      const k = keys.reverse().find((k2) => attrs[k2] < max);
      if (!k) break;
      attrs[k] += 1; total += 1;
    }
  }
}

/* ---------------------------------------------------------------- step 3: attributes */

function stepAttributes(budget) {
  const wrap = el("div", {});
  const rank = budget.rank;
  wrap.append(el("p", { class: "lede", text: `Spend ${rank.points} points, nothing above ${rank.attrMax}. Trade 2 points for an extra power, gain 2 for each power you give up (minimum one), pay 1 point per extra talent or power source, and gain 1 point per drawback (maximum two).` }));

  const left = budget.remaining;
  wrap.append(el("p", { class: left > 0 ? "stat-line" : left === 0 ? "good" : "bad",
    text: left >= 0 ? `${left} point${left === 1 ? "" : "s"} left to spend.`
      : `Over budget by ${-left} point(s) — raise a power/talent trade or lower a score.` }));

  for (const attr of D.ATTRIBUTES) {
    const v = draft.attributes[attr.key];
    // A score may only rise while points remain: the budget can never be overspent (§3.4).
    const atMax = v >= rank.attrMax;
    const noPoints = left <= 0;
    wrap.append(el("div", { class: "attr-row" },
      el("div", { class: "attr-name" }, el("strong", { text: attr.name }), el("span", { class: "muted", text: attr.desc })),
      el("div", { class: "stepper" },
        el("button", { class: "icon-btn", disabled: v <= 1, "aria-label": `Decrease ${attr.name}`,
          onclick: () => { draft.attributes[attr.key] = Math.max(1, v - 1); render(); } }, "−"),
        el("span", { class: "attr-value", text: `${v}` }),
        el("button", {
          class: "icon-btn", disabled: atMax || noPoints,
          "aria-label": `Increase ${attr.name}`,
          title: atMax ? `${rank.name} caps attributes at ${rank.attrMax}.` : noPoints ? "No attribute points left." : null,
          onclick: () => {
            if (atMax) { showToast(`${rank.name} caps attributes at ${rank.attrMax}.`, { variant: "warn" }); return; }
            if (noPoints) { showToast("No points left. Lower another score, add a drawback, or give up a power.", { variant: "warn", timeout: 5000 }); return; }
            draft.attributes[attr.key] = v + 1;
            render();
          },
        }, "+")),
      el("span", { class: "score-desc", text: D.SCORE_DESCRIPTIONS[v] })));
  }

  const c = normalizeCharacter(draft);
  wrap.append(el("div", { class: "derived-preview" },
    el("span", { text: `Health ${maxHealth(c)}` }),
    el("span", { text: `Resolve ${maxResolve(c)}` }),
    el("span", { text: `Slugfest Damage ${Derived.slugfestDamage(c)}` }),
    el("span", { text: `Lift ${Derived.liftLimit(c)}` })));
  return wrap;
}

/* ---------------------------------------------------------------- step 4: powers */

function stepPowers(budget) {
  const wrap = el("div", {});
  wrap.append(el("p", { class: "lede", text: `Power slots used: ${budget.powerSlots} of ${budget.rank.powers}. Each level above basic and each boost costs a slot; a limit is free and either raises the level one step or grants a boost for that power. Massive powers need Cosmic Champion rank; Monstrous is never available at creation.` }));

  const chosen = el("div", { class: "chosen-list" });
  draft.powers.forEach((p, i) => {
    const def = R.findPower(p.name);
    chosen.append(el("div", { class: "chosen" },
      el("div", {},
        el("strong", { text: R.powerDisplayName(p) }),
        def ? el("p", { class: "muted small", text: def.summary }) : el("p", { class: "warn small", text: "Not in the rules library." }),
        (p.boosts || []).length ? el("p", { class: "small", text: `Boosts: ${p.boosts.join(", ")}` }) : null,
        (p.limits || []).length ? el("p", { class: "small", text: `Limits: ${p.limits.join(", ")}` }) : null),
      el("div", { class: "chosen-actions" },
        def && def.levels ? el("button", { class: "btn tiny", onclick: () => cyclePowerLevel(i) }, "Level") : null,
        def && (def.boosts || []).length ? el("button", { class: "btn tiny", onclick: () => pickBoost(i) }, "Boost") : null,
        def && (def.limits || []).length ? el("button", { class: "btn tiny", onclick: () => pickLimit(i) }, "Limit") : null,
        el("button", { class: "btn tiny danger", onclick: () => { draft.powers.splice(i, 1); render(); } }, "Remove"))));
  });
  wrap.append(chosen);

  const search = el("input", { class: "input", type: "search", placeholder: "Search 69 powers…", oninput: () => renderList(search.value) });
  wrap.append(search);
  const list = el("div", { class: "power-picker" });
  wrap.append(list);

  function renderList(q = "") {
    clear(list);
    const needle = q.trim().toLowerCase();
    const byType = R.powersByType();
    for (const [type, powers] of Object.entries(byType)) {
      const matches = powers.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.summary.toLowerCase().includes(needle));
      if (!matches.length) continue;
      list.append(el("h4", { class: "section", text: `${type} (${matches.length})` }));
      for (const p of matches) {
        list.append(el("button", { class: "power-option", onclick: () => addPower(p) },
          el("strong", { text: p.name }), el("span", { class: "muted small", text: p.summary.slice(0, 110) + (p.summary.length > 110 ? "…" : "") })));
      }
    }
  }
  renderList();
  return wrap;
}

function addPower(def) {
  if (draft.powers.some((p) => p.name === def.name)) { showToast(`${def.name} is already chosen.`, { variant: "warn" }); return; }
  draft.powers.push({ name: def.name, level: 0, boosts: [], limits: [], note: "" });
  render();
}

function cyclePowerLevel(i) {
  const p = draft.powers[i];
  const def = R.findPower(p.name);
  const maxLevel = def.levels ? def.levels.length - 1 : 0;
  p.level = (p.level || 0) >= maxLevel ? 0 : (p.level || 0) + 1;
  render();
}

async function pickBoost(i) {
  const p = draft.powers[i];
  const def = R.findPower(p.name);
  const choice = await chooseModal(`${def.name} — boosts (each costs a power slot)`,
    def.boosts.map((b) => ({ label: b.name, hint: b.desc, value: b.name })));
  if (!choice) return;
  p.boosts = p.boosts || [];
  if (p.boosts.includes(choice)) p.boosts = p.boosts.filter((b) => b !== choice);
  else p.boosts.push(choice);
  render();
}

async function pickLimit(i) {
  const p = draft.powers[i];
  const def = R.findPower(p.name);
  const choice = await chooseModal(`${def.name} — limits (free; each pays for one level or one boost)`,
    def.limits.map((l) => ({ label: l.name, hint: l.desc, value: l.name })));
  if (!choice) return;
  p.limits = p.limits || [];
  if (p.limits.includes(choice)) p.limits = p.limits.filter((l) => l !== choice);
  else p.limits.push(choice);
  render();
}

/* ---------------------------------------------------------------- step 5: power sources */

function stepSources() {
  const wrap = el("div", {});
  wrap.append(el("p", { class: "lede", text: "Where your powers come from. Each source beyond the first costs 1 attribute point, but keeps some powers alive if another source is lost." }));
  const arche = R.findArchetype(draft.identity.archetype);
  const current = draft.identity.powerSources || [];

  if (arche) {
    wrap.append(el("h4", { class: "section", text: `${arche.name} suggestions` }));
    const row = el("div", { class: "chiprow" });
    arche.sources.forEach((s) => row.append(el("button", { class: `chip selectable ${current.includes(s) ? "selected" : ""}`, onclick: () => toggleSource(s) }, s)));
    row.append(el("button", { class: "chip", onclick: () => { toggleSource(arche.sources[d3() - 1]); } }, "Roll D3"));
    wrap.append(row);
  }

  if (current.length) {
    wrap.append(el("h4", { class: "section", text: `Chosen (${current.length})` }));
    wrap.append(el("div", { class: "chiprow" }, ...current.map((s) =>
      el("button", { class: "chip selectable selected", title: "Remove", onclick: () => toggleSource(s) }, `${s} ✕`))));
  }

  wrap.append(selectField("Add a power source (D66 table)",
    D.POWER_SOURCES.filter((s) => !current.includes(s.name))
      .map((s) => ({ value: s.name, label: `${s.roll} ${s.name}`, hint: s.desc })),
    "", (v) => { if (v) toggleSource(v); }, { placeholder: "Choose a source…" }));

  const picked = D.POWER_SOURCES.find((s) => current.includes(s.name));
  if (picked) wrap.append(el("p", { class: "muted small", text: picked.desc }));

  wrap.append(el("div", { class: "row-actions" },
    el("button", { class: "btn", onclick: () => {
      const v = d66();
      const hit = D.POWER_SOURCES.find((s) => s.roll === v);
      if (hit) { toggleSource(hit.name); showToast(`Rolled ${v}: ${hit.name}`); }
    } }, "Roll D66"),
    el("button", { class: "btn ghost", onclick: async () => {
      const own = await import("./ui.js").then((m) => m.promptModal("Describe your own power source.", { title: "Custom power source" }));
      if (own) toggleSource(own);
    } }, "Add your own")));
  return wrap;
}

function toggleSource(name) {
  const list = draft.identity.powerSources || (draft.identity.powerSources = []);
  const i = list.indexOf(name);
  if (i >= 0) list.splice(i, 1); else list.push(name);
  render();
}

/* ---------------------------------------------------------------- step 6: talents & drawbacks */

function stepTalents() {
  const wrap = el("div", {});
  const arche = R.findArchetype(draft.identity.archetype);
  const occ = R.findOccupation(draft.identity.occupation);
  wrap.append(el("p", { class: "lede", text: "You get two free talents: one hero talent and one occupation talent. Extra talents cost 1 attribute point each. Drawbacks give 1 attribute point each, maximum two." }));

  if (arche) {
    wrap.append(el("h4", { class: "section", text: `Hero talents — ${arche.name} (D6)` }));
    wrap.append(talentRow(arche.talents, () => arche.talents[d6() - 1]));
  } else {
    wrap.append(el("h4", { class: "section", text: "Hero talent — free choice" }));
  }
  if (occ) {
    wrap.append(el("h4", { class: "section", text: `Occupation talents — ${occ.name} (D3)` }));
    wrap.append(talentRow(occ.talents, () => occ.talents[d3() - 1]));
  }

  wrap.append(el("h4", { class: "section", text: `All talents (${D.TALENTS.length})` }));
  const search = el("input", { class: "input", type: "search", placeholder: "Search talents…", oninput: () => renderAll(search.value) });
  wrap.append(search);
  const all = el("div", { class: "talent-picker" });
  wrap.append(all);
  function renderAll(q = "") {
    clear(all);
    const needle = q.trim().toLowerCase();
    for (const t of D.TALENTS) {
      if (needle && !t.name.toLowerCase().includes(needle) && !t.desc.toLowerCase().includes(needle)) continue;
      const taken = (draft.talents || []).filter((x) => R.findTalent(x.name)?.name === t.name).length;
      all.append(el("button", { class: `talent-option ${taken ? "selected" : ""}`, onclick: () => toggleTalent(t.name) },
        el("strong", { text: t.name + (taken > 1 ? ` ×${taken}` : "") }), el("span", { class: "muted small", text: t.desc })));
    }
  }
  renderAll();

  wrap.append(el("h4", { class: "section", text: "Drawbacks" }));
  const dgrid = el("div", { class: "source-grid" });
  const dsource = arche ? D.DRAWBACKS.filter((d) => arche.drawbacks.includes(d.name)) : D.DRAWBACKS;
  for (const d of dsource) {
    const taken = (draft.drawbacks || []).some((x) => x.name === d.name);
    dgrid.append(el("button", { class: `card selectable tight ${taken ? "selected" : ""}`, onclick: () => toggleDrawback(d) },
      el("strong", { text: d.name }), el("p", { class: "muted small", text: d.desc })));
  }
  wrap.append(dgrid);
  if (arche) wrap.append(el("button", { class: "btn ghost", onclick: () => { draft.identity.archetype = draft.identity.archetype; showAllDrawbacks(wrap); } }, "Show every drawback"));
  return wrap;

  function talentRow(names, roller) {
    const row = el("div", { class: "chiprow" });
    names.forEach((n) => {
      const has = (draft.talents || []).some((t) => t.name === n);
      row.append(el("button", { class: `chip selectable ${has ? "selected" : ""}`, onclick: () => toggleTalent(n) }, n));
    });
    row.append(el("button", { class: "chip", onclick: () => { const pick = roller(); toggleTalent(pick); showToast(`Rolled: ${pick}`); } }, "Roll"));
    return row;
  }
}

function showAllDrawbacks(wrap) {
  const grid = el("div", { class: "source-grid" });
  for (const d of D.DRAWBACKS) {
    const taken = (draft.drawbacks || []).some((x) => x.name === d.name);
    grid.append(el("button", { class: `card selectable tight ${taken ? "selected" : ""}`, onclick: () => toggleDrawback(d) },
      el("strong", { text: d.name }), el("p", { class: "muted small", text: d.desc })));
  }
  wrap.append(grid);
}

function toggleTalent(name) {
  draft.talents = draft.talents || [];
  const def = R.findTalent(name);
  const existing = draft.talents.filter((t) => R.findTalent(t.name)?.name === (def?.name || name));
  const max = def?.maxRanks || 1;
  if (existing.length && existing.length >= max) {
    draft.talents = draft.talents.filter((t) => R.findTalent(t.name)?.name !== (def?.name || name));
  } else {
    draft.talents.push({ name, rank: 1 });
  }
  render();
}

function toggleDrawback(d) {
  draft.drawbacks = draft.drawbacks || [];
  const i = draft.drawbacks.findIndex((x) => x.name === d.name);
  if (i >= 0) draft.drawbacks.splice(i, 1);
  else {
    if (draft.drawbacks.length >= D.CREATION_TRADES.maxDrawbacks) {
      showToast(`You cannot start with more than ${D.CREATION_TRADES.maxDrawbacks} drawbacks.`, { variant: "warn" });
      return;
    }
    draft.drawbacks.push({ name: d.name, detail: "" });
  }
  render();
}

/* ---------------------------------------------------------------- step 7: occupation */

function stepOccupation() {
  const wrap = el("div", {});
  const arche = R.findArchetype(draft.identity.archetype);
  wrap.append(el("p", { class: "lede", text: "Your occupation sets your Resources score, gives an occupation talent and suggests a key relationship." }));
  const suggested = arche ? arche.occupations : null;
  if (suggested) {
    wrap.append(el("h4", { class: "section", text: `${arche.name} suggestions (D3)` }));
    const row = el("div", { class: "chiprow" });
    suggested.forEach((o) => row.append(el("button", { class: `chip selectable ${draft.identity.occupation === o ? "selected" : ""}`, onclick: () => selectOccupation(o) }, o)));
    row.append(el("button", { class: "chip", onclick: () => selectOccupation(suggested[d3() - 1]) }, "Roll D3"));
    wrap.append(row);
  }
  wrap.append(selectField("Occupation",
    D.OCCUPATIONS.map((o) => ({ value: o.name, label: o.name, hint: `Resources ${o.resources}` })),
    draft.identity.occupation, (v) => selectOccupation(v), { placeholder: "Choose an occupation…" }));

  const occ = R.findOccupation(draft.identity.occupation);
  if (occ) {
    wrap.append(el("div", { class: "card tight" },
      el("p", { text: occ.desc }),
      el("p", { class: "stat-line", text: `Resources ${occ.resources} — ${D.STANDARD_OF_LIVING[occ.resources]}` }),
      el("p", { class: "stat-line", text: `Occupation talents (D3): ${occ.talents.join(" / ")}` })));
  }

  if (occ) {
    wrap.append(el("h4", { class: "section", text: "Key relationship (D3)" }));
    const row = el("div", { class: "chiprow" });
    occ.relationships.forEach((rel) => {
      const has = (draft.identity.keyRelationships || []).some((k) => k.text === rel);
      row.append(el("button", { class: `chip selectable ${has ? "selected" : ""}`, onclick: () => toggleRelationship(rel) }, rel.split(".")[0]));
    });
    row.append(el("button", { class: "chip", onclick: () => toggleRelationship(occ.relationships[d3() - 1]) }, "Roll D3"));
    wrap.append(row);
    wrap.append(el("div", { class: "hooks" }, el("strong", { text: "Social scene hooks: " }), el("span", { text: occ.hooks.join(" · ") })));
  }
  return wrap;
}

function selectOccupation(name) {
  draft.identity.occupation = name;
  const occ = R.findOccupation(name);
  if (occ) draft.identity.resourcesBase = occ.resources;
  render();
}

function toggleRelationship(text) {
  const list = draft.identity.keyRelationships || (draft.identity.keyRelationships = []);
  const i = list.findIndex((k) => k.text === text);
  if (i >= 0) list.splice(i, 1);
  else if (list.length < 2) list.push({ name: "", text });
  else showToast("You already have two key relationships.", { variant: "warn" });
  render();
}

/* ---------------------------------------------------------------- step 8: personality */

function stepPersonality() {
  const wrap = el("div", {});
  const arche = R.findArchetype(draft.identity.archetype);
  wrap.append(el("p", { class: "lede", text: "Personality (two traits), drive and flaw. Playing to each of them earns karma at the end of the session; overcoming your flaw earns two and removes it." }));

  if (arche) {
    const traits = draft.identity.personality || [];
    const opts = arche.personality.map((p) => ({ value: p, label: p }));
    wrap.append(selectField("Personality trait 1 (D6)", opts, traits[0] || "",
      (v) => { setTrait(0, v); }, { placeholder: "Choose a trait…" }));
    wrap.append(selectField("Personality trait 2 (D6)", opts, traits[1] || "",
      (v) => { setTrait(1, v); }, { placeholder: "Choose a trait…" }));
    wrap.append(el("button", { class: "btn ghost", onclick: () => {
      setTrait(0, arche.personality[d6() - 1]);
      let second = arche.personality[d6() - 1];
      if (second === draft.identity.personality[0]) second = arche.personality[(arche.personality.indexOf(second) + 1) % arche.personality.length];
      setTrait(1, second);
    } }, "Roll both (D6 ×2)"));

    wrap.append(selectField("Drive (D3)", arche.drives.map((d) => ({ value: d, label: d })),
      draft.identity.drive, (v) => { draft.identity.drive = v; render(); }, { placeholder: "Choose a drive…" }));
    wrap.append(el("button", { class: "btn ghost", onclick: () => { draft.identity.drive = arche.drives[d3() - 1]; render(); } }, "Roll D3"));

    wrap.append(selectField("Flaw (D3)", arche.flaws.map((f) => ({ value: f, label: f })),
      draft.identity.flaw, (v) => { draft.identity.flaw = v; render(); }, { placeholder: "Choose a flaw…" }));
    wrap.append(el("button", { class: "btn ghost", onclick: () => { draft.identity.flaw = arche.flaws[d3() - 1]; render(); } }, "Roll D3"));
  }

  wrap.append(el("h4", { class: "section", text: "Or write your own" }));
  wrap.append(field("Personality (comma separated)", (draft.identity.personality || []).join(", "), (v) => { draft.identity.personality = v.split(",").map((s) => s.trim()).filter(Boolean); }));
  wrap.append(field("Drive", draft.identity.drive, (v) => { draft.identity.drive = v; }));
  wrap.append(field("Flaw", draft.identity.flaw, (v) => { draft.identity.flaw = v; }));
  return wrap;
}

/** Set one of the two personality slots without letting the same trait fill both. */
function setTrait(index, value) {
  const list = draft.identity.personality || (draft.identity.personality = []);
  const other = list[1 - index];
  if (value && value === other) { showToast("Pick two different traits.", { variant: "warn" }); return; }
  if (value) list[index] = value; else list.splice(index, 1);
  draft.identity.personality = list.filter(Boolean).slice(0, 2);
  render();
}

function togglePersonality(p) {
  const list = draft.identity.personality || (draft.identity.personality = []);
  const i = list.indexOf(p);
  if (i >= 0) list.splice(i, 1);
  else if (list.length < 2) list.push(p);
  else { list.shift(); list.push(p); }
  render();
}

/* ---------------------------------------------------------------- step 9: names & finish */

function stepFinish() {
  const wrap = el("div", {});
  const arche = R.findArchetype(draft.identity.archetype);
  wrap.append(field("Real name", draft.identity.realName, (v) => { draft.identity.realName = v; }));
  wrap.append(field("Hero name", draft.identity.heroName, (v) => { draft.identity.heroName = v; }));
  if (arche) {
    wrap.append(selectField(`Suggested hero names — ${arche.name} (D3)`,
      arche.names.map((n) => ({ value: n, label: n })), draft.identity.heroName,
      (v) => { draft.identity.heroName = v; render(); }, { placeholder: "Choose a suggested name…" }));
    wrap.append(el("button", { class: "btn ghost", onclick: () => { draft.identity.heroName = arche.names[d3() - 1]; render(); } }, "Roll D3"));
  }
  wrap.append(field("Appearance", draft.identity.appearance, (v) => { draft.identity.appearance = v; }, true));
  wrap.append(el("label", { class: "check" },
    el("input", { type: "checkbox", checked: draft.identity.identitySecret, onchange: (e) => { draft.identity.identitySecret = e.target.checked; } }),
    " Secret identity"));

  const v = validateCharacter(normalizeCharacter(draft));
  const report = el("div", { class: "validation" });
  if (v.errors.length) report.append(el("h4", { class: "bad", text: "Not legal yet" }), el("ul", {}, ...v.errors.map((e) => el("li", { text: e }))));
  if (v.warnings.length) report.append(el("h4", { class: "warn", text: "Warnings" }), el("ul", {}, ...v.warnings.map((e) => el("li", { text: e }))));
  if (!v.errors.length && !v.warnings.length) report.append(el("p", { class: "good", text: "Legal build — ready to play." }));
  wrap.append(report);
  return wrap;
}

function field(label, value, onInput, multiline = false) {
  const input = multiline ? el("textarea", { class: "input", rows: 3 }) : el("input", { class: "input", type: "text" });
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  return el("label", { class: "field" }, el("span", { text: label }), input);
}

async function finish() {
  const c = normalizeCharacter(draft);
  const v = validateCharacter(c);
  if (v.errors.length) {
    const go = await confirmModal(`This build has ${v.errors.length} rules problem(s):\n\n${v.errors.join("\n")}\n\nSave anyway?`, { title: "Illegal build", confirmLabel: "Save anyway", variant: "warn" });
    if (!go) return;
  }
  c.state.health = maxHealth(c);
  c.state.resolve = maxResolve(c);
  const saved = Store.saveCharacter(c);
  Store.setActiveCharacter(saved.id);
  draft = null;
  announce(`${saved.identity.heroName || "Your hero"} created.`);
  showToast(`${saved.identity.heroName || "Hero"} created.`, { variant: "good" });
  location.hash = "#/sheet";
}

/* ---------------------------------------------------------------- pregens */

export function pregenToCharacter(p) {
  const c = blankCharacter();
  c.identity = {
    ...c.identity,
    realName: "", heroName: p.name, rank: "global", role: p.role || "", archetype: "", occupation: p.occupation || "",
    powerSources: p.powerSource ? [p.powerSource] : [], personality: p.personality || [],
    drive: p.drive || "", flaw: p.flaw || "", appearance: p.descriptor || "",
    keyRelationships: [], identitySecret: true, pregen: true,
    reputationBase: p.reputation ?? 0, resourcesBase: p.resources ?? 3,
  };
  c.attributes = { ...p.attrs };
  c.altAttributes = p.altAttrs || null;
  c.powers = (p.powers || []).map((s) => {
    const parsed = R.parsePowerRef(s.split(" (")[0].split(" — ")[0]);
    const boosts = [...String(s).matchAll(/Boosts?:\s*([^;)]+)/g)].flatMap((m) => m[1].split(",").map((x) => x.trim()));
    const limits = [...String(s).matchAll(/Limits?:\s*([^;)]+)/g)].flatMap((m) => m[1].split(",").map((x) => x.trim()));
    return { name: parsed.name, level: parsed.level || 0, boosts, limits, note: s };
  });
  c.talents = (p.talents || []).map((t) => {
    const m = String(t).match(/^(.*?)\s*×\s*(\d+)$/);
    return m ? { name: m[1].trim(), rank: Number(m[2]) } : { name: t, rank: 1 };
  });
  c.drawbacks = (p.drawbacks || []).map((d) => ({ name: String(d).split(":")[0].trim(), detail: String(d) }));
  c.publishedMax = { health: p.health, resolve: p.resolve, slugfest: p.slugfest };
  c.state.health = p.health;
  c.state.resolve = p.resolve;
  c.notes = p.special ? p.special.join("\n\n") : "";
  return c;
}

export async function instantiatePregen(p) {
  const c = pregenToCharacter(p);
  const saved = Store.saveCharacter(c);
  Store.setActiveCharacter(saved.id);
  showToast(`${p.name} added as a playable hero (published stat block).`, { variant: "good" });
  location.hash = "#/sheet";
  return saved;
}

export function listPregens() { return PREGENS; }

/* ---------------------------------------------------------------- team wizard */

export function openTeamWizard(onDone) {
  const team = Store.getTeam() || Store.blankTeam();
  const rank = R.findRank(team.rank || Store.activeCharacter()?.identity?.rank || "global");
  team.rank = rank.key;

  const body = el("div", { class: "team-wizard" });
  const render2 = () => {
    clear(body);
    body.append(
      field("Team name", team.name, (v) => { team.name = v; }),
      el("div", { class: "chiprow" }, ...D.TEAM_NAME_SUGGESTIONS.map((n) => el("button", { class: "chip", onclick: () => { team.name = n; render2(); } }, n))),
      field("Purpose", team.purpose, (v) => { team.purpose = v; }, true),
      field("Background", team.background, (v) => { team.background = v; }, true),
      el("h4", { class: "section", text: `Base — ${rank.name} sample locations` }),
      el("div", { class: "chiprow" }, ...rank.baseLocations.map((l) => el("button", { class: `chip selectable ${team.base.location === l ? "selected" : ""}`, onclick: () => { team.base.location = l; render2(); } }, l))),
      field("Base location", team.base.location, (v) => { team.base.location = v; }),
      field("Base description", team.base.description, (v) => { team.base.description = v; }, true),
      el("h4", { class: "section", text: `Starting upgrades — ${rank.baseUpgrades} at ${rank.name} rank (${(team.base.upgrades || []).length} chosen)` }),
      el("p", { class: "muted small", text: "Recommended for a new team: Concealment, Team Vehicle, Training Facilities." }),
      upgradeGrid(),
      el("h4", { class: "section", text: "Session zero questions" }),
      el("ul", { class: "muted" }, ...D.TEAM_QUESTIONS.sessionZero.map((q) => el("li", { text: q }))));
  };

  function upgradeGrid() {
    const grid = el("div", { class: "source-grid" });
    for (const u of D.BASE_UPGRADES) {
      const have = (team.base.upgrades || []).filter((x) => x.name === u.name).length;
      grid.append(el("button", { class: `card selectable tight ${have ? "selected" : ""}`, onclick: () => {
        team.base.upgrades = team.base.upgrades || [];
        const i = team.base.upgrades.findIndex((x) => x.name === u.name);
        if (i >= 0 && have >= (u.repeat || 1)) team.base.upgrades = team.base.upgrades.filter((x) => x.name !== u.name);
        else if (have < (u.repeat || 1)) team.base.upgrades.push({ name: u.name, at: Date.now() });
        else team.base.upgrades = team.base.upgrades.filter((x) => x.name !== u.name);
        render2();
      } },
        el("strong", { text: u.name + (have > 1 ? ` ×${have}` : "") }),
        el("p", { class: "muted small", text: u.desc }),
        u.prereq ? el("p", { class: "stat-line", text: `Prerequisite: ${u.prereq}` }) : null));
    }
    return grid;
  }

  render2();
  const m = modal({
    title: "Your team & base", body, size: "wide",
    actions: [
      { label: "Cancel", value: null, variant: "ghost" },
      { label: "Save team", variant: "primary", onClick: () => { Store.saveTeam(team); showToast("Team saved."); if (onDone) onDone(team); return team; } },
    ],
  });
  return m.promise;
}
