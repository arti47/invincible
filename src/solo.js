// solo.js — Crisis Mode assistant (Ch.9): event checks, response engines, and the four timers.

import { el, clear, uid, clamp, d6, d66, roll2d6, tableLookup } from "./core.js";
import { modal, showToast, promptModal, chooseModal, announce } from "./ui.js";
import * as S from "../data-solo.js";
import { D } from "./rules.js";
import * as R from "./rules.js";
import * as Store from "./store.js";
import { STORAGE_PREFIX } from "./core.js";

const KEY = `${STORAGE_PREFIX}solo`;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || defaults(); } catch { return defaults(); }
}
function save(state) { localStorage.setItem(KEY, JSON.stringify(state)); return state; }
function defaults() {
  return { crisisLevel: 0, alert: "", timers: [], allies: [], objectives: [], encounter: null, mode: "alert", log: [] };
}

export function phaseFor(level) {
  return S.CRISIS_LEVEL.phases.find((p) => level >= p.range[0] && level <= p.range[1]) || S.CRISIS_LEVEL.phases[0];
}

function logEvent(state, text) {
  state.log.unshift({ at: Date.now(), text });
  state.log = state.log.slice(0, 60);
  announce(text);
}

/* ---------------------------------------------------------------- render */

export function renderSolo(mount) {
  const state = load();
  clear(mount);
  const phase = phaseFor(state.crisisLevel);

  mount.append(el("section", { class: "card" },
    el("h2", { text: "Crisis Mode" }),
    el("p", { class: "muted small", text: "Solo play without a GM. Keep at least one timer running at all times." }),
    el("div", { class: "crisis-level" },
      el("span", { class: "crisis-label", text: "Crisis level" }),
      el("button", { class: "icon-btn", "aria-label": "Lower crisis level", onclick: () => { state.crisisLevel = clamp(state.crisisLevel - 1, 0, 10); save(state); renderSolo(mount); } }, "−"),
      el("strong", { class: `crisis-value ${phase.key}`, "aria-live": "polite", text: `${state.crisisLevel} — ${phase.name}` }),
      el("button", { class: "icon-btn", "aria-label": "Raise crisis level", onclick: () => { state.crisisLevel = clamp(state.crisisLevel + 1, 0, 10); save(state); renderSolo(mount); } }, "+")),
    el("div", { class: "row-actions" },
      el("button", { class: "btn primary", onclick: () => doEventCheck(state, mount) }, "Event check"),
      el("button", { class: "btn", onclick: () => askBinary(state, mount) }, "Ask yes / no"),
      el("button", { class: "btn", onclick: () => askComplex(state, mount) }, "Complex answer"),
      el("button", { class: "btn ghost", onclick: () => generateAlert(state, mount) }, "New crisis alert")),
    state.alert ? el("p", { class: "alert-box", text: state.alert }) : null));

  mount.append(timersCard(state, mount));
  mount.append(objectivesCard(state, mount));
  mount.append(alliesCard(state, mount));
  mount.append(encounterCard(state, mount));
  mount.append(enginesCard(state, mount));
  mount.append(el("section", { class: "card" }, el("h3", { text: "Crisis log" }),
    el("ul", { class: "muted small" }, ...state.log.slice(0, 12).map((l) => el("li", { text: l.text })))));
}

/* ---------------------------------------------------------------- FATE tools */

function doEventCheck(state, mount) {
  const value = roll2d6();
  const entry = tableLookup(S.EVENT_CHECK.entries, value);
  let extra = "";
  if (value === 2) { state.crisisLevel = clamp(state.crisisLevel + 2, 0, 10); extra = twoEvents(); }
  else if (value <= 4) { state.crisisLevel = clamp(state.crisisLevel + 1, 0, 10); extra = oneEvent(); }
  else if (value >= 11) extra = `Opportunity: ${complexPhrase()}`;
  logEvent(state, `Event check ${value}: ${entry.text}${extra ? ` — ${extra}` : ""}`);
  save(state);
  modal({ title: `Event check — ${value}`,
    body: el("div", {}, el("p", { text: entry.text }), extra ? el("p", { class: "lede", text: extra }) : null),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

function oneEvent() { return complexPhrase(); }
function twoEvents() { return `${complexPhrase()} / ${complexPhrase()}`; }

function complexPhrase() {
  const dir = S.COMPLEX_ENGINE.directives[d66()];
  const sub = S.COMPLEX_ENGINE.subjects[d66()];
  return `${dir} ${sub}`;
}

async function askBinary(state, mount) {
  const question = await promptModal("What are you asking?", { title: "Yes / no question" });
  if (question === null) return;
  const odds = await chooseModal("How likely is a yes?", [
    { label: "Even odds", value: "even" },
    { label: "Yes is likely", value: "yes" },
    { label: "No is likely", value: "no" },
  ]);
  if (!odds) return;
  let value;
  if (odds === "even") value = d6();
  else { const a = d6(), b = d6(); value = odds === "yes" ? Math.max(a, b) : Math.min(a, b); }
  const entry = tableLookup(S.BINARY_ENGINE.entries, value);
  logEvent(state, `${question} → ${entry.text}`);
  save(state);
  modal({ title: entry.text,
    body: el("div", {}, el("p", { class: "muted", text: question }),
      el("p", { class: "lede", text: entry.text }),
      /strong/i.test(entry.text) ? el("p", { class: "muted small", text: "A strong result is unequivocal — you also discover or realise something more." }) : null),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

async function askComplex(state, mount) {
  const question = await promptModal("What are you asking?", { title: "Complex question" });
  if (question === null) return;
  const dirRoll = d66(), subRoll = d66();
  const dir = S.COMPLEX_ENGINE.directives[dirRoll];
  const sub = S.COMPLEX_ENGINE.subjects[subRoll];
  logEvent(state, `${question} → ${dir} ${sub}`);
  save(state);
  modal({ title: "Complex Response Engine",
    body: el("div", {},
      el("p", { class: "muted", text: question }),
      el("p", { class: "lede big", text: `${dir} ${sub}` }),
      el("p", { class: "muted small", text: `Directive ${dirRoll} · Subject ${subRoll}. Take it literally, interpret it, or roll again.` })),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

async function generateAlert(state, mount) {
  const hero = Store.activeCharacter();
  const rankKey = hero?.identity?.rank || "global";
  const sources = S.SOLO_SETUP.alertsByRank[rankKey] || S.SOLO_SETUP.alertsByRank.global;
  const pick = await chooseModal("Where does the alert come from?", sources.map((s) => ({ label: s, value: s })));
  if (!pick) return;
  let text = "";
  if (/criminal/i.test(pick)) {
    const crime = R.rollNamedTable(D.GM_TABLES.crime);
    const comp = R.rollNamedTable(D.GM_TABLES.crimeComplications);
    text = `${crime.entry.text}. Complication: ${comp.entry.text}`;
  } else if (/city/i.test(pick)) {
    const cat = R.rollNamedTable(D.GM_TABLES.catalyst);
    const inc = R.rollNamedTable(D.GM_TABLES.incidents);
    const loc = R.rollNamedTable(D.GM_TABLES.cityLocations);
    const comp = R.rollNamedTable(D.GM_TABLES.incidentComplications);
    text = `${cat.entry.text}: ${inc.entry.text} (${loc.entry.text}). Complication: ${comp.entry.text}`;
  } else if (/global/i.test(pick)) {
    const cat = R.rollNamedTable(D.GM_TABLES.globalCategory);
    const key = "global" + cat.entry.text.replace(/[^a-z]/gi, "");
    const table = D.GM_TABLES[key] || D.GM_TABLES.globalCriminal;
    const danger = R.rollNamedTable(table);
    const comp = R.rollNamedTable(D.GM_TABLES.globalComplications);
    text = `${cat.entry.text} danger: ${danger.entry.text} Complication: ${comp.entry.text}`;
  } else {
    text = `Cosmic peril: ${complexPhrase()} — ${R.rollNamedTable(D.GM_TABLES.globalComplications).entry.text}`;
  }
  state.alert = text;
  state.crisisLevel = 0;
  logEvent(state, `New crisis alert: ${text}`);
  save(state);
  renderSolo(mount);
  showToast("Crisis alert generated. Start a crisis timer.", { variant: "good" });
}

/* ---------------------------------------------------------------- crisis timers */

function timersCard(state, mount) {
  const card = el("section", { class: "card" }, el("h3", { text: "Crisis timers" }),
    el("p", { class: "muted small", text: S.CRISIS_TIMER.sourceGap ? "Proximity labels follow the surrounding rules text; the supplied table was partly truncated." : "" }));
  for (const t of state.timers) {
    const rung = S.CRISIS_TIMER.ladder.find((l) => l.key === t.proximity) || S.CRISIS_TIMER.ladder[0];
    card.append(el("div", { class: "timer" },
      el("div", {}, el("strong", { text: t.name }), el("p", { class: "muted small", text: `${rung.name} · ${rung.dice} threat dice` })),
      el("div", { class: "chosen-actions" },
        el("button", { class: "btn tiny primary", onclick: () => checkTimer(state, t, mount) }, "Check"),
        el("button", { class: "btn tiny ghost", onclick: () => { state.timers = state.timers.filter((x) => x.id !== t.id); logEvent(state, `Timer stopped: ${t.name}`); save(state); renderSolo(mount); } }, "Stop"))));
  }
  if (!state.timers.length) card.append(el("p", { class: "warn small", text: "No timer running. Always keep at least one." }));
  card.append(el("div", { class: "row-actions" },
    el("button", { class: "btn", onclick: () => addTimer(state, mount) }, "Start a crisis timer"),
    el("div", { class: "chiprow" }, ...S.MOVEMENT_MODES.map((m) => el("button", {
      class: `chip selectable ${state.mode === m.key ? "selected" : ""}`, title: m.desc,
      onclick: () => { state.mode = m.key; save(state); renderSolo(mount); },
    }, m.name)))));
  return card;
}

async function addTimer(state, mount) {
  let name = await promptModal("What will this timer trigger? Leave blank for 'bad thing happens'.", { title: "New crisis timer" });
  if (name === null) return;
  if (!name.trim()) name = `Bad thing happens (${complexPhrase()})`;
  const phase = phaseFor(state.crisisLevel);
  const start = S.CRISIS_TIMER.startByPhase[phase.key];
  state.timers.push({ id: uid("timer"), name, proximity: start });
  logEvent(state, `Timer started: ${name} (${start})`);
  save(state);
  renderSolo(mount);
}

function checkTimer(state, timer, mount) {
  const ladder = S.CRISIS_TIMER.ladder;
  const idx = ladder.findIndex((l) => l.key === timer.proximity);
  const rung = ladder[idx];
  const mode = S.MOVEMENT_MODES.find((m) => m.key === state.mode) || S.MOVEMENT_MODES[0];
  const dice = Math.max(1, rung.dice + mode.crisis);
  const faces = Array.from({ length: dice }, () => d6());
  const sixes = faces.filter((f) => f === 6).length;
  let next = Math.min(ladder.length - 1, idx + sixes);
  timer.proximity = ladder[next].key;
  let fired = false;
  if (ladder[next].key === "now") {
    fired = true;
    state.crisisLevel = clamp(state.crisisLevel + 1, 0, 10);
    state.timers = state.timers.filter((t) => t.id !== timer.id);
  }
  logEvent(state, `Timer "${timer.name}": rolled ${sixes} → ${ladder[next].name}${fired ? " — IT HAPPENS" : ""}`);
  save(state);
  modal({ title: fired ? "The timer fires!" : "Timer check",
    body: el("div", {},
      el("div", { class: "dice-row" }, ...faces.map((f) => el("span", { class: `die ${f === 6 ? "six" : f === 1 ? "one" : ""}`, text: String(f) }))),
      el("p", { text: `${timer.name}: now ${ladder[next].name}.` }),
      fired ? el("p", { class: "bad", text: "Deal with the consequences. Crisis level +1. Start another timer." }) : null),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- objectives */

function objectivesCard(state, mount) {
  const card = el("section", { class: "card" }, el("h3", { text: "Objectives" }));
  for (const o of state.objectives) {
    const rung = S.OBJECTIVE_TIMER.ladder.find((l) => l.key === o.status);
    card.append(el("div", { class: "timer" },
      el("div", {}, el("strong", { text: o.name }), el("p", { class: "muted small", text: `${rung.name} · ${rung.dice} progress dice · ${o.karma} karma on completion` })),
      el("div", { class: "chosen-actions" },
        rung.key === "reached"
          ? el("button", { class: "btn tiny primary", onclick: () => completeObjective(state, o, mount) }, "Claim karma")
          : el("button", { class: "btn tiny primary", onclick: () => objectiveCheck(state, o, mount) }, "Progress"),
        el("button", { class: "btn tiny ghost", onclick: () => { state.objectives = state.objectives.filter((x) => x.id !== o.id); save(state); renderSolo(mount); } }, "Drop"))));
  }
  card.append(el("button", { class: "btn", onclick: () => addObjective(state, mount) }, "Set an objective"));
  return card;
}

async function addObjective(state, mount) {
  const name = await promptModal("What is the objective?", { title: "New objective" });
  if (!name) return;
  const status = await chooseModal("How far away is it?", S.OBJECTIVE_TIMER.ladder.slice(0, 4).map((l) => ({
    label: l.name, hint: `${l.dice} progress dice · ${l.karma} karma`, value: l.key })));
  if (!status) return;
  const rung = S.OBJECTIVE_TIMER.ladder.find((l) => l.key === status);
  state.objectives.push({ id: uid("obj"), name, status, karma: rung.karma });
  logEvent(state, `Objective set: ${name} (${rung.name})`);
  save(state);
  renderSolo(mount);
}

/** Audit A24: 1s cancel 6s; a net-negative result pushes the objective one step back. */
function objectiveCheck(state, obj, mount) {
  const ladder = S.OBJECTIVE_TIMER.ladder;
  const idx = ladder.findIndex((l) => l.key === obj.status);
  const rung = ladder[idx];
  const phase = phaseFor(state.crisisLevel);
  const penalty = phase.key === "medium" ? -1 : phase.key === "high" ? -2 : 0;
  const dice = Math.max(1, rung.dice + penalty);
  const faces = Array.from({ length: dice }, () => d6());
  const sixes = faces.filter((f) => f === 6).length;
  const ones = faces.filter((f) => f === 1).length;
  const net = sixes - ones;
  let message;
  if (net > 0) {
    const next = Math.min(ladder.length - 1, idx + net);
    obj.status = ladder[next].key;
    message = `Advanced to ${ladder[next].name}.`;
  } else if (net < 0) {
    const back = Math.max(0, idx - 1);
    obj.status = ladder[back].key;
    message = `Complication! Pushed back to ${ladder[back].name}. Overcoming it becomes your next milestone: ${complexPhrase()}.`;
  } else {
    message = "No progress — consider why this milestone didn't help, or what minor complication appeared.";
  }
  logEvent(state, `Objective "${obj.name}": ${sixes} successes, ${ones} banes. ${message}`);
  save(state);
  modal({ title: obj.name,
    body: el("div", {},
      el("div", { class: "dice-row" }, ...faces.map((f) => el("span", { class: `die ${f === 6 ? "six" : f === 1 ? "one" : ""}`, text: String(f) }))),
      penalty ? el("p", { class: "warn small", text: `${phase.name}: ${penalty} progress dice.` }) : null,
      el("p", { text: message })),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

function completeObjective(state, obj, mount) {
  Store.updateCharacter((ch) => { ch.state.karma += obj.karma; });
  state.objectives = state.objectives.filter((x) => x.id !== obj.id);
  logEvent(state, `Objective complete: ${obj.name} (+${obj.karma} karma)`);
  save(state);
  showToast(`Objective complete: +${obj.karma} karma.`, { variant: "good" });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- allies */

function alliesCard(state, mount) {
  const card = el("section", { class: "card" }, el("h3", { text: "Allies" }));
  for (const a of state.allies) {
    const rung = S.ALLY_TIMER.ladder.find((l) => l.key === a.status);
    card.append(el("div", { class: "timer" },
      el("div", {}, el("strong", { text: a.name }), el("p", { class: "muted small", text: `${rung.name} · ${rung.dice} support dice` })),
      el("div", { class: "chosen-actions" },
        el("button", { class: "btn tiny primary", onclick: () => allyCheck(state, a, mount, false) }, "Check"),
        el("button", { class: "btn tiny", onclick: () => allyCheck(state, a, mount, true) }, "Fight"),
        el("button", { class: "btn tiny ghost", onclick: () => { state.allies = state.allies.filter((x) => x.id !== a.id); save(state); renderSolo(mount); } }, "Drop"))));
  }
  card.append(el("button", { class: "btn", onclick: () => addAllies(state, mount) }, "Add an ally group"));
  return card;
}

async function addAllies(state, mount) {
  const name = await promptModal("Who are they?", { title: "Ally group" });
  if (!name) return;
  const status = await chooseModal("Starting status", [
    { label: "Unified", hint: "Unaware of the danger to come", value: "unified" },
    { label: "Strained", hint: "Already in a tense situation", value: "strained" },
    { label: "Diminished", hint: "Already taken casualties", value: "diminished" },
  ]);
  if (!status) return;
  state.allies.push({ id: uid("ally"), name, status });
  save(state);
  renderSolo(mount);
}

/** Audit A25: each 6 is 2 damage in a fight; each 1 drops the status one step. */
async function allyCheck(state, ally, mount, inFight) {
  const ladder = S.ALLY_TIMER.ladder;
  const idx = ladder.findIndex((l) => l.key === ally.status);
  const rung = ladder[idx];
  const bonus = await chooseModal("Does this suit their role?", [
    { label: "No bonus", value: 0 },
    { label: "Suited to their role (+2)", value: 2 },
    { label: "Situation strongly favours them (+3)", value: 3 },
  ]);
  if (bonus === null) return;
  const dice = Math.max(0, rung.dice + Number(bonus));
  if (dice === 0) { showToast("You are alone — there is nobody left to roll for.", { variant: "warn" }); return; }
  const faces = Array.from({ length: dice }, () => d6());
  const sixes = faces.filter((f) => f === 6).length;
  const ones = faces.filter((f) => f === 1).length;
  const next = Math.min(ladder.length - 1, idx + ones);
  ally.status = ladder[next].key;
  const damage = inFight ? sixes * 2 : 0;
  const text = [
    sixes ? `${sixes} success${sixes === 1 ? "" : "es"}${inFight ? ` — ${damage} damage to enemies` : ""}.` : "No successes.",
    ones ? `${ones} setback(s): now ${ladder[next].name}.` : "",
  ].filter(Boolean).join(" ");
  logEvent(state, `Ally check (${ally.name}): ${text}`);
  save(state);
  modal({ title: ally.name,
    body: el("div", {},
      el("div", { class: "dice-row" }, ...faces.map((f) => el("span", { class: `die ${f === 6 ? "six" : f === 1 ? "one" : ""}`, text: String(f) }))),
      el("p", { text }),
      ones ? el("p", { class: "muted small", text: "Casualties can be deaths, injuries, infighting or being stressed out — ask the Binary Engine if unsure." }) : null),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- encounters */

function encounterCard(state, mount) {
  const card = el("section", { class: "card" }, el("h3", { text: "Encounter timer" }));
  if (!state.encounter) {
    card.append(el("p", { class: "muted small", text: "Start an encounter timer when exploring an unknown location or evading enemies." }));
    card.append(el("button", { class: "btn", onclick: () => startEncounter(state, mount) }, "Start encounter timer"));
    return card;
  }
  const rung = S.ENCOUNTER_TIMER.ladder.find((l) => l.key === state.encounter.presence);
  card.append(el("p", { class: "stat-line", text: `${rung.name} · ${rung.dice} enemy dice · moving ${state.mode}` }));
  card.append(el("div", { class: "row-actions" },
    el("button", { class: "btn primary", onclick: () => encounterCheck(state, mount) }, "Move / linger — check"),
    el("button", { class: "btn ghost", onclick: () => { state.encounter = null; save(state); renderSolo(mount); } }, "Clear")));
  return card;
}

async function startEncounter(state, mount) {
  const presence = await chooseModal("Starting enemy presence", S.ENCOUNTER_TIMER.ladder.slice(0, 6).map((l) => ({
    label: l.name, hint: `${l.dice} enemy dice`, value: l.key })));
  if (!presence) return;
  state.encounter = { presence };
  save(state);
  renderSolo(mount);
}

function encounterCheck(state, mount) {
  const ladder = S.ENCOUNTER_TIMER.ladder;
  const idx = ladder.findIndex((l) => l.key === state.encounter.presence);
  const rung = ladder[idx];
  const mode = S.MOVEMENT_MODES.find((m) => m.key === state.mode) || S.MOVEMENT_MODES[0];
  const dice = Math.max(1, rung.dice + mode.encounter);
  const faces = Array.from({ length: dice }, () => d6());
  const sixes = faces.filter((f) => f === 6).length;
  const highest = Math.max(...faces, 0);
  const next = Math.min(ladder.length - 1, idx + sixes);
  state.encounter.presence = ladder[next].key;

  const body = el("div", {},
    el("div", { class: "dice-row" }, ...faces.map((f) => el("span", { class: `die ${f === 6 ? "six" : f === 1 ? "one" : ""}`, text: String(f) }))),
    el("p", { text: `Enemy presence: ${ladder[next].name}.` }));

  if (sixes) {
    const ev = S.ENCOUNTER_TIMER.evidence.find((e) => e.sixes === Math.min(3, sixes));
    body.append(el("p", { class: "muted", text: ev.text }));
  }
  if (ladder[next].key === "encountered") {
    const behaviour = S.ENEMY_BEHAVIOUR.find((b) => b.highest === highest) || S.ENEMY_BEHAVIOUR.find((b) => b.highest === 0);
    const threat = S.ENEMY_THREAT.find((t) => t.sixes === Math.min(3, sixes)) || S.ENEMY_THREAT[0];
    body.append(
      el("h4", { class: "section", text: "Encounter!" }),
      el("p", {}, el("strong", { text: behaviour.name + ": " }), behaviour.effect),
      el("p", {}, el("strong", { text: threat.name + ": " }), threat.examples),
      el("details", {}, el("summary", { text: "Avoiding or escaping" }),
        ...S.AVOIDING_ENCOUNTERS.map((t) => el("p", { class: "small", text: t })),
        el("p", { class: "small", text: "Escape needs an AGILITY roll; modifiers:" }),
        el("ul", { class: "small" }, ...S.ESCAPE_MODIFIERS.map((m) => el("li", { text: `${m.text}: ${m.dice > 0 ? "+" : ""}${m.dice} dice` })))));
    state.encounter.presence = "encountered";
  }
  logEvent(state, `Encounter check: ${sixes} sixes → ${ladder[next].name}`);
  save(state);
  modal({ title: "Encounter check", body, actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- engines reference */

function enginesCard(state, mount) {
  const card = el("section", { class: "card" }, el("h3", { text: "Location engines" }));
  const row = el("div", { class: "chiprow" });
  for (const [key, engine] of Object.entries(S.LOCATION_ENGINES)) {
    row.append(el("button", { class: "chip", onclick: () => {
      const res = R.rollNamedTable(engine);
      const atmosphere = key === "atmosphere" ? null : R.rollNamedTable(S.LOCATION_ENGINES.atmosphere);
      const text = atmosphere ? `${atmosphere.entry.text} ${res.entry.text}` : res.entry.text;
      logEvent(state, `${engine.name}: ${text}`);
      save(state);
      modal({ title: engine.name, body: el("div", {}, el("p", { class: "lede big", text }), el("p", { class: "muted small", text: engine.note })), actions: [{ label: "OK", variant: "primary" }] });
      renderSolo(mount);
    } }, engine.name.replace(" Engine", "")));
  }
  card.append(row);
  card.append(el("details", {}, el("summary", { text: "Bonus 6 effects (choose one per roll)" }),
    ...S.BONUS_SIX_EFFECTS.map((b) => el("p", { class: "small" }, el("strong", { text: `${b.name}: ` }), b.effect))));
  card.append(el("details", {}, el("summary", { text: "Solo combat and recovery reminders" }),
    ...S.SOLO_COMBAT.map((t) => el("p", { class: "small", text: t })),
    ...S.SOLO_SETUP.recovery.map((t) => el("p", { class: "small good", text: t }))));
  return card;
}

export function soloBuildNotes() { return S.SOLO_SETUP.build; }
