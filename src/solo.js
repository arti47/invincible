// solo.js — Crisis Mode assistant (Ch.9): event checks, response engines, and the four timers.

import { el, clear, uid, clamp, d6, d66, roll2d6, tableLookup } from "./core.js";
import { modal, showToast, promptModal, chooseModal, announce, helpPanel } from "./ui.js";
import * as S from "../data-solo.js";
import { D } from "./rules.js";
import * as R from "./rules.js";
import * as Derived from "./derived.js";
import * as Store from "./store.js";
import { STORAGE_PREFIX } from "./core.js";

const KEY = `${STORAGE_PREFIX}solo`;

function load() {
  try { return { ...defaults(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { return defaults(); }
}
function save(state) { localStorage.setItem(KEY, JSON.stringify(state)); return state; }
function defaults() {
  return { crisisLevel: 0, alert: "", crises: [], timers: [], allies: [], objectives: [], encounter: null, mode: "alert", log: [],
    eventChecks: 0, awaitingSocial: false };
}

/* ---------------------------------------------------------------- sequence of play (SOLO_SETUP.loop) */

let undoSnapshot = null;
function snapshot(state, label) { undoSnapshot = { label, data: JSON.stringify(state) }; }
function undoSolo(mount) {
  if (!undoSnapshot) return false;
  save(JSON.parse(undoSnapshot.data));
  undoSnapshot = null;
  showToast("Undone.");
  renderSolo(mount);
  return true;
}

/** Which of the six loop steps the player is on. Guidance only — nothing is ever blocked. */
export function currentStep(state) {
  if (!state.alert) return 0;              // 1. generate a crisis alert
  if (state.awaitingSocial) return 4;      // 5. play a social scene
  if (!state.eventChecks) return 1;        // 2. crisis level 0, begin event checks
  if (!state.timers.length) return 2;      // 3. choose a crisis, start timers
  return 3;                                // 4. make checks, track timers
}

function stepStrip(state) {
  const cur = currentStep(state);
  return el("ol", { class: "solo-steps", "aria-label": "Sequence of play" },
    ...S.SOLO_SETUP.loop.map((text, i) => el("li", {
      class: `solo-step ${i === cur ? "current" : ""} ${i < cur ? "done" : ""}`,
      "aria-current": i === cur ? "step" : null,
    }, el("span", { class: "solo-step-n", "aria-hidden": "true", text: String(i + 1) }), el("span", { class: "solo-step-t", text }))));
}

/** Guide, don't block: warn when acting out of order, then run the action anyway. */
function offSequence(state, want, label) {
  const cur = currentStep(state);
  if (cur === want) return;
  showToast(`Out of sequence — step ${cur + 1} is "${S.SOLO_SETUP.loop[cur]}". Running ${label} anyway.`,
    { variant: "warn", timeout: 5500 });
}

/** Bonus-6 effects: offered wherever a solo roll leaves a spare 6 (one per roll). */
function bonusSixBlock(state, sixes) {
  if (sixes < 2) return null;
  const spare = sixes - 1;
  const wrap = el("details", { class: "bonus-six", open: true },
    el("summary", { text: `${spare} spare 6 — choose one bonus effect` }));
  for (const b of S.BONUS_SIX_EFFECTS) {
    wrap.append(el("button", { class: "choice", onclick: () => {
      logEvent(state, `Bonus 6 — ${b.name}: ${b.effect}`);
      save(state);
      showToast(`${b.name}: ${b.effect}`, { timeout: 6000 });
    } }, el("span", { class: "choice-label", text: b.name }), el("span", { class: "choice-hint", text: b.effect })));
  }
  return wrap;
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

  const step = currentStep(state);
  const primary = (n) => (step === n ? "btn primary" : "btn");

  mount.append(el("section", { class: "card" },
    el("h2", { text: "Crisis Mode" }),
    el("p", { class: "muted small", text: "Solo play without a GM. Keep at least one timer running at all times." }),
    stepStrip(state),
    el("div", { class: "crisis-level" },
      el("span", { class: "crisis-label", text: "Crisis level" }),
      el("button", { class: "icon-btn", "aria-label": "Lower crisis level", onclick: () => { state.crisisLevel = clamp(state.crisisLevel - 1, 0, 10); save(state); renderSolo(mount); } }, "−"),
      el("strong", { class: `crisis-value ${phase.key}`, "aria-live": "polite", text: `${state.crisisLevel} — ${phase.name}` }),
      el("button", { class: "icon-btn", "aria-label": "Raise crisis level", onclick: () => { state.crisisLevel = clamp(state.crisisLevel + 1, 0, 10); save(state); renderSolo(mount); } }, "+")),
    // Sequence-critical actions only, in loop order. The oracles have their own card.
    el("div", { class: "row-actions" },
      el("button", { class: primary(0), onclick: () => generateAlert(state, mount) }, state.alert ? "New crisis alert" : "Generate crisis alert"),
      el("button", { class: primary(1), onclick: () => doEventCheck(state, mount) }, "Event check"),
      el("button", { class: primary(4), onclick: () => socialScene(state, mount) }, "Social scene"),
      state.alert ? el("button", { class: "btn warn", onclick: () => resolveCrisis(state, mount) }, "Resolve crisis") : null,
      undoSnapshot ? el("button", { class: "btn ghost", onclick: () => undoSolo(mount) }, `Undo ${undoSnapshot.label}`) : null),
    el("div", { class: "movement-modes" },
      el("span", { class: "crisis-label", text: "Moving" }),
      el("div", { class: "chiprow" }, ...S.MOVEMENT_MODES.map((m) => el("button", {
        class: `chip selectable ${state.mode === m.key ? "selected" : ""}`, title: m.desc,
        onclick: () => { state.mode = m.key; save(state); renderSolo(mount); },
      }, m.name)))),
    el("p", { class: "muted small", text: "Movement mode shifts both the crisis timer and the encounter timer." }),
    state.alert ? el("p", { class: "alert-box", text: state.alert }) : null,
    state.alert ? el("p", { class: "muted small", text: S.SOLO_SETUP.alertNote }) : null));

  mount.append(crisesCard(state, mount));
  mount.append(allTimersCard(state, mount));
  mount.append(oraclesCard(state, mount));
  mount.append(referenceCard(state, mount));
  mount.append(el("section", { class: "card" }, el("h3", { text: "Crisis log" }),
    helpPanel(["Everything that has happened this crisis, newest first — alerts, checks, timer results, oracle answers and karma.", "Use it to reconstruct the story afterwards, or to remind yourself what a timer was counting down to."]),
    el("ul", { class: "muted small" }, ...state.log.slice(0, 12).map((l) => el("li", { text: l.text })))));
}


/* ---------------------------------------------------------------- timers (all four types) */

/**
 * The rules describe four timer types, not four unrelated trackers: they are the clock that
 * replaces the GM. Keeping them in one card makes "always keep at least one running" checkable
 * at a glance, and shows the crisis timer and the encounter timer sharing a movement mode.
 */
function allTimersCard(state, mount) {
  const running = state.timers.length + state.objectives.length + state.allies.length + (state.encounter ? 1 : 0);
  const card = el("section", { class: "card" },
    el("h3", { text: `Timers (${running} running)` }),
    helpPanel([
      "Timers are the pressure in solo play — they are what a GM would otherwise supply. There are four types and they all advance when time passes in the fiction.",
      "Crisis counts down to something bad. Objective counts up to your goal and pays karma. Ally tracks how a helping group is holding up. Encounter tracks how close the opposition is.",
      "Never let the board go empty: if nothing is running, nothing is pushing the story forward. Start a crisis timer first, then add whichever others fit the scene.",
    ]),
    running === 0
      ? el("p", { class: "warn small", text: "Nothing is running. Engage a crisis, or start a timer below." })
      : null);
  card.append(timersCard(state, mount));
  card.append(objectivesCard(state, mount));
  card.append(alliesCard(state, mount));
  card.append(encounterCard(state, mount));
  return card;
}

/* ---------------------------------------------------------------- oracles */

/**
 * Everything that answers a question a GM would normally answer, including the location engines —
 * which previously sat in a reference block with no stated trigger.
 */
function oraclesCard(state, mount) {
  const card = el("section", { class: "card" },
    el("h3", { text: "Ask the oracles" }),
    helpPanel([
      "Use these whenever you would otherwise have asked the GM something.",
      "Yes / no answers a closed question. Complex answer gives a directive and a subject to interpret when the question is open-ended.",
      "Describe a place is the location engines: roll one when you arrive somewhere and need to know what it is actually like — a district, a stretch of terrain, a facility interior, the volume of space you just dropped into. The Atmosphere engine is mixed into the others automatically to colour the result.",
      "Crisis event is the book's jolt: if you are ever unsure what happens next, raise the crisis level by 1 and roll one.",
    ]),
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => askBinary(state, mount) }, "Ask yes / no"),
      el("button", { class: "btn", onclick: () => askComplex(state, mount) }, "Complex answer"),
      el("button", { class: "btn ghost", onclick: () => joltCrisisEvent(state, mount) }, "Crisis event")));

  card.append(el("h4", { class: "group-head", text: "Describe a place" }));
  card.append(el("p", { class: "muted small", text: "Roll the engine matching the scale you need." }));
  const row = el("div", { class: "chiprow" });
  for (const key of Object.keys(S.LOCATION_ENGINES)) {
    row.append(el("button", { class: "chip", onclick: () => describePlace(state, mount, key) },
      S.LOCATION_ENGINES[key].name.replace(" Engine", "")));
  }
  card.append(row);
  return card;
}

/** Roll a location engine, blending in Atmosphere the way the chapter intends. */
function describePlace(state, mount, key) {
  const engine = S.LOCATION_ENGINES[key];
  const res = R.rollNamedTable(engine);
  const atmosphere = key === "atmosphere" ? null : R.rollNamedTable(S.LOCATION_ENGINES.atmosphere);
  const text = atmosphere ? `${atmosphere.entry.text} ${res.entry.text}` : res.entry.text;
  logEvent(state, `${engine.name}: ${text}`);
  save(state);
  modal({ title: engine.name,
    body: el("div", {},
      el("p", { class: "lede big", text }),
      el("p", { class: "muted small", text: engine.note }),
      atmosphere ? el("p", { class: "muted small", text: "The first half is the Atmosphere engine, rolled alongside so the place has a mood as well as a shape." }) : null),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- loop step 3: choosing a crisis */

/**
 * Crises are the things you can engage. The alert seeds the first; every event check that fires
 * adds more. Loop step 3 is "choose a crisis and start a crisis timer" — engaging one turns it
 * into a running timer, which is what the rest of the loop tracks.
 */
function addCrisis(state, text, source) {
  state.crises = state.crises || [];
  state.crises.push({ id: uid("crisis"), text, source, at: Date.now() });
  return state.crises[state.crises.length - 1];
}

function crisesCard(state, mount) {
  const card = el("section", { class: "card" }, el("h3", { text: `Crises (${(state.crises || []).length})` }));
  card.append(helpPanel([
    "Every danger you could engage right now. The crisis alert seeds the first one; each event check that fires adds another.",
    "Step 3 of the loop is choosing one. Engage a crisis to turn it into a running crisis timer — the timer counts down to it happening.",
    "You do not have to take them in order. Ignoring a crisis is a legitimate choice; it stays on the list until you engage or drop it.",
  ]));
  if (!(state.crises || []).length) {
    card.append(el("p", { class: "muted small", text: state.alert
      ? "Nothing pending. Make an event check to turn up a new crisis, or start a timer directly."
      : "Generate a crisis alert to seed the first crisis." }));
    return card;
  }
  for (const c of state.crises) {
    card.append(el("div", { class: "timer" },
      el("div", {}, el("strong", { text: c.source === "alert" ? "From the alert" : "From an event check" }),
        el("p", { class: "small", text: c.text })),
      el("div", { class: "chosen-actions" },
        el("button", { class: currentStep(state) === 2 ? "btn tiny primary" : "btn tiny", onclick: () => engageCrisis(state, c, mount) }, "Engage"),
        el("button", { class: "btn tiny ghost", onclick: () => {
          state.crises = state.crises.filter((x) => x.id !== c.id);
          logEvent(state, `Crisis ignored: ${c.text}`);
          save(state); renderSolo(mount);
        } }, "Ignore"))));
  }
  return card;
}

function engageCrisis(state, crisis, mount) {
  const phase = phaseFor(state.crisisLevel);
  const start = S.CRISIS_TIMER.startByPhase[phase.key];
  state.timers.push({ id: uid("timer"), name: crisis.text, proximity: start, crisisId: crisis.id });
  state.crises = state.crises.filter((x) => x.id !== crisis.id);
  logEvent(state, `Engaged: ${crisis.text} (timer starts ${start})`);
  save(state);
  showToast(`Crisis timer started at "${start}". Check it as time passes.`, { variant: "good" });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- loop steps 5 & 6 */

/** Step 5: social scene. Restores Resolve equal to PRESENCE (Ch.4 recovery table). */
async function socialScene(state, mount) {
  const hero = Store.activeCharacter();
  let restored = 0;
  if (hero) {
    Store.updateCharacter((ch) => {
      const before = ch.state.resolve;
      ch.state.resolve = clamp(ch.state.resolve + Derived.effectiveAttributes(ch).presence, 0, Derived.maxResolve(ch));
      restored = ch.state.resolve - before;
    }, { id: hero.id });
  }
  state.awaitingSocial = false;
  logEvent(state, `Social scene${restored ? ` — Resolve +${restored}` : ""}`);
  save(state);
  const hook = el("p", { class: "lede" });
  modal({ title: "Social scene",
    body: el("div", {},
      hero ? el("p", { class: "good", text: `Resolve restored equal to your PRESENCE: +${restored}.` })
        : el("p", { class: "warn small", text: "No active hero — no Resolve restored." }),
      ...S.SOLO_SETUP.socialScenes.map((t) => el("p", { class: "small", text: t })),
      el("button", { class: "btn ghost", onclick: () => {
        const r = R.rollNamedTable(D.GM_TABLES.socialHooks);
        hook.textContent = `Hook (${r.value}): ${r.entry.text}`;
        logEvent(state, `Social hook: ${r.entry.text}`);
        save(state);
      } }, "Roll a social hook"),
      hook),
    actions: [{ label: "Done", variant: "primary" }] });
  renderSolo(mount);
}

/** Step 6: close the crisis out. Confirmation summary + one-step undo. */
async function resolveCrisis(state, mount) {
  const lines = [
    "Clear the crisis alert.",
    `Drop ${(state.crises || []).length} pending crisis/crises.`,
    `Stop ${state.timers.length} running timer(s).`,
    `Reset the crisis level from ${state.crisisLevel} to 0.`,
    state.encounter ? "Clear the encounter timer." : null,
    "Prompt a social scene (step 5), then a new alert (step 1).",
  ].filter(Boolean);
  const ok = await modal({ title: "Resolve crisis",
    body: el("div", {},
      el("p", { class: "muted", text: "This applies the whole bundle. You can undo it in one step." }),
      el("ul", {}, ...lines.map((t) => el("li", { text: t }))),
      el("p", { class: "muted small", text: "Objectives and allies are left alone — claim any objective karma first." })),
    actions: [{ label: "Cancel", value: false, variant: "ghost" }, { label: "Resolve", value: true, variant: "primary" }] }).promise;
  if (!ok) return;
  snapshot(state, "Resolve crisis");
  state.alert = "";
  state.crises = [];
  state.timers = [];
  state.encounter = null;
  state.crisisLevel = 0;
  state.eventChecks = 0;
  state.awaitingSocial = true;
  logEvent(state, "Crisis resolved — play a social scene, then generate a new alert.");
  save(state);
  showToast("Crisis resolved. Social scene next.", { variant: "good", timeout: 8000,
    action: { label: "Undo", onClick: () => undoSolo(mount) } });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- crisis & opportunity engines */

/**
 * Crisis Event Engine (Ch.9): D66 for the focus, 2D6 + the current crisis level for the detail.
 * The level is read after the event check has applied its own increase, so an escalating crisis
 * pushes the detail into the harsher bands.
 */
export function rollCrisisEvent(state) {
  const focusRoll = d66();
  const row = S.CRISIS_EVENT_ENGINE.entries.find((e) => e.roll === focusRoll) || S.CRISIS_EVENT_ENGINE.entries[0];
  const detailRoll = roll2d6() + (state.crisisLevel || 0);
  let i = S.CRISIS_EVENT_ENGINE.bands.findIndex((b) => detailRoll <= b.max);
  if (i < 0) i = S.CRISIS_EVENT_ENGINE.bands.length - 1;
  return {
    focusRoll, detailRoll, focus: row.focus, detail: row.details[i],
    band: S.CRISIS_EVENT_ENGINE.bands[i], text: `${row.focus}: ${row.details[i]}`,
  };
}

export function rollOpportunity() {
  const value = d66();
  const entry = tableLookup(S.OPPORTUNITY_ENGINE.entries, value) || S.OPPORTUNITY_ENGINE.entries[0];
  return { value, text: entry.text };
}

/** "If you are ever unsure what happens next": +1 crisis level and roll a crisis event (Ch.9). */
function joltCrisisEvent(state, mount) {
  state.crisisLevel = clamp(state.crisisLevel + 1, 0, 10);
  const ev = rollCrisisEvent(state);
  addCrisis(state, ev.text, "event");
  logEvent(state, `Crisis event (${ev.focusRoll}/${ev.detailRoll}): ${ev.text}`);
  save(state);
  modal({ title: `Crisis event — ${ev.focus}`,
    body: el("div", {},
      el("p", { class: "lede big", text: ev.detail }),
      el("p", { class: "muted small", text: `Focus D66 ${ev.focusRoll} · detail 2D6 + crisis level = ${ev.detailRoll} (${ev.band.label}). Crisis level is now ${state.crisisLevel}.` }),
      el("p", { class: "muted small", text: S.CRISIS_EVENT_ENGINE.note }),
      el("p", { class: "small", text: "Added to Crises — engage it there to start a timer." })),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- FATE tools */

function doEventCheck(state, mount) {
  offSequence(state, 1, "an event check");
  state.eventChecks = (state.eventChecks || 0) + 1;
  const value = roll2d6();
  const entry = tableLookup(S.EVENT_CHECK.entries, value);
  let extra = "";
  let rolls = "";
  if (value === 2) {
    state.crisisLevel = clamp(state.crisisLevel + 2, 0, 10);
    const a = rollCrisisEvent(state), b = rollCrisisEvent(state);
    addCrisis(state, a.text, "event"); addCrisis(state, b.text, "event");
    extra = `${a.text} / ${b.text}`;
    rolls = `Focus ${a.focusRoll}/${b.focusRoll} · detail ${a.detailRoll}/${b.detailRoll}`;
  } else if (value <= 4) {
    state.crisisLevel = clamp(state.crisisLevel + 1, 0, 10);
    const one = rollCrisisEvent(state);
    addCrisis(state, one.text, "event");
    extra = one.text;
    rolls = `Focus D66 ${one.focusRoll} · detail 2D6 + crisis level = ${one.detailRoll} (${one.band.label})`;
  } else if (value >= 11) {
    const opp = rollOpportunity();
    extra = `Opportunity: ${opp.text}`;
    rolls = `Opportunity D66 ${opp.value}. These should stay rare, and may count as a milestone for an objective check.`;
  }
  logEvent(state, `Event check ${value}: ${entry.text}${extra ? ` — ${extra}` : ""}`);
  save(state);
  modal({ title: `Event check — ${value}`,
    body: el("div", {}, el("p", { text: entry.text }), extra ? el("p", { class: "lede", text: extra }) : null,
      rolls ? el("p", { class: "muted small", text: rolls }) : null,
      value <= 4 ? el("p", { class: "muted small", text: "Added to Crises — engage it there to start a timer, or leave it pending." }) : null),
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
  offSequence(state, 0, "a new alert");
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
  state.eventChecks = 0;
  state.awaitingSocial = false;
  state.crises = [];
  addCrisis(state, text, "alert");
  logEvent(state, `New crisis alert: ${text}`);
  save(state);
  renderSolo(mount);
  modal({ title: "Crisis alert",
    body: el("div", {},
      el("p", { class: "lede", text }),
      el("p", { class: "muted small", text: S.SOLO_SETUP.alertNote }),
      el("p", { class: "small", text: "Next: make an event check, then engage this crisis to start a timer." }),
      el("h4", { class: "section", text: "Where is it?" }),
      el("p", { class: "muted small", text: "Roll a location engine if you need the place itself described." }),
      el("div", { class: "chiprow" }, ...Object.keys(S.LOCATION_ENGINES).map((k) =>
        el("button", { class: "chip", onclick: () => describePlace(state, mount, k) },
          S.LOCATION_ENGINES[k].name.replace(" Engine", ""))))),
    actions: [{ label: "OK", variant: "primary" }] });
}

/* ---------------------------------------------------------------- crisis timers */

function timersCard(state, mount) {
  const card = el("div", { class: "timer-group" }, el("h4", { class: "group-head", text: "Crisis timers" }),
    helpPanel(["A crisis timer counts down to something bad happening. Check it whenever time passes in the fiction.", "Each 6 rolled moves it closer. When it reaches 'now' the event fires, the crisis level rises by 1, and the timer is removed.", "Keep at least one running at all times — that is what drives solo play forward without a GM."]),
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
  const mode = S.MOVEMENT_MODES.find((m) => m.key === state.mode) || S.MOVEMENT_MODES[0];
  card.append(el("p", { class: "muted small", text: `Moving ${mode.name.toLowerCase()}: ${mode.crisis > 0 ? "+" : ""}${mode.crisis} crisis dice.` }));
  card.append(el("div", { class: "row-actions" },
    el("button", { class: currentStep(state) === 2 ? "btn primary" : "btn", onclick: () => addTimer(state, mount) }, "Start a crisis timer")));
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
    state.awaitingSocial = true;   // step 5: a resolved event calls for a social scene
  }
  logEvent(state, `Timer "${timer.name}": rolled ${sixes} → ${ladder[next].name}${fired ? " — IT HAPPENS" : ""}`);
  save(state);
  modal({ title: fired ? "The timer fires!" : "Timer check",
    body: el("div", {},
      el("div", { class: "dice-row" }, ...faces.map((f) => el("span", { class: `die ${f === 6 ? "six" : f === 1 ? "one" : ""}`, text: String(f) }))),
      el("p", { text: `${timer.name}: now ${ladder[next].name}.` }),
      fired ? el("p", { class: "bad", text: "Deal with the consequences. Crisis level +1. Start another timer, then play a social scene." }) : null,
      bonusSixBlock(state, sixes)),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- objectives */

function objectivesCard(state, mount) {
  const card = el("div", { class: "timer-group" }, el("h4", { class: "group-head", text: "Objectives" }),
    helpPanel(["What your hero is trying to achieve. Objectives are how you earn karma in solo play, replacing the end-of-session questions.", "Roll Progress to advance along the ladder. 1s cancel 6s, and a net-negative result pushes the objective one step back.", "When it reaches the top of the ladder, claim the karma shown on the row."]));
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
      el("p", { text: message }),
      bonusSixBlock(state, sixes)),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

function completeObjective(state, obj, mount) {
  Store.updateCharacter((ch) => { ch.state.karma += obj.karma; });
  state.objectives = state.objectives.filter((x) => x.id !== obj.id);
  state.awaitingSocial = true;   // step 5: a completed objective calls for a social scene
  logEvent(state, `Objective complete: ${obj.name} (+${obj.karma} karma)`);
  save(state);
  showToast(`Objective complete: +${obj.karma} karma. Social scene next.`, { variant: "good" });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- allies */

function alliesCard(state, mount) {
  const card = el("div", { class: "timer-group" }, el("h4", { class: "group-head", text: "Allies" }),
    helpPanel(["A group helping you, tracked as one unit rather than as individual NPCs.", "Check them to see how they hold up: each 6 is a success (2 damage each in a fight), each 1 drops their status one step toward Alone.", "Allies aiding you directly give +2 dice to your own roll."]));
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
      ones ? el("p", { class: "muted small", text: "Casualties can be deaths, injuries, infighting or being stressed out — ask the Binary Engine if unsure." }) : null,
      bonusSixBlock(state, sixes)),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- encounters */

function encounterCard(state, mount) {
  const card = el("div", { class: "timer-group" }, el("h4", { class: "group-head", text: "Encounter timer" }),
    helpPanel(["Use this when exploring an unknown location or evading enemies — it tracks how close the opposition is getting.", "Your movement mode shifts the odds: rushing is faster but noisier, moving cautiously is slower but safer.", "At 'Encountered' the highest die sets enemy behaviour and the number of 6s sets how big the threat is."]));
  const sequence = el("details", {}, el("summary", { text: "Encounter procedure, in order" }),
    el("ol", { class: "small" }, ...S.ENCOUNTER_SEQUENCE.map((t) => el("li", { text: t }))));
  if (!state.encounter) {
    card.append(el("p", { class: "muted small", text: "Start an encounter timer when exploring an unknown location or evading enemies." }));
    card.append(el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => startEncounter(state, mount) }, "Start encounter timer"),
      el("button", { class: "btn ghost", onclick: () => describePlace(state, mount, "facility") }, "Describe this place")));
    card.append(sequence);
    return card;
  }
  card.append(sequence);
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
  const bonus = bonusSixBlock(state, sixes);
  if (bonus) body.append(bonus);
  logEvent(state, `Encounter check: ${sixes} sixes → ${ladder[next].name}`);
  save(state);
  modal({ title: "Encounter check", body, actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- engines reference */

function referenceCard(state, mount) {
  const card = el("section", { class: "card" }, el("h3", { text: "Reference" }),
    helpPanel(["Oracles for describing where you are when there is no GM to tell you.", "Roll the engine matching the scale you need; the Atmosphere engine is mixed in automatically to colour the result.", "Bonus-6 effects, solo combat reminders and power guidance live here too."]));
  card.append(el("details", {}, el("summary", { text: "Bonus 6 effects (choose one per roll)" }),
    ...S.BONUS_SIX_EFFECTS.map((b) => el("p", { class: "small" }, el("strong", { text: `${b.name}: ` }), b.effect))));
  card.append(el("details", {}, el("summary", { text: "Solo combat and recovery reminders" }),
    ...S.SOLO_COMBAT.map((t) => el("p", { class: "small", text: t })),
    ...S.SOLO_SETUP.recovery.map((t) => el("p", { class: "small good", text: t }))));
  card.append(el("details", {}, el("summary", { text: "Crisis Event Engine (D66 focus, 2D6 + crisis level)" }),
    el("p", { class: "small", text: S.CRISIS_EVENT_ENGINE.note }),
    el("div", { class: "table-scroll" }, el("table", { class: "data-table" },
      el("tr", {}, el("th", { text: "D66" }), el("th", { text: "Focus" }),
        ...S.CRISIS_EVENT_ENGINE.bands.map((b) => el("th", { text: b.label }))),
      ...S.CRISIS_EVENT_ENGINE.entries.map((e) => el("tr", {},
        el("td", { text: String(e.roll) }), el("td", { text: e.focus }),
        ...e.details.map((d) => el("td", { text: d }))))))));
  card.append(el("details", {}, el("summary", { text: "Opportunity Event Engine (D66)" }),
    el("p", { class: "small", text: "A positive twist or helpful asset. Prompted by 11-12 on the event check, or whenever a FATE response points at a positive turn. Keep these rare; one may count as a milestone that triggers an objective check." }),
    el("div", { class: "table-scroll" }, el("table", { class: "data-table" },
      el("tr", {}, el("th", { text: "D66" }), el("th", { text: "Opportunity" })),
      ...S.OPPORTUNITY_ENGINE.entries.map((e) => el("tr", {},
        el("td", { text: e.range[0] === e.range[1] ? String(e.range[0]) : `${e.range[0]}-${e.range[1]}` }),
        el("td", { text: e.text })))))));
  card.append(el("details", {}, el("summary", { text: "Using powers without a GM" }),
    ...S.SOLO_POWER_USE.map((t) => el("p", { class: "small", text: t }))));
  return card;
}

export function soloBuildNotes() { return S.SOLO_SETUP.build; }

/**
 * Called by the End social scene lifecycle bundle so a social scene played through the normal
 * table flow also satisfies solo loop step 5 — otherwise the solo tab stays stuck on it.
 */
export function markSocialScenePlayed() {
  const state = load();
  if (!state.awaitingSocial) return false;
  state.awaitingSocial = false;
  logEvent(state, "Social scene played (via the session lifecycle).");
  save(state);
  return true;
}
