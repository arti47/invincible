// solo.js — Crisis Mode assistant (Ch.9): event checks, response engines, and the four timers.

import { el, clear, uid, clamp, d6, d66, roll2d6, tableLookup } from "./core.js";
import { modal, showToast, promptModal, chooseModal, announce, helpPanel } from "./ui.js";
import * as S from "../data-solo.js";
import { NPC_PROFILES } from "../data-npcs.js";
import { D } from "./rules.js";
import * as R from "./rules.js";
import * as Derived from "./derived.js";
import * as Store from "./store.js";
import { setLearnTab } from "./learn.js";
import * as Combat from "./combat.js";
import { STORAGE_PREFIX } from "./core.js";

const KEY = `${STORAGE_PREFIX}solo`;

function load() {
  try { return { ...defaults(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { return defaults(); }
}
function save(state) { localStorage.setItem(KEY, JSON.stringify(state)); return state; }
function defaults() {
  return { crisisLevel: 0, alert: "", crises: [], timers: [], allies: [], objectives: [], encounter: null, mode: "alert", log: [],
    eventChecks: 0, awaitingSocial: false, lastOracle: null, place: null, resolved: 0, alertParts: null };
}

/**
 * The last oracle answer, kept on the tab instead of vanishing with its modal. Location rolls in
 * particular describe the place you are standing in for the rest of the scene, so the answer has
 * to stay legible after the dialog closes.
 */
function setOracle(state, kind, text, detail = "") {
  state.lastOracle = { kind, text, detail, at: Date.now() };
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
  // Step 5 outranks step 1: resolving a crisis clears the alert, and the social scene comes first.
  if (state.awaitingSocial) return 4;      // 5. play a social scene
  if (!state.alert) return 0;              // 1. generate a crisis alert
  if (!state.eventChecks) return 1;        // 2. crisis level 0, begin event checks
  if (!state.timers.length) {
    // 6. something has been resolved and nothing is left running or waiting: go home.
    if (state.resolved > 0 && !(state.crises || []).length) return 5;
    return 2;                              // 3. choose a crisis, start timers
  }
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

/**
 * One unmistakable "do this next" per loop step. The step strip shows the whole sequence, but a
 * first-time player needs a single button and a reason, not six numbered lines to interpret.
 * Every entry maps to the same step index as SOLO_SETUP.loop.
 */
const NEXT_STEP = [
  { label: "Generate crisis alert",
    why: "Nothing is happening yet. Roll an alert — the threat tables turn into the emergency your hero answers.",
    run: (state, mount) => generateAlert(state, mount) },
  { label: "Make an event check",
    why: "The crisis level starts at 0. Event checks are the heartbeat: they decide whether the situation escalates, holds, or hands you an opportunity.",
    run: (state, mount) => doEventCheck(state, mount) },
  { label: "Engage a crisis",
    why: "Pick one of the dangers below and start a crisis timer for it. A running timer is what makes the clock tick without a GM.",
    run: (state, mount) => focusCard(state, mount, "solo-crises") },
  { label: "Check your timers",
    why: "Play the scene, then check every running timer as time passes. Ask the oracles whenever you would have asked a GM.",
    run: (state, mount) => focusCard(state, mount, "solo-timers") },
  { label: "Play a social scene",
    why: "Something resolved. A social scene restores Resolve equal to your PRESENCE — take it before the next danger.",
    run: (state, mount) => socialScene(state, mount) },
  { label: "Head home — rest and bank karma",
    why: "No crisis is running and none is waiting. Rest to recover fully, claim the karma your reached objectives paid, then take a new alert when the next one breaks.",
    run: (state, mount) => headHome(state, mount) },
];

/**
 * Loop step 6. Solo karma comes from objective timers rather than the session questions (§3.20),
 * so going home is where it is actually claimed — and it needed a control of its own.
 */
async function headHome(state, mount) {
  const c = Store.activeCharacter();
  const reached = (state.objectives || []).filter((o) => o.status === "reached");
  const owed = reached.reduce((n, o) => n + (o.karma || 0), 0);
  const body = el("div", {},
    el("p", { class: "lede", text: "A few hours' rest: all Health and all Resolve return." }),
    reached.length
      ? el("p", { text: `${reached.length} reached objective${reached.length === 1 ? "" : "s"} paying ${owed} karma.` })
      : el("p", { class: "muted small", text: "No objectives reached this time — solo karma comes from objective timers, not the session questions." }),
    el("p", { class: "muted small", text: "Karma is spent between sessions, in a safe location. Home counts." }));
  const go = await modal({ title: "Head home", body,
    actions: [{ label: "Not yet", value: false, variant: "ghost" }, { label: "Rest and recover", value: true, variant: "primary" }] }).promise;
  if (!go) return;
  if (c) {
    Store.updateCharacter((ch) => {
      ch.state.health = Derived.maxHealth(ch);
      ch.state.resolve = Derived.maxResolve(ch);
      ch.state.session.spendUnlocked = true;
    }, { id: c.id });
  }
  if (owed) Store.updateCharacter((ch) => { ch.state.karma += owed; });
  state.objectives = (state.objectives || []).filter((o) => o.status !== "reached");
  state.alert = "";
  state.crises = [];
  state.eventChecks = 0;
  state.resolved = 0;
  logEvent(state, "Headed home: rested, recovered and banked objective karma.");
  save(state);
  showToast(`Rested${owed ? `, +${owed} karma` : ""}. Karma spending is open — the next alert starts a new crisis.`, { variant: "good", timeout: 6000 });
  renderSolo(mount);
}

/** Scroll the relevant panel into view and flash it, for steps whose action lives further down. */
function focusCard(state, mount, id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.classList.add("flash");
  setTimeout(() => target.classList.remove("flash"), 1400);
}

function nextStepCard(state, mount) {
  const i = currentStep(state);
  const step = NEXT_STEP[i];
  return el("section", { class: "card next-step", id: "solo-next" },
    el("p", { class: "next-step-eyebrow", text: `Step ${i + 1} of 6 — do this next` }),
    el("h2", { text: step.label }),
    el("p", { class: "next-step-why", text: step.why }),
    el("div", { class: "row-actions" },
      el("button", { class: "btn primary big", onclick: () => step.run(state, mount) }, step.label),
      el("a", { class: "btn ghost", href: "#/learn", onclick: () => setLearnTab("solo") }, "New to solo play? Read the walkthrough")));
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
    el("summary", { text: `${spare} spare 6 on an attribute roll — choose one bonus effect` }));
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

const diceRow = (faces) => el("div", { class: "dice-row" },
  ...faces.map((f) => el("span", { class: `die ${f === 6 ? "six" : f === 1 ? "one" : ""}`, text: String(f) })));

function logEvent(state, text) {
  state.log.unshift({ at: Date.now(), text });
  state.log = state.log.slice(0, 60);
  announce(text);
}

/**
 * Ch.9 recovery. A solo hero broken by damage or stress still acts, at -1 die, and one broken by
 * stress may make the PRESENCE roll "as if aided by an ally" — the aid being an important memory,
 * so it takes the standard +1 help die (Ch.4). The panel only appears when it applies.
 */
function recoveryCard(state, mount) {
  const c = Store.activeCharacter();
  if (!c) return null;
  const broken = c.state.health <= 0;
  const stressed = c.state.resolve <= 0;
  if (!broken && !stressed) return null;
  const card = el("section", { class: "card", id: "solo-recovery" },
    el("h3", { text: broken && stressed ? "Broken and stressed out" : broken ? "Broken" : "Stressed out" }),
    el("p", { class: "warn", text: S.SOLO_SETUP.recovery[0] }),
    el("p", { class: "muted small", text: S.SOLO_SETUP.recovery[1] }));
  const row = el("div", { class: "row-actions" });
  if (stressed) row.append(el("button", { class: "btn primary", onclick: () => rallyOnMemory(state, mount) }, "Rally on a memory (PRESENCE)"));
  if (broken) row.append(el("a", { class: "btn", href: "#/sheet" }, "Rally or stabilise on the sheet"));
  card.append(row);
  return card;
}

async function rallyOnMemory(state, mount) {
  const c = Store.activeCharacter();
  if (!c) return;
  const memory = await promptModal("What comforts or inspires you in this moment?", {
    title: "Rally on a memory",
    hints: ["Broken by stress, you roll PRESENCE as if an ally were helping — the help is a memory, worth the standard +1 die.",
      "Each 6 restores 1 Resolve. Use the answer to explore your hero's backstory and motivations."],
  });
  if (memory === null) return;
  const pool = Math.max(1, Derived.attributePool(c, "presence") + 1);   // +1 help die (Ch.4)
  const faces = Array.from({ length: pool }, () => d6());
  const sixes = faces.filter((f) => f === 6).length;
  if (sixes) Store.updateCharacter((ch) => { ch.state.resolve = clamp(ch.state.resolve + sixes, 0, Derived.maxResolve(ch)); }, { id: c.id });
  logEvent(state, `Rallied on a memory${memory ? ` (${memory})` : ""}: +${sixes} Resolve.`);
  save(state);
  modal({ title: "Rally on a memory",
    body: el("div", {},
      memory ? el("p", { class: "lede", text: memory }) : null,
      el("div", { class: "dice-row" }, ...faces.map((f) => el("span", { class: `die ${f === 6 ? "six" : f === 1 ? "one" : ""}`, text: String(f) }))),
      el("p", { class: sixes ? "good" : "bad", text: sixes ? `+${sixes} Resolve.` : "No 6s — the moment passes." }),
      el("p", { class: "muted small", text: `${pool} dice: PRESENCE plus 1 help die for the memory.` })),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* --------------------------------------------- "what just happened?" — the one control that
   removes the guesswork. Each timer type has a DIFFERENT trigger in Ch.9, and knowing which to
   roll is the hardest part of solo play. So the app asks what the hero did and fires the right
   checks, in the right order, with the right modifiers. */

const MOVES = [
  { key: "zone", label: "I moved to a new place",
    when: "Walking into the next zone, room, street or corridor.",
    fires: "Encounter check · crisis timers",
    steps: ["encounter", "timers"] },
  { key: "search", label: "I searched, waited or worked on something",
    when: "Lingering anywhere for a few minutes or more — searching, picking a lock, treating the wounded.",
    fires: "Encounter check · crisis timers at +1 die (it took time)",
    steps: ["encounter", "timers+"] },
  { key: "milestone", label: "Something moved my objective",
    when: "You learned something, reached somewhere, or lost ground. For or against — both count.",
    fires: "Objective check · event check",
    steps: ["objective", "event"] },
  { key: "allies", label: "My allies faced danger",
    when: "The group fought, held a line, evacuated people, or tried something risky.",
    fires: "Ally check",
    steps: ["ally"] },
  { key: "fight", label: "A fight or a long scene ended",
    when: "Combat is over, or a chase, or anything that ate real time.",
    fires: "Crisis timers at +1 die · event check",
    steps: ["timers+", "event"] },
  { key: "scene", label: "Time jumped, or the scene changed",
    when: "You travelled, waited hours, or tied off a chunk of the mission.",
    fires: "Crisis timers · event check",
    steps: ["timers", "event"] },
];

async function whatHappened(state, mount) {
  const pick = await chooseModal("What did your hero just do?", MOVES.map((m) => ({
    label: m.label, hint: `${m.when}  →  ${m.fires}`, value: m.key })));
  if (!pick) return;
  const move = MOVES.find((m) => m.key === pick);
  const report = el("div", {});
  let acted = false;

  for (const step of move.steps) {
    if (step === "encounter") {
      if (!state.encounter) continue;                       // no exploration scene running
      const r = rollEncounter(state);
      acted = true;
      report.append(el("h4", { class: "section", text: "Encounter check" }), diceRow(r.faces),
        el("p", { text: `${r.dice} enemy dice → enemy presence ${r.presence.name}.` }));
      if (r.evidence) report.append(el("p", { class: "muted small", text: r.evidence.text }));
      if (r.behaviour) {
        report.append(el("p", { class: "warn" }, el("strong", { text: `Encounter! ${r.behaviour.name}. ` }), r.behaviour.effect),
          el("p", { class: "small", text: `${r.threat.name} — ${r.threat.examples}` }),
          el("p", { class: "small", text: "The Encounter timer panel now shows the next step." }));
      }
    } else if (step === "timers" || step === "timers+") {
      if (!state.timers.length) {
        report.append(el("h4", { class: "section", text: "Crisis timers" }),
          el("p", { class: "warn small", text: "None running. Start one — the chapter says always keep at least one going." }));
        continue;
      }
      acted = true;
      state.lastTimerLines = [];
      const pace = step === "timers+" ? 1 : 0;
      for (const t of [...state.timers]) rollTimer(state, t, pace);
      report.append(el("h4", { class: "section", text: `Crisis timers${pace ? " (+1 die — that took time)" : ""}` }),
        ...state.lastTimerLines.map((l) => el("p", { text: l })));
    } else if (step === "objective") {
      if (!state.objectives.length) {
        report.append(el("h4", { class: "section", text: "Objectives" }),
          el("p", { class: "muted small", text: "None set. Objectives are where solo karma comes from — set one." }));
        continue;
      }
      const live = state.objectives.filter((o) => o.status !== "reached");
      if (!live.length) { report.append(el("p", { class: "good small", text: "Your objective is already reached — claim its karma." })); continue; }
      const which = live.length === 1 ? live[0].id
        : await chooseModal("Which objective moved?", live.map((o) => ({ label: o.name, hint: S.OBJECTIVE_TIMER.ladder.find((l) => l.key === o.status).name, value: o.id })));
      const obj = live.find((o) => o.id === which);
      if (!obj) continue;
      const r = rollObjective(state, obj);
      acted = true;
      report.append(el("h4", { class: "section", text: `Objective — ${obj.name}` }), diceRow(r.faces),
        r.penalty ? el("p", { class: "warn small", text: `${r.phase.name}: ${r.penalty} progress dice.` }) : null,
        el("p", { text: r.message }));
    } else if (step === "ally") {
      const live = state.allies.filter((a) => a.status !== "alone");
      if (!live.length) {
        report.append(el("h4", { class: "section", text: "Allies" }),
          el("p", { class: "muted small", text: state.allies.length ? "You are Alone — there is nobody left to roll for." : "No ally group tracked." }));
        continue;
      }
      const which = live.length === 1 ? live[0].id
        : await chooseModal("Which group?", live.map((a) => ({ label: a.name, hint: S.ALLY_TIMER.ladder.find((l) => l.key === a.status).name, value: a.id })));
      const ally = live.find((a) => a.id === which);
      if (!ally) continue;
      const bonus = await chooseModal("Does this suit them?", [
        { label: "No bonus", value: 0 },
        { label: "Suited to their role (+2)", value: 2 },
        { label: "Situation strongly favours them (+3)", value: 3 },
      ]);
      if (bonus === null) continue;
      const fight = await chooseModal("Were they fighting?", [
        { label: "Not a fight", hint: "Successes are simply progress", value: false },
        { label: "In a fight", hint: "Each 6 becomes 2 damage to enemies", value: true },
      ]);
      const r = rollAlly(state, ally, Number(bonus), fight === true);
      acted = true;
      report.append(el("h4", { class: "section", text: `Allies — ${ally.name}` }), diceRow(r.faces), el("p", { text: r.text }));
    } else if (step === "event") {
      const r = rollEventCheck(state);
      acted = true;
      report.append(el("h4", { class: "section", text: `Event check — ${r.value}` }), el("p", { text: r.entry.text }),
        r.extra ? el("p", { class: "lede", text: r.extra }) : null,
        r.rolls ? el("p", { class: "muted small", text: r.rolls }) : null);
    }
  }

  save(state);
  modal({ title: move.label,
    body: el("div", {}, report,
      el("p", { class: "muted small", text: acted ? `Rolled: ${move.fires}.` : "Nothing was running that this affects." })),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/** The card that fronts it — the second thing on the tab, under "do this next". */
function whatHappenedCard(state, mount) {
  return el("section", { class: "card", id: "solo-move" },
    el("h3", { text: "What did your hero just do?" }),
    el("p", { class: "muted small", text: "Each timer has its own trigger, and remembering which is the fiddliest part of solo play. Tell the app what happened and it rolls the right checks, in order, with the right modifiers." }),
    el("div", { class: "row-actions" },
      el("button", { class: "btn primary big", onclick: () => whatHappened(state, mount) }, "Something happened — roll it")),
    el("details", { class: "help" }, el("summary", { text: "Which timer fires when?" }),
      el("div", { class: "tablewrap" },
        el("table", { class: "data-table" },
          el("tr", {}, el("th", { text: "Timer" }), el("th", { text: "Check it when" })),
          el("tr", {}, el("td", { text: "Crisis" }), el("td", { text: "Time passes: between scenes, on a delay, changing location, or lingering. +1 die for anything lengthy, -1 for anything fast." })),
          el("tr", {}, el("td", { text: "Objective" }), el("td", { text: "A milestone happens — something meaningful for or against the goal. Never on a clock." })),
          el("tr", {}, el("td", { text: "Ally" }), el("td", { text: "The group faces a threat or tries something dangerous. Off-screen, at least once every few hours of game time." })),
          el("tr", {}, el("td", { text: "Encounter" }), el("td", { text: "Only while exploring somewhere a fight could break out — once per zone you move through or linger in. Ordinary travel needs no timer at all." }))))));
}

/* ---------------------------------------------------------------- render */

export function renderSolo(mount) {
  const state = load();
  clear(mount);
  const phase = phaseFor(state.crisisLevel);

  const step = currentStep(state);
  const primary = (n) => (step === n ? "btn primary" : "btn");

  mount.append(nextStepCard(state, mount));
  const recovery = recoveryCard(state, mount);
  if (recovery) mount.append(recovery);
  if (state.alert) mount.append(whatHappenedCard(state, mount));

  mount.append(el("section", { class: "card solo-header" },
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
      // Loop step 5 is "AFTER resolving an event, threat or objective, play a social scene" —
      // so resolving comes first in the row, as it does in the fiction.
      state.alert ? el("button", { class: "btn warn", onclick: () => resolveCrisis(state, mount) }, "Resolve crisis") : null,
      el("button", { class: primary(4), onclick: () => socialScene(state, mount) }, "Social scene"),
      undoSnapshot ? el("button", { class: "btn ghost", onclick: () => undoSolo(mount) }, `Undo ${undoSnapshot.label}`) : null),
    el("div", { class: "movement-modes" },
      el("span", { class: "crisis-label", text: "Moving" }),
      el("div", { class: "chiprow" }, ...S.MOVEMENT_MODES.map((m) => el("button", {
        class: `chip selectable ${state.mode === m.key ? "selected" : ""}`, title: m.desc,
        onclick: () => { state.mode = m.key; save(state); renderSolo(mount); },
      }, m.name)))),
    el("p", { class: "muted small", text: "Movement mode shifts both the crisis timer and the encounter timer." }),
    state.alert ? el("div", { class: "alert-box" }, crisisBody({ text: state.alert, parts: state.alertParts })) : null,
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
  const card = el("section", { class: "card", id: "solo-timers" },
    el("h3", { text: `Timers (${running} running)` }),
    helpPanel([
      "Timers are the pressure in solo play — they are what a GM would otherwise supply. There are four types and they all advance when time passes in the fiction.",
      "Crisis counts down to something bad. Objective counts up to your goal and pays karma. Ally tracks how a helping group is holding up. Encounter tracks how close the opposition is.",
      "Never let the board go empty: if nothing is running, nothing is pushing the story forward. Start a crisis timer first, then add whichever others fit the scene.",
    ]),
    running === 0
      ? el("p", { class: "warn small", text: "Nothing is running. Engage a crisis, or start a timer below." })
      : null);
  // Loop step 3's own order: "a crisis timer, plus any ally, objective or encounter timers".
  card.append(timersCard(state, mount));
  card.append(alliesCard(state, mount));
  card.append(objectivesCard(state, mount));
  card.append(encounterCard(state, mount));
  return card;
}

/* ---------------------------------------------------------------- oracles */

/**
 * Everything that answers a question a GM would normally answer, including the location engines —
 * which previously sat in a reference block with no stated trigger.
 */
function oraclesCard(state, mount) {
  const card = el("section", { class: "card", id: "solo-oracles" },
    el("h3", { text: "Ask the oracles" }),
    helpPanel([
      "Use these whenever you would otherwise have asked the GM something.",
      "Yes / no answers a closed question. Complex answer gives a directive and a subject to interpret when the question is open-ended.",
      "Crisis event is the book's jolt: if you are ever unsure what happens next, raise the crisis level by 1 and roll one. Opportunity is its counterpart — a positive turn or a helpful asset. Keep opportunities rare.",
      "Describe a place is the location engines: roll one when you arrive somewhere and need to know what it is actually like — a district, a stretch of terrain, a facility interior, the volume of space you just dropped into. The Atmosphere engine is mixed into the others automatically to colour the result.",
    ]));

  // The answer stays on the tab: a modal you have dismissed is no use half a scene later.
  card.append(state.lastOracle
    ? el("div", { class: "oracle-answer" },
      el("span", { class: "oracle-kind", text: state.lastOracle.kind }),
      el("p", { class: "lede", text: state.lastOracle.text }),
      state.lastOracle.detail ? el("p", { class: "muted small", text: state.lastOracle.detail }) : null,
      el("button", { class: "btn tiny ghost", onclick: () => { state.lastOracle = null; save(state); renderSolo(mount); } }, "Clear"))
    : el("p", { class: "muted small", text: "No answer yet. Roll an oracle and the result stays here for the rest of the scene." }));

  const group = (title, note, ...kids) => {
    const g = el("div", { class: "oracle-group" }, el("h4", { class: "group-head", text: title }));
    if (note) g.append(el("p", { class: "muted small", text: note }));
    g.append(...kids.filter(Boolean));
    return g;
  };

  card.append(group("Answer a question", "For anything you would have asked the GM outright.",
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => askBinary(state, mount) }, "Ask yes / no"),
      el("button", { class: "btn", onclick: () => askComplex(state, mount) }, "Complex answer"))));

  card.append(group("Find out what happens", "When you do not know what the situation does next.",
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => joltCrisisEvent(state, mount) }, "Crisis event"),
      el("button", { class: "btn", onclick: () => rollOpportunityEvent(state, mount) }, "Opportunity")),
    el("p", { class: "muted small", text: "A crisis event raises the crisis level by 1 and adds a new danger to Crises. An opportunity costs nothing and may count as a milestone for an objective check." })));

  const row = el("div", { class: "chiprow" });
  for (const key of Object.keys(S.LOCATION_ENGINES)) {
    row.append(el("button", { class: "chip", onclick: () => describePlace(state, mount, key) },
      S.LOCATION_ENGINES[key].name.replace(" Engine", "")));
  }
  card.append(group("Describe a place", "Roll the engine matching the scale you need.", row));
  return card;
}

/** Roll a location engine, blending in Atmosphere the way the chapter intends. */
function describePlace(state, mount, key) {
  const engine = S.LOCATION_ENGINES[key];
  const res = R.rollNamedTable(engine);
  const atmosphere = key === "atmosphere" ? null : R.rollNamedTable(S.LOCATION_ENGINES.atmosphere);
  const text = atmosphere ? `${atmosphere.entry.text} ${res.entry.text}` : res.entry.text;
  logEvent(state, `${engine.name}: ${text}`);
  // A location roll is not a passing answer — it is where the scene is happening. It stays on the
  // Encounter panel, next to the button that rolled it, until the hero moves somewhere else.
  state.place = { engine: engine.name, text, at: Date.now() };
  setOracle(state, engine.name, text, atmosphere
    ? `D66 ${res.value}, with Atmosphere ${atmosphere.value} rolled alongside so the place has a mood as well as a shape.`
    : `D66 ${res.value}.`);
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
/**
 * A crisis is four separate facts, not one run-on sentence: what kind of thing it is, what is
 * actually happening, where, and what makes it worse. They are stored apart so the card can lay
 * them out; `text` stays as the flat one-liner for the log and for timer names.
 */
function addCrisis(state, text, source, parts = null) {
  state.crises = state.crises || [];
  state.crises.push({ id: uid("crisis"), text, source, parts, at: Date.now() });
  return state.crises[state.crises.length - 1];
}

/** Lay a crisis out: kind above, the event itself as the lede, then where and the complication. */
function crisisBody(c) {
  const p = c.parts;
  if (!p) return el("p", { class: "small", text: c.text });
  return el("div", { class: "crisis-body" },
    p.kind ? el("span", { class: "crisis-kind", text: p.kind }) : null,
    el("p", { class: "crisis-head", text: p.headline }),
    p.where ? el("p", { class: "crisis-where", text: p.where }) : null,
    p.complication ? el("p", { class: "crisis-comp" },
      el("strong", { text: "Complication " }), p.complication) : null);
}

function crisesCard(state, mount) {
  const card = el("section", { class: "card", id: "solo-crises" }, el("h3", { text: `Crises (${(state.crises || []).length})` }));
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
    card.append(el("div", { class: "timer crisis" },
      el("div", { class: "crisis-main" },
        el("span", { class: "crisis-source", text: c.source === "alert" ? "From the alert" : "From an event check" }),
        crisisBody(c)),
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

async function engageCrisis(state, crisis, mount) {
  const start = await chooseProximity(state, "How close is it?");
  if (!start) return;
  const name = crisis.parts?.headline || crisis.text;
  const detail = crisis.parts?.complication ? `Complication: ${crisis.parts.complication}` : null;
  state.timers.push({ id: uid("timer"), name, proximity: start, crisisId: crisis.id, detail });
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
  const span = await chooseModal("How long is the scene?", [
    { label: "A brief scene", hint: "Resolve restored equal to your PRESENCE", value: "brief" },
    { label: "Combined with a few hours' rest", hint: "All Resolve and all Health", value: "long" },
  ]);
  if (!span) return;
  let restored = 0;
  let healed = 0;
  if (hero) {
    Store.updateCharacter((ch) => {
      const before = ch.state.resolve;
      ch.state.resolve = span === "long" ? Derived.maxResolve(ch)
        : clamp(ch.state.resolve + Derived.effectiveAttributes(ch).presence, 0, Derived.maxResolve(ch));
      restored = ch.state.resolve - before;
      if (span === "long") {
        const h = ch.state.health;
        ch.state.health = Derived.maxHealth(ch);
        ch.state.broken = false;
        healed = ch.state.health - h;
      }
    }, { id: hero.id });
  }
  state.awaitingSocial = false;
  logEvent(state, `Social scene${restored ? ` — Resolve +${restored}` : ""}${healed ? `, Health +${healed}` : ""}`);
  save(state);
  const hook = el("p", { class: "lede" });
  modal({ title: "Social scene",
    body: el("div", {},
      hero ? el("p", { class: "good", text: span === "long"
        ? `A few hours' rest: Resolve +${restored}, Health +${healed}.`
        : `Resolve restored equal to your PRESENCE: +${restored}.` })
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
  state.resolved = (state.resolved || 0) + 1;
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
  addCrisis(state, ev.text, "event", { kind: ev.focus, headline: ev.detail });
  logEvent(state, `Crisis event (${ev.focusRoll}/${ev.detailRoll}): ${ev.text}`);
  setOracle(state, "Crisis event", ev.text,
    `Focus D66 ${ev.focusRoll} · detail 2D6 + crisis level = ${ev.detailRoll} (${ev.band.label}). Crisis level is now ${state.crisisLevel}. Added to Crises.`);
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

/**
 * The Opportunity Event Engine, on demand. The event check reaches it on 11-12, but the chapter
 * also calls for one whenever a FATE response points at a positive turn — so it needs its own
 * control rather than existing only as a rare side effect.
 */
function rollOpportunityEvent(state, mount) {
  const opp = rollOpportunity();
  logEvent(state, `Opportunity (${opp.value}): ${opp.text}`);
  setOracle(state, "Opportunity", opp.text,
    `D66 ${opp.value}. Keep these rare; one may count as a milestone that triggers an objective check.`);
  save(state);
  modal({ title: "Opportunity",
    body: el("div", {},
      el("p", { class: "lede big", text: opp.text }),
      el("p", { class: "muted small", text: `D66 ${opp.value}. A positive twist or a helpful asset — the counterweight to a crisis event.` }),
      el("p", { class: "small", text: "This may count as a milestone: if it moves an objective along, roll that objective's progress." })),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- FATE tools */

function rollEventCheck(state) {
  state.eventChecks = (state.eventChecks || 0) + 1;
  const value = roll2d6();
  const entry = tableLookup(S.EVENT_CHECK.entries, value);
  let extra = "";
  let rolls = "";
  if (value === 2) {
    state.crisisLevel = clamp(state.crisisLevel + 2, 0, 10);
    const a = rollCrisisEvent(state), b = rollCrisisEvent(state);
    addCrisis(state, a.text, "event", { kind: a.focus, headline: a.detail });
    addCrisis(state, b.text, "event", { kind: b.focus, headline: b.detail });
    extra = `${a.text} / ${b.text}`;
    rolls = `Focus ${a.focusRoll}/${b.focusRoll} · detail ${a.detailRoll}/${b.detailRoll}`;
  } else if (value <= 4) {
    state.crisisLevel = clamp(state.crisisLevel + 1, 0, 10);
    const one = rollCrisisEvent(state);
    addCrisis(state, one.text, "event", { kind: one.focus, headline: one.detail });
    extra = one.text;
    rolls = `Focus D66 ${one.focusRoll} · detail 2D6 + crisis level = ${one.detailRoll} (${one.band.label})`;
  } else if (value >= 11) {
    const opp = rollOpportunity();
    extra = `Opportunity: ${opp.text}`;
    rolls = `Opportunity D66 ${opp.value}. These should stay rare, and may count as a milestone for an objective check.`;
  }
  logEvent(state, `Event check ${value}: ${entry.text}${extra ? ` — ${extra}` : ""}`);
  setOracle(state, `Event check ${value}`, extra || entry.text, rolls || entry.text);
  return { value, entry, extra, rolls };
}

function doEventCheck(state, mount) {
  offSequence(state, 1, "an event check");
  const r = rollEventCheck(state);
  save(state);
  modal({ title: `Event check — ${r.value}`,
    body: el("div", {}, el("p", { text: r.entry.text }), r.extra ? el("p", { class: "lede", text: r.extra }) : null,
      r.rolls ? el("p", { class: "muted small", text: r.rolls }) : null,
      r.value <= 4 ? el("p", { class: "muted small", text: "Added to Crises — engage it there to start a timer, or leave it pending." }) : null),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/** The flat one-liner: for the log, for timer names, and for old saves without parts. */
function flattenCrisis(p) {
  return [p.kind ? `${p.kind}:` : null, p.headline, p.where ? `(${p.where})` : null,
    p.complication ? `Complication: ${p.complication}` : null].filter(Boolean).join(" ");
}

function complexPhrase() {
  const dir = S.COMPLEX_ENGINE.directives[d66()];
  const sub = S.COMPLEX_ENGINE.subjects[d66()];
  return `${dir} ${sub}`;
}

/** The Binary Response Engine as a plain roll, so other procedures can consult it. */
function binaryRoll(odds = "even") {
  let value;
  if (odds === "even") value = d6();
  else { const a = d6(), b = d6(); value = odds === "yes" ? Math.max(a, b) : Math.min(a, b); }
  return { value, entry: tableLookup(S.BINARY_ENGINE.entries, value) };
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
  setOracle(state, "Yes / no", `${question} — ${entry.text}`, `D6 ${value}${odds === "even" ? "" : `, ${odds === "yes" ? "keeping the highest of 2D6" : "keeping the lowest of 2D6"}`}.`);
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
  setOracle(state, "Complex answer", `${question} — ${dir} ${sub}`, `Directive ${dirRoll} · Subject ${subRoll}.`);
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
  let parts;
  if (/criminal/i.test(pick)) {
    const crime = R.rollNamedTable(D.GM_TABLES.crime);
    const comp = R.rollNamedTable(D.GM_TABLES.crimeComplications);
    parts = { kind: "Criminal activity", headline: crime.entry.text, complication: comp.entry.text };
  } else if (/city/i.test(pick)) {
    const cat = R.rollNamedTable(D.GM_TABLES.catalyst);
    const inc = R.rollNamedTable(D.GM_TABLES.incidents);
    const loc = R.rollNamedTable(D.GM_TABLES.cityLocations);
    const comp = R.rollNamedTable(D.GM_TABLES.incidentComplications);
    parts = { kind: cat.entry.text, headline: inc.entry.text, where: loc.entry.text, complication: comp.entry.text };
  } else if (/global/i.test(pick)) {
    const cat = R.rollNamedTable(D.GM_TABLES.globalCategory);
    const key = "global" + cat.entry.text.replace(/[^a-z]/gi, "");
    const table = D.GM_TABLES[key] || D.GM_TABLES.globalCriminal;
    const danger = R.rollNamedTable(table);
    const comp = R.rollNamedTable(D.GM_TABLES.globalComplications);
    parts = { kind: `${cat.entry.text} danger`, headline: danger.entry.text, complication: comp.entry.text };
  } else {
    parts = { kind: "Cosmic peril", headline: complexPhrase(), complication: R.rollNamedTable(D.GM_TABLES.globalComplications).entry.text };
  }
  const text = flattenCrisis(parts);
  state.alert = text;
  state.alertParts = parts;
  state.crisisLevel = 0;
  state.eventChecks = 0;
  state.awaitingSocial = false;
  state.crises = [];
  addCrisis(state, text, "alert", parts);
  logEvent(state, `New crisis alert: ${text}`);
  save(state);
  renderSolo(mount);
  modal({ title: "Crisis alert",
    body: el("div", {},
      crisisBody({ parts }),
      el("p", { class: "muted small", text: S.SOLO_SETUP.alertNote }),
      el("p", { class: "small", text: "Next: make an event check, then engage this crisis to start a timer." }),
      el("h4", { class: "section", text: "Where is it?" }),
      el("p", { class: "muted small", text: "Roll a location engine if you need the place itself described." }),
      el("div", { class: "chiprow" }, ...Object.keys(S.LOCATION_ENGINES).map((k) =>
        el("button", { class: "chip", onclick: () => describePlace(state, mount, k) },
          S.LOCATION_ENGINES[k].name.replace(" Engine", ""))))),
    actions: [{ label: "OK", variant: "primary" }] });
}

/* ---------------------------------------------------------------- reading a timer at a glance */

/**
 * One shape for every timer row. A bare status name ("Imminent", "Overwhelmed") tells you nothing
 * about which way is bad or how much road is left, so each row shows a ladder of pips, the dice it
 * rolls right now, and one plain sentence saying what happens next.
 */
function timerRow({ name, ladder, index, diceLabel, meaning, tone, note, actions }) {
  const steps = ladder.length - 1;                       // the last rung is the outcome, not a step
  const left = steps - index;
  const pips = el("span", { class: `pips ${tone}`, "aria-hidden": "true" });
  ladder.forEach((_, i) => pips.append(el("span", { class: `pip ${i <= index ? "on" : ""} ${i === ladder.length - 1 ? "end" : ""}` })));
  return el("div", { class: `timer ${tone}` },
    el("div", { class: "timer-main" },
      el("strong", { class: "timer-name", text: name }),
      el("div", { class: "timer-track" }, pips,
        el("span", { class: "timer-status", text: `${ladder[index].name}${diceLabel ? ` · ${diceLabel}` : ""}` })),
      el("p", { class: "timer-meaning", text: meaning }),
      note ? el("p", { class: "muted small", text: note }) : null),
    el("div", { class: "chosen-actions" }, ...actions.filter(Boolean)));
}

const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ---------------------------------------------------------------- crisis timers */

function timersCard(state, mount) {
  const card = el("div", { class: "timer-group" }, el("h4", { class: "group-head", text: "Crisis timers" }),
    helpPanel(["A crisis timer counts down to something bad happening. Check it whenever time passes in the fiction.", "Each 6 rolled moves it closer. When it reaches 'now' the event fires, the crisis level rises by 1, and the timer is removed.", "Keep at least one running at all times — that is what drives solo play forward without a GM."]),
    el("p", { class: "trigger", text: "Check when: time passes — between scenes, on a delay, changing location, or lingering somewhere." }),
    el("p", { class: "muted small", text: S.CRISIS_TIMER.sourceGap ? "Proximity labels follow the surrounding rules text; the supplied table was partly truncated." : "" }));
  for (const t of state.timers) {
    const ladder = S.CRISIS_TIMER.ladder;
    const idx = Math.max(0, ladder.findIndex((l) => l.key === t.proximity));
    const left = ladder.length - 1 - idx;
    card.append(timerRow({
      name: t.name,
      ladder, index: idx, tone: left <= 1 ? "t-hot" : left <= 2 ? "t-warm" : "t-cool",
      diceLabel: `roll ${count(ladder[idx].dice, "die", "dice")}`,
      meaning: left === 0
        ? "It is happening now. Deal with the consequences, then start another timer."
        : `${count(left, "step")} from happening. Every 6 you roll moves it one step closer.`,
      note: t.detail || null,
      actions: [
        el("button", { class: "btn tiny primary", onclick: () => checkTimer(state, t, mount) }, "Check"),
        el("button", { class: "btn tiny ghost", onclick: () => { state.timers = state.timers.filter((x) => x.id !== t.id); logEvent(state, `Timer stopped: ${t.name}`); save(state); renderSolo(mount); } }, "Stop"),
      ],
    }));
  }
  if (!state.timers.length) card.append(el("p", { class: "warn small", text: "No timer running. Always keep at least one." }));
  const mode = S.MOVEMENT_MODES.find((m) => m.key === state.mode) || S.MOVEMENT_MODES[0];
  card.append(el("p", { class: "muted small", text: mode.crisis === 0
    ? `Moving ${mode.name.replace(" (default)", "").toLowerCase()}: these checks roll as printed.`
    : `Moving ${mode.name.toLowerCase()} adds ${mode.crisis > 0 ? "+1 die to" : "-1 die from"} every check here.` }));
  const row = el("div", { class: "row-actions" });
  if (state.timers.length > 1) row.append(el("button", { class: "btn", onclick: () => checkAllTimers(state, mount) }, "Time passes — check every timer"));
  row.append(el("button", { class: currentStep(state) === 2 ? "btn primary" : "btn", onclick: () => addTimer(state, mount) }, "Start a crisis timer"));
  card.append(row);
  return card;
}

/**
 * "Give the event a proximity using the table. If unsure, roll 2D6 to pick one based on the current
 * crisis phase." The supplied 2D6 table is truncated (CRISIS_TIMER.sourceGap), so the roll falls
 * back to the phase's starting rung named in the surrounding prose — flagged as such in the dialog.
 */
async function chooseProximity(state, title) {
  const phase = phaseFor(state.crisisLevel);
  const fallback = S.CRISIS_TIMER.startByPhase[phase.key];
  const options = S.CRISIS_TIMER.ladder.slice(0, 5).map((l) => ({
    label: l.name, hint: `${l.dice} threat dice`, value: l.key }));
  options.push({ label: `Unsure — roll for it (${phase.name})`, hint: `Rolls 2D6 against the ${phase.name.toLowerCase()} column`, value: "__roll" });
  const pick = await chooseModal(title, options);
  if (!pick) return null;
  return pick === "__roll" ? fallback : pick;
}

/** The book's two suggested seeds for "what does this timer trigger?". */
function timerSeed(state) {
  const ev = rollCrisisEvent({ crisisLevel: 10 });    // rightmost column, as the chapter advises
  return Math.random() < 0.5 ? complexPhrase() : ev.text;
}

async function addTimer(state, mount) {
  let name = await promptModal("What will this timer trigger? Leave blank for 'bad thing happens'.", {
    title: "New crisis timer",
    hints: [
      "Decide what happens when it runs out. If you have nothing specific in mind, leave it blank — your hero just has a sense of impending doom and you find out together.",
      "For inspiration, roll the Complex Response Engine, or take a result from the rightmost column of the Crisis Event Engine.",
    ],
    suggest: { label: "Roll an engine for it", fn: () => timerSeed(state) },
  });
  if (name === null) return;
  if (!name.trim()) name = `Bad thing happens (${complexPhrase()})`;
  const start = await chooseProximity(state, "How close is it?");
  if (!start) return;
  state.timers.push({ id: uid("timer"), name, proximity: start });
  logEvent(state, `Timer started: ${name} (${start})`);
  save(state);
  renderSolo(mount);
}

/** How long the thing that just happened took: the chapter's +1 / -1 threat die (Ch.9). */
async function askDuration(title = "How long did that take?") {
  return chooseModal(title, [
    { label: "As long as expected", hint: "No modifier", value: 0 },
    { label: "A lengthy scene or action", hint: "+1 threat die on every timer", value: 1 },
    { label: "Faster than normal", hint: "-1 threat die (minimum 1)", value: -1 },
  ]);
}

/** "Repeat this check for each active timer" — time passes for all of them at once. */
async function checkAllTimers(state, mount) {
  if (!state.timers.length) { showToast("No timer running. Always keep at least one.", { variant: "warn" }); return; }
  const pace = await askDuration();
  if (pace === null) return;
  for (const t of [...state.timers]) rollTimer(state, t, Number(pace));
  save(state);
  modal({ title: "Time passes",
    body: el("div", {}, ...state.lastTimerLines.map((l) => el("p", { text: l })),
      el("p", { class: "muted small", text: "Each active timer was checked once, as the chapter requires." })),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/** One timer's threat roll. Returns the faces so a single check can also render its dice. */
function rollTimer(state, timer, pace = 0) {
  const ladder = S.CRISIS_TIMER.ladder;
  const idx = ladder.findIndex((l) => l.key === timer.proximity);
  const rung = ladder[idx];
  const mode = S.MOVEMENT_MODES.find((m) => m.key === state.mode) || S.MOVEMENT_MODES[0];
  const dice = Math.max(1, rung.dice + mode.crisis + pace);
  const faces = Array.from({ length: dice }, () => d6());
  const sixes = faces.filter((f) => f === 6).length;
  const next = Math.min(ladder.length - 1, idx + sixes);
  timer.proximity = ladder[next].key;
  let fired = false;
  if (ladder[next].key === "now") {
    fired = true;
    state.crisisLevel = clamp(state.crisisLevel + 1, 0, 10);
    state.timers = state.timers.filter((t) => t.id !== timer.id);
  }
  const line = `${timer.name}: ${dice} dice, ${sixes} sixes → ${ladder[next].name}${fired ? " — IT HAPPENS (crisis level +1)" : ""}`;
  state.lastTimerLines = (state.lastTimerLines || []).concat(line).slice(-8);
  logEvent(state, line);
  return { faces, sixes, fired, name: ladder[next].name, dice };
}

async function checkTimer(state, timer, mount) {
  const pace = await askDuration();
  if (pace === null) return;
  state.lastTimerLines = [];
  const res = rollTimer(state, timer, Number(pace));
  const { faces, sixes, fired } = res;
  const dice = res.dice;
  save(state);
  modal({ title: fired ? "The timer fires!" : "Timer check",
    body: el("div", {},
      el("div", { class: "dice-row" }, ...faces.map((f) => el("span", { class: `die ${f === 6 ? "six" : f === 1 ? "one" : ""}`, text: String(f) }))),
      el("p", { text: `${timer.name}: ${dice} dice → ${res.name}.` }),
      fired ? el("p", { class: "bad", text: "Deal with the consequences, then start another timer — always keep one running. Crisis level +1." }) : null),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- objectives */

function objectivesCard(state, mount) {
  const card = el("div", { class: "timer-group" }, el("h4", { class: "group-head", text: "Objectives" }),
    helpPanel(["What your hero is trying to achieve. Objectives are how you earn karma in solo play, replacing the end-of-session questions.", "Roll Progress to advance along the ladder. 1s cancel 6s, and a net-negative result pushes the objective one step back.", "When it reaches the top of the ladder, claim the karma shown on the row."]),
    el("p", { class: "trigger", text: "Check when: a milestone happens — something meaningful for or against the goal. Never on a clock." }));
  for (const o of state.objectives) {
    const ladder = S.OBJECTIVE_TIMER.ladder;
    const idx = Math.max(0, ladder.findIndex((l) => l.key === o.status));
    const left = ladder.length - 1 - idx;
    const phase = phaseFor(state.crisisLevel);
    const pen = phase.key === "medium" ? -1 : phase.key === "high" ? -2 : 0;
    const dice = Math.max(1, ladder[idx].dice + pen);
    card.append(timerRow({
      name: o.name,
      ladder, index: idx, tone: left === 0 ? "t-done" : "t-good",
      diceLabel: left === 0 ? `worth ${o.karma} karma` : `roll ${count(dice, "die", "dice")}${pen ? ` (${pen} for ${phase.name.toLowerCase()})` : ""}`,
      meaning: left === 0
        ? `Reached. Claim ${count(o.karma, "karma point")} — it pays what the objective was worth when you set it.`
        : `${count(left, "step")} to go, then ${count(o.karma, "karma point")}. Every 6 advances it; every 1 cancels a 6, and more 1s than 6s pushes it back a step.`,
      actions: [
        left === 0
          ? el("button", { class: "btn tiny primary", onclick: () => completeObjective(state, o, mount) }, "Claim karma")
          : el("button", { class: "btn tiny primary", onclick: () => objectiveCheck(state, o, mount) }, "Progress"),
        el("button", { class: "btn tiny ghost", onclick: () => { state.objectives = state.objectives.filter((x) => x.id !== o.id); save(state); renderSolo(mount); } }, "Drop"),
      ],
    }));
  }
  card.append(el("p", { class: "muted small", text: S.OBJECTIVE_TIMER.rules[0] }));
  card.append(el("button", { class: "btn", onclick: () => addObjective(state, mount) }, "Set an objective"));
  return card;
}

/**
 * The rules give a principle for writing one (OBJECTIVE_TIMER.rules): name it, give it a starting
 * status, and expect distant objectives to progress slowly and pay more karma. Those lines are
 * surfaced in the dialog, because "what makes a good objective?" was otherwise unanswered.
 */
async function addObjective(state, mount) {
  const name = await promptModal("What is your hero trying to achieve?", {
    title: "New objective",
    placeholder: "Find out who armed them",
    hints: [
      "Write one thing you are working towards across the whole crisis — not a single action. Anything you could resolve with one roll is a roll, not an objective.",
      ...S.OBJECTIVE_TIMER.rules.slice(0, 1),
      "It can also measure progress through a place when you are not using a map — 'reach the reactor core'.",
      "Progress comes from milestones in the fiction: each time something meaningful happens for or against it, roll its progress dice.",
    ],
    suggest: { label: "Stuck? Ask the Complex Engine", fn: () => complexPhrase() },
  });
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
/** The objective roll on its own, so a composed move can run it without opening a dialog. */
function rollObjective(state, obj) {
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
  return { faces, sixes, ones, net, message, penalty, phase, dice };
}

function objectiveCheck(state, obj, mount) {
  const r = rollObjective(state, obj);
  save(state);
  modal({ title: obj.name,
    body: el("div", {},
      diceRow(r.faces),
      r.penalty ? el("p", { class: "warn small", text: `${r.phase.name}: ${r.penalty} progress dice.` }) : null,
      el("p", { text: r.message })),
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
    helpPanel(["A group helping you, tracked as one unit rather than as individual NPCs.", "Check them to see how they hold up: each 6 is a success (2 damage each in a fight), each 1 drops their status one step toward Alone.", "Allies aiding you directly give +2 dice to your own roll."]),
    el("p", { class: "trigger", text: "Check when: the group faces a threat or tries something dangerous. Off-screen, once every few hours of game time." }));
  for (const a of state.allies) {
    const ladder = S.ALLY_TIMER.ladder;
    const idx = Math.max(0, ladder.findIndex((l) => l.key === a.status));
    const left = ladder.length - 1 - idx;
    const gone = ladder[idx].dice === 0;
    card.append(timerRow({
      name: a.name,
      ladder, index: idx, tone: gone ? "t-gone" : left <= 1 ? "t-hot" : left <= 2 ? "t-warm" : "t-cool",
      diceLabel: gone ? "nobody left" : `roll ${count(ladder[idx].dice, "die", "dice")}`,
      meaning: gone
        ? "There is nobody left to roll for. You finish this alone."
        : `${count(left, "step")} from being wiped out. Every 6 is a win for them (2 damage in a fight); every 1 costs them a step.`,
      note: gone ? null : "They give you +2 dice when they are directly helping with what you are doing.",
      actions: [
        gone ? null : el("button", { class: "btn tiny primary", onclick: () => allyCheck(state, a, mount, false) }, "Check"),
        gone ? null : el("button", { class: "btn tiny", onclick: () => allyCheck(state, a, mount, true) }, "Fight"),
        el("button", { class: "btn tiny ghost", onclick: () => { state.allies = state.allies.filter((x) => x.id !== a.id); save(state); renderSolo(mount); } }, "Drop"),
      ],
    }));
  }
  if (!state.allies.length) card.append(el("p", { class: "muted small", text: "No allies yet? The group generator rolls one from the Ch.6 minion profiles." }));
  card.append(el("button", { class: "btn", onclick: () => addAllies(state, mount) }, "Add an ally group"));
  return card;
}

/**
 * Where an ally group comes from when you have no GM to introduce one: the Ch.6 minion profiles
 * are already groups-as-one-entity, which is exactly what the ally timer tracks. Rolled from the
 * book's own list rather than invented.
 */
function suggestAllyGroup() {
  const groups = NPC_PROFILES.filter((n) => n.minion);
  const pick = groups[Math.floor(Math.random() * groups.length)];
  return pick.desc ? `${pick.name} — ${pick.desc}` : pick.name;
}

async function addAllies(state, mount) {
  const name = await promptModal("Who is helping you?", {
    title: "Ally group",
    placeholder: "Police officers holding the cordon",
    hints: [
      "An ally group is one entity, not a list of NPCs — a squad, a crowd, a team, a family. Track a separate timer for each separate group.",
      "The Ch.6 minion profiles are ready-made groups: police officers, soldiers, bystanders, martial artists, gangsters, ninjas. Roll one below if nobody has turned up yet.",
      "You can also ask the oracles: use yes / no to test whether help arrives at all, then the Complex Engine for who they are.",
    ],
    suggest: { label: "Roll a group from Ch.6", fn: () => suggestAllyGroup() },
  });
  if (!name) return;
  const status = await chooseModal("Starting status", S.ALLY_TIMER.start.map((t) => {
    const [label, hint] = t.split(" — ");
    return { label, hint, value: label.toLowerCase() };
  }));
  if (!status) return;
  state.allies.push({ id: uid("ally"), name, status });
  save(state);
  renderSolo(mount);
}

/** Audit A25: each 6 is 2 damage in a fight; each 1 drops the status one step. */
function rollAlly(state, ally, bonus, inFight) {
  const ladder = S.ALLY_TIMER.ladder;
  const idx = ladder.findIndex((l) => l.key === ally.status);
  const rung = ladder[idx];
  const dice = Math.max(1, rung.dice + Number(bonus));
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
  return { faces, sixes, ones, damage, text, dice, status: ladder[next].name };
}

async function allyCheck(state, ally, mount, inFight) {
  const rung = S.ALLY_TIMER.ladder.find((l) => l.key === ally.status);
  if (rung.dice === 0) { showToast("You are alone — there is nobody left to roll for.", { variant: "warn" }); return; }
  const bonus = await chooseModal("Does this suit their role?", [
    { label: "No bonus", value: 0 },
    { label: "Suited to their role (+2)", value: 2 },
    { label: "Situation strongly favours them (+3)", value: 3 },
  ]);
  if (bonus === null) return;
  const r = rollAlly(state, ally, Number(bonus), inFight);
  save(state);
  modal({ title: ally.name,
    body: el("div", {},
      diceRow(r.faces),
      el("p", { text: r.text }),
      r.ones ? el("p", { class: "muted small", text: "Casualties can be deaths, injuries, infighting or being stressed out — ask the Binary Engine if unsure." }) : null),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/* ---------------------------------------------------------------- encounters */

/* ---------------------------------------------------------------- encounters (Ch.9 sequence) */

/**
 * The Encounter Check Sequence, driven rather than printed. `state.encounter.phase` walks the
 * chapter's numbered steps and each phase offers only the controls that step allows:
 *   moving   1-4  choose a mode, check, shift the presence (or use a power to outmaneuver/prepare)
 *   revealed 5-6  behaviour and threat are known
 *   standoff 7-8  spotting resolved: reveal, ambush, back out, hide — or escape
 *   fight    9    draw initiative
 *   reset    10   reset the timer to fit the situation
 *   advance  11   check active crisis timers, then 12: round again
 */
const ENCOUNTER_PHASES = ["moving", "revealed", "standoff", "fight", "reset", "advance"];
const SPOT_POWERS = ["DETECTION", "ENHANCED SENSES", "TELEPATHY"];

function encMode(state) { return S.MOVEMENT_MODES.find((m) => m.key === state.mode) || S.MOVEMENT_MODES[0]; }
function encRung(key) { return S.ENCOUNTER_TIMER.ladder.find((l) => l.key === key) || S.ENCOUNTER_TIMER.ladder[0]; }
function encIndex(key) { return S.ENCOUNTER_TIMER.ladder.findIndex((l) => l.key === key); }

/** Does the hero hold one of the powers that unlock Outmaneuver / Prepare? */
function spotPower(character = Store.activeCharacter()) {
  const names = (character?.powers || []).map((p) => String(p.name).toUpperCase());
  return SPOT_POWERS.find((n) => names.includes(n)) || null;
}

/** The powers option: at least one 6, no more than one 1, and no encounter triggered. */
export function powerOptionAvailable(state) {
  const last = state.encounter?.lastCheck;
  if (!last || state.encounter.presence === "encountered") return null;
  if (!(last.sixes >= 1 && last.ones <= 1)) return null;
  const power = spotPower();
  if (!power) return null;
  const i = encIndex(state.encounter.presence);
  const closing = encIndex("closing");
  const canOutmaneuver = i >= closing;
  const canPrepare = i >= closing && i <= encIndex("near");
  if (!canOutmaneuver && !canPrepare) return null;   // the option exists only from 'closing' on
  return { power, canOutmaneuver, canPrepare };
}

function encounterCard(state, mount) {
  const card = el("div", { class: "timer-group", id: "solo-encounter" },
    el("h4", { class: "group-head", text: "Encounter timer" }),
    helpPanel(["Use this when exploring an unknown location or evading enemies — it tracks how close the opposition is getting.",
      "Your movement mode shifts the odds: rushing is faster but noisier, moving cautiously is slower but safer.",
      "The panel walks the chapter's encounter sequence: check, reveal, spot, avoid or escape, fight, reset, advance time.",
      "Searching a zone takes minutes — it rolls INTUITION and prompts a crisis timer check."]),
    el("p", { class: "trigger", text: "Start one only for a tense patrol, search or escape where a fight could break out. Ordinary travel needs no encounter timer. Check it once per zone you move through or linger in." }));
  const sequence = el("details", {}, el("summary", { text: "Encounter procedure, in order" }),
    el("ol", { class: "small" }, ...S.ENCOUNTER_SEQUENCE.map((t, i) => el("li", {
      class: state.encounter ? (i === sequenceIndex(state) ? "current-step" : "") : "", text: t }))));

  const placeBlock = () => (state.place
    ? el("div", { class: "oracle-answer place" },
      el("span", { class: "oracle-kind", text: `This place · ${state.place.engine}` }),
      el("p", { class: "lede", text: state.place.text }),
      el("button", { class: "btn tiny ghost", onclick: () => { state.place = null; save(state); renderSolo(mount); } }, "Somewhere else"))
    : null);

  if (!state.encounter) {
    card.append(el("p", { class: "muted small", text: "No encounter timer running — nothing is stalking you. Start one when your hero enters somewhere dangerous on foot." }));
    card.append(el("details", { class: "help" }, el("summary", { text: "When does a fight actually start?" }),
      el("p", { class: "small", text: "Three ways, and only three. (1) An encounter timer reaches Encountered and you neither avoid nor escape it — the panel walks you to Draw initiative. (2) You choose to attack something the fiction has already put in front of you — draw initiative from the Action tab. (3) A crisis timer fires into a fight, because that is what you said it would trigger." }),
      el("p", { class: "small", text: "You never roll to see whether combat happens. Combat happens because the encounter sequence delivered an enemy, or because you decided to swing first." })));
    card.append(el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => startEncounter(state, mount) }, "Start encounter timer"),
      el("button", { class: "btn ghost", onclick: () => describePlace(state, mount, "facility") }, "Describe this place")));
    const p0 = placeBlock();
    if (p0) card.append(p0);
    card.append(sequence);
    return card;
  }

  const enc = state.encounter;
  const phase = enc.phase || "moving";
  const rung = encRung(enc.presence);
  const mode = encMode(state);
  const dice = Math.max(1, rung.dice + mode.encounter);
  {
    const ladder = S.ENCOUNTER_TIMER.ladder;
    const idx = Math.max(0, encIndex(enc.presence));
    const left = ladder.length - 1 - idx;
    const pips = el("span", { class: `pips ${left <= 1 ? "t-hot" : left <= 2 ? "t-warm" : "t-cool"}`, "aria-hidden": "true" });
    ladder.forEach((_, i) => pips.append(el("span", { class: `pip ${i <= idx ? "on" : ""} ${i === ladder.length - 1 ? "end" : ""}` })));
    card.append(el("div", { class: "timer-track" }, pips,
      el("span", { class: "timer-status", text: `${rung.name}${rung.dice ? ` · roll ${count(dice, "die", "dice")}` : ""}` })));
    card.append(el("p", { class: "timer-meaning", text: left === 0
      ? "Something is here. Work through the steps below."
      : `${count(left, "step")} from running into somebody. Every 6 brings them one step closer, and moving ${mode.name.replace(" (default)", "").toLowerCase()} means ${mode.encounter === 0 ? "no change to the dice" : `${mode.encounter > 0 ? "+" : ""}${mode.encounter} enemy die`}.` }));
  }
  card.append(el("p", { class: "stage-label", text: `Step ${sequenceIndex(state) + 1} of 12 — ${S.ENCOUNTER_SEQUENCE[sequenceIndex(state)]}` }));

  const row = el("div", { class: "row-actions" });

  if (phase === "moving") {
    row.append(el("button", { class: "btn primary", onclick: () => encounterCheck(state, mount) }, "Move / linger — check"));
    row.append(el("button", { class: "btn", onclick: () => searchZone(state, mount) }, "Search this zone"));
    const opt = powerOptionAvailable(state);
    if (opt) {
      if (opt.canOutmaneuver) row.append(el("button", { class: "btn warn", onclick: () => usePowerOption(state, mount, "outmaneuver", opt.power) }, "Outmaneuver"));
      if (opt.canPrepare) row.append(el("button", { class: "btn warn", onclick: () => usePowerOption(state, mount, "prepare", opt.power) }, "Prepare"));
    }
  } else if (phase === "revealed") {
    row.append(el("button", { class: "btn primary", onclick: () => spottingCheck(state, mount) }, "Spotting check"));
  } else if (phase === "standoff") {
    if (enc.surprised) {
      row.append(el("button", { class: "btn danger", onclick: () => drawForEncounter(state, mount) }, "Draw initiative — you are surprised"));
    } else {
      if (!enc.spotted?.hero) {
        row.append(el("button", { class: "btn", onclick: () => standoffChoice(state, mount, "reveal") }, "Reveal yourself"));
        row.append(el("button", { class: "btn danger", onclick: () => standoffChoice(state, mount, "ambush") }, "Ambush them"));
        row.append(el("button", { class: "btn ghost", onclick: () => standoffChoice(state, mount, "hide") }, "Hide"));
        row.append(el("button", { class: "btn ghost", onclick: () => standoffChoice(state, mount, "backOut") }, "Back out"));
        row.append(el("button", { class: "btn ghost", onclick: () => standoffChoice(state, mount, "sneak") }, "Sneak past"));
      } else {
        row.append(el("button", { class: "btn", onclick: () => escapeEncounter(state, mount) }, "Escape (AGILITY)"));
        row.append(el("button", { class: "btn danger", onclick: () => drawForEncounter(state, mount) }, "Draw initiative"));
      }
    }
  } else if (phase === "fight") {
    row.append(el("button", { class: "btn primary", onclick: () => { enc.phase = "reset"; save(state); renderSolo(mount); } }, "Encounter resolved"));
    row.append(el("a", { class: "btn ghost", href: "#/combat" }, "Go to the action scene"));
  } else if (phase === "reset") {
    row.append(el("button", { class: "btn primary", onclick: () => resetEncounter(state, mount) }, "Reset the encounter timer"));
  } else if (phase === "advance") {
    row.append(el("button", { class: "btn primary", onclick: () => advanceTime(state, mount) }, "Advance time — check crisis timers"));
  }

  row.append(el("button", { class: "btn ghost", onclick: () => describePlace(state, mount, "facility") }, "Describe this place"));
  row.append(el("button", { class: "btn ghost", onclick: () => { state.encounter = null; save(state); renderSolo(mount); } }, "Clear"));
  card.append(row);

  const p = placeBlock();
  if (p) card.append(p);

  if (enc.detail) {
    card.append(el("div", { class: "oracle-answer" },
      el("span", { class: "oracle-kind", text: enc.detail.kind }),
      el("p", { class: "lede", text: enc.detail.text }),
      enc.detail.note ? el("p", { class: "muted small", text: enc.detail.note }) : null));
  }
  card.append(sequence);
  return card;
}

/** Which of the twelve printed steps the panel is standing on. */
export function sequenceIndex(state) {
  const enc = state.encounter;
  if (!enc) return 0;
  switch (enc.phase || "moving") {
    case "revealed": return 4;
    case "standoff": return enc.spotted?.hero ? 7 : 6;
    case "fight": return 8;
    case "reset": return 9;
    case "advance": return 10;
    default: return enc.lastCheck ? 3 : 1;
  }
}

async function startEncounter(state, mount) {
  const guide = { allClear: "Navigating an unknown location with no warning of enemies.",
    confirmed: "You know enemies are here.", closing: "Enemies are already converging on you.",
    near: "Enemies are already converging on you." };
  const presence = await chooseModal("Starting enemy presence", S.ENCOUNTER_TIMER.ladder.slice(0, 6).map((l) => ({
    label: l.name, hint: `${l.dice} enemy dice${guide[l.key] ? ` — ${guide[l.key]}` : ""}`, value: l.key })), { allowCancel: true });
  if (!presence) return;
  state.encounter = { presence, phase: "moving", lastCheck: null, detail: null };
  logEvent(state, `Encounter timer started at ${encRung(presence).name}.`);
  save(state);
  renderSolo(mount);
}

/** Steps 2-4, and 5-6 when the presence reaches 'encountered'. */
/** The encounter roll alone: shifts the presence and, on 'encountered', reads behaviour + threat. */
function rollEncounter(state) {
  const enc = state.encounter;
  const ladder = S.ENCOUNTER_TIMER.ladder;
  const idx = encIndex(enc.presence);
  const mode = encMode(state);
  const dice = Math.max(1, ladder[idx].dice + mode.encounter);
  const faces = Array.from({ length: dice }, () => d6());
  const sixes = faces.filter((f) => f === 6).length;
  const ones = faces.filter((f) => f === 1).length;
  const highest = Math.max(...faces, 0);
  const next = Math.min(ladder.length - 1, idx + sixes);
  enc.presence = ladder[next].key;
  enc.lastCheck = { faces, sixes, ones, highest };

  let behaviour = null, threat = null;
  if (ladder[next].key === "encountered") {
    behaviour = S.ENEMY_BEHAVIOUR.find((b) => b.highest === highest) || S.ENEMY_BEHAVIOUR.find((b) => b.highest === 0);
    threat = S.ENEMY_THREAT.find((t) => t.sixes === Math.min(3, sixes)) || S.ENEMY_THREAT[0];
    enc.behaviour = behaviour;
    enc.threat = threat;
    enc.surprised = behaviour.highest === 0;
    enc.phase = /False alarm/.test(behaviour.name) ? "reset" : "revealed";
    enc.detail = { kind: `${behaviour.name} · ${threat.name}`, text: behaviour.effect, note: threat.examples };
  } else {
    enc.phase = "moving";
  }
  logEvent(state, `Encounter check: ${sixes} sixes → ${ladder[next].name}`);
  return { faces, sixes, ones, highest, dice, presence: ladder[next], behaviour, threat, evidence:
    sixes ? S.ENCOUNTER_TIMER.evidence.find((e) => e.sixes === Math.min(3, sixes)) : null };
}

function encounterCheck(state, mount) {
  const r = rollEncounter(state);
  const body = el("div", {}, diceRow(r.faces), el("p", { text: `Enemy presence: ${r.presence.name}.` }));
  if (r.evidence) body.append(el("p", { class: "muted", text: r.evidence.text }));
  if (r.behaviour) {
    body.append(
      el("h4", { class: "section", text: "Encounter!" }),
      el("p", {}, el("strong", { text: `${r.behaviour.name}: ` }), r.behaviour.effect),
      el("p", {}, el("strong", { text: `${r.threat.name}: ` }), r.threat.examples),
      el("p", { class: "small", text: /False alarm/.test(r.behaviour.name)
        ? "A false alarm — no hostile enemy. Reset the timer and move on."
        : "Next: make the spotting check, then decide how the encounter opens." }));
  } else {
    const opt = powerOptionAvailable(state);
    if (opt) body.append(el("p", { class: "warn small", text: `${opt.power} lets you Outmaneuver${opt.canPrepare ? " or Prepare" : ""} instead of rolling the next check.` }));
  }
  save(state);
  modal({ title: "Encounter check", body, actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/** Step 7: who sees whom, with the movement mode applied to both INTUITION rolls. */
async function spottingCheck(state, mount) {
  const enc = state.encounter;
  const mode = encMode(state);
  const c = Store.activeCharacter();
  const b = enc.behaviour || S.ENEMY_BEHAVIOUR[0];
  const spotted = { hero: false, npcs: false };
  let heroSixes = 0;                      // only the hero's own INTUITION roll can spend a spare 6
  const body = el("div", {}, el("p", {}, el("strong", { text: `${b.name}: ` }), b.effect));

  if (b.highest === 4) {                      // passive: you see them, they are unaware
    spotted.npcs = true;
  } else if (b.highest === 5) {               // searching: you see them, they roll to see you
    spotted.npcs = true;
    const n = Number(await promptModal("Their INTUITION score?", { title: "They roll to spot you", value: "3" })) || 3;
    const dice = Math.max(1, n + mode.vsIntuition);
    const faces = Array.from({ length: dice }, () => d6());
    spotted.hero = faces.some((f) => f === 6);
    body.append(diceLine(faces, `They roll ${dice} INTUITION dice${mode.vsIntuition ? ` (${mode.vsIntuition > 0 ? "+" : ""}${mode.vsIntuition} for moving ${mode.key})` : ""} — ${spotted.hero ? "they spot you" : "they miss you"}.`));
  } else if (b.highest === 6) {               // stalking: they see you, you roll to see them
    spotted.hero = true;
    const pool = Math.max(1, (c ? Derived.attributePool(c, "intuition") : 3) + mode.ownIntuition);
    const faces = Array.from({ length: pool }, () => d6());
    heroSixes = faces.filter((f) => f === 6).length;
    spotted.npcs = heroSixes > 0;
    body.append(diceLine(faces, `You roll ${pool} INTUITION dice${mode.ownIntuition ? ` (${mode.ownIntuition > 0 ? "+" : ""}${mode.ownIntuition} for moving ${mode.key})` : ""} — ${spotted.npcs ? "you spot them" : "you cannot find them"}.`));
  } else {
    spotted.hero = true; spotted.npcs = true;
  }

  enc.spotted = spotted;
  enc.phase = "standoff";
  enc.detail = { kind: "Spotting", text: spotted.hero ? "You have been spotted." : "You are still unspotted.",
    note: spotted.npcs ? "You know where they are." : "You have not pinned them down." };
  body.append(el("p", { class: spotted.hero ? "warn" : "good",
    text: spotted.hero ? "You are spotted — escape with AGILITY, or draw initiative." : "You are unspotted — reveal yourself, ambush, hide, back out or sneak past." }));
  if (heroSixes >= 2) { const b = bonusSixBlock(state, heroSixes); if (b) body.append(b); }
  logEvent(state, `Spotting: hero ${spotted.hero ? "spotted" : "unspotted"}, enemies ${spotted.npcs ? "located" : "unlocated"}.`);
  save(state);
  modal({ title: "Spotting check", body, actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

function diceLine(faces, text) {
  return el("div", {},
    el("div", { class: "dice-row" }, ...faces.map((f) => el("span", { class: `die ${f === 6 ? "six" : f === 1 ? "one" : ""}`, text: String(f) }))),
    el("p", { text }));
}

/** Step 7's options for an unspotted hero, plus the book's avoidance procedures. */
async function standoffChoice(state, mount, choice) {
  const enc = state.encounter;
  const mode = encMode(state);
  if (choice === "reveal") {
    enc.spotted = { hero: true, npcs: true };
    enc.detail = { kind: "Revealed", text: "You step into the open. They know you are here." };
    logEvent(state, "Revealed yourself to the enemy.");
    save(state); renderSolo(mount);
    return;
  }
  if (choice === "ambush") {
    enc.detail = { kind: "Ambush", text: "You strike first — draw initiative with the enemy surprised." };
    logEvent(state, "Ambushed the enemy.");
    enc.ambush = true;
    save(state);
    drawForEncounter(state, mount, { enemySurprised: true });
    return;
  }
  if (choice === "backOut") {
    enc.detail = { kind: "Backed out", text: "You retreat from the zone without risk — but consider what that costs you in the location." };
    logEvent(state, "Backed out of the zone.");
    enc.phase = "reset";
    save(state); renderSolo(mount);
    return;
  }
  // Hide and Sneak past both hinge on an enemy INTUITION roll.
  let searches = true;
  if (choice === "hide") {
    const r = binaryRoll("even");
    searches = /yes/i.test(r.entry.text);
    if (!searches) {
      enc.detail = { kind: "Hidden", text: `They do not search (${r.entry.text}) — they move out of the zone within minutes.` };
      logEvent(state, "Hid successfully; the enemy did not search.");
      enc.phase = "reset";
      save(state); renderSolo(mount);
      modal({ title: "Hide", body: el("div", {}, el("p", { text: `Binary Engine: ${r.entry.text} — they do not make an active search.` })), actions: [{ label: "OK", variant: "primary" }] });
      return;
    }
  }
  const n = Number(await promptModal("Their INTUITION score?", { title: choice === "hide" ? "They search for you" : "Sneak past", value: "3" })) || 3;
  const dice = Math.max(1, n + mode.vsIntuition);
  const faces = Array.from({ length: dice }, () => d6());
  const found = faces.some((f) => f === 6);
  const body = diceLine(faces, found
    ? "They spot you — the encounter is on."
    : (choice === "hide" ? "They fail to find you and move on within minutes." : "You slip through to the next zone."));
  if (found) {
    enc.spotted = { hero: true, npcs: true };
    enc.detail = { kind: choice === "hide" ? "Hiding failed" : "Sneaking failed", text: "They spotted you." };
  } else {
    enc.detail = { kind: choice === "hide" ? "Hidden" : "Snuck past", text: choice === "hide" ? "They searched and missed you." : "You reached the next zone unseen." };
    enc.phase = "reset";
  }
  logEvent(state, `${choice === "hide" ? "Hide" : "Sneak past"}: ${found ? "spotted" : "clean"}.`);
  save(state);
  modal({ title: choice === "hide" ? "Hide" : "Sneak past", body, actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/** Step 8: escape with an AGILITY roll and the printed modifier list. */
async function escapeEncounter(state, mount) {
  const enc = state.encounter;
  const c = Store.activeCharacter();
  const boxes = S.ESCAPE_MODIFIERS.map((m) => {
    const input = el("input", { type: "checkbox" });
    return { m, input, row: el("label", { class: "toggle-row" }, input,
      el("span", { text: `${m.text} (${m.dice > 0 ? "+" : ""}${m.dice} dice)` })) };
  });
  const base = c ? Derived.attributePool(c, "agility") : 3;
  const body = el("div", {},
    el("p", { text: `AGILITY ${base} dice. Tick anything that applies:` }),
    ...boxes.map((b) => b.row),
    el("p", { class: "muted small", text: "Success places you up to two zones away (or as far as a movement power allows) and the timer resets. Failure draws initiative." }));
  const go = await modal({ title: "Escape the encounter", body,
    actions: [{ label: "Cancel", value: false, variant: "ghost" }, { label: "Roll AGILITY", value: true, variant: "primary" }] }).promise;
  if (!go) return;
  const mod = boxes.reduce((n, b) => n + (b.input.checked ? b.m.dice : 0), 0);
  const dice = Math.max(1, base + mod);
  const faces = Array.from({ length: dice }, () => d6());
  const sixes = faces.filter((f) => f === 6).length;
  const escaped = sixes > 0;
  enc.detail = { kind: escaped ? "Escaped" : "Caught", text: escaped
    ? "You break away — place yourself up to two zones off, then reset the timer."
    : "You are caught up in the encounter — draw initiative." };
  enc.phase = escaped ? "reset" : "standoff";
  if (!escaped) enc.spotted = { hero: true, npcs: true };
  logEvent(state, `Escape roll: ${dice} dice, ${sixes} sixes — ${escaped ? "escaped" : "caught"}.`);
  save(state);
  const body2 = diceLine(faces, `${dice} AGILITY dice${mod ? ` (${mod > 0 ? "+" : ""}${mod})` : ""} — ${escaped ? "you escape" : "you are caught"}.`);
  const bonus = bonusSixBlock(state, sixes);
  if (bonus) body2.append(bonus);
  modal({ title: "Escape", body: body2, actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/** Step 9: draw initiative. Starts a real action scene, carrying the surprise across. */
function drawForEncounter(state, mount, { enemySurprised = false } = {}) {
  const enc = state.encounter;
  enc.phase = "fight";
  enc.detail = { kind: "Initiative drawn", text: enc.surprised
    ? "You are surprised — you take the worst card in round 1."
    : enemySurprised ? "You have the drop on them." : "The fight is on." };
  logEvent(state, `Encounter joined${enc.surprised ? " (hero surprised)" : enemySurprised ? " (enemy surprised)" : ""}.`);
  save(state);
  const combat = Combat.startActionScene();
  if (enc.surprised && combat) {
    const cb = combat.combatants.find((x) => x.side === "hero");
    if (cb) { cb.surprised = true; Combat.drawInitiative(combat); Store.saveCombat(combat); }
  }
  showToast("Action scene started — the Action tab has initiative and the combatants.", { variant: "good", timeout: 6000 });
  renderSolo(mount);
}

/** Step 10: reset the timer to fit what just happened. */
async function resetEncounter(state, mount) {
  const pick = await chooseModal("Reset the encounter timer", S.ENCOUNTER_TIMER.resets.map((t) => {
    const [label, hint] = t.split(" — ");
    const rung = S.ENCOUNTER_TIMER.ladder.find((l) => l.name.toLowerCase() === label.toLowerCase());
    return { label, hint, value: rung ? rung.key : "allClear" };
  }));
  if (!pick) return;
  const enc = state.encounter;
  enc.presence = pick;
  enc.phase = "advance";
  enc.lastCheck = null;
  enc.behaviour = null; enc.threat = null; enc.spotted = null; enc.surprised = false; enc.ambush = false;
  enc.detail = { kind: "Timer reset", text: `Enemy presence set to ${encRung(pick).name}.` };
  logEvent(state, `Encounter timer reset to ${encRung(pick).name}.`);
  save(state);
  renderSolo(mount);
}

/**
 * Step 11: time passes. Crisis timer checks take the movement-mode modifier, plus another +1 die
 * if the encounter, a careful search or another delay held you up — the chapter stacks these.
 */
async function advanceTime(state, mount) {
  const mode = encMode(state);
  const pace = await chooseModal("Did anything hold you up?", [
    { label: "Straight through", hint: "No delay", value: 0 },
    { label: "An encounter, a careful search or another delay", hint: "+1 die on every timer", value: 1 },
    { label: "Faster than normal", hint: "-1 die (minimum 1)", value: -1 },
  ]);
  if (pace === null) return;
  const delayed = Number(pace) > 0;
  const extra = Number(pace) + mode.crisis;
  if (!state.timers.length) {
    state.encounter.phase = "moving";
    state.encounter.detail = { kind: "Time passes", text: "No crisis timer is running — start one; always keep at least one going." };
    save(state);
    renderSolo(mount);
    return;
  }
  const lines = [];
  for (const t of state.timers) {
    const idx = S.CRISIS_TIMER.ladder.findIndex((l) => l.key === t.proximity);
    const rung = S.CRISIS_TIMER.ladder[idx];
    const dice = Math.max(1, rung.dice + extra);
    const faces = Array.from({ length: dice }, () => d6());
    const sixes = faces.filter((f) => f === 6).length;
    const next = Math.min(S.CRISIS_TIMER.ladder.length - 1, idx + sixes);
    t.proximity = S.CRISIS_TIMER.ladder[next].key;
    lines.push(`${t.name}: ${dice} dice, ${sixes} sixes → ${S.CRISIS_TIMER.ladder[next].name}`);
    if (S.CRISIS_TIMER.ladder[next].key === "now") {
      state.crisisLevel = clamp(state.crisisLevel + 1, 0, 10);
      lines.push(`${t.name} fires! Crisis level ${state.crisisLevel}.`);
      t.fired = true;
    }
  }
  state.timers = state.timers.filter((t) => !t.fired);
  state.encounter.phase = "moving";
  state.encounter.detail = { kind: "Time passes", text: lines.join(" · ") };
  logEvent(state, `Advanced time (${extra >= 0 ? "+" : ""}${extra} dice): ${lines.join("; ")}`);
  save(state);
  modal({ title: "Crisis timers", body: el("div", {}, ...lines.map((l) => el("p", { text: l })),
    el("p", { class: "muted small", text: `Rolled with ${extra >= 0 ? "+" : ""}${extra} dice: moving ${mode.name.replace(" (default)", "")}${delayed ? " plus the delay" : ""}.` })),
    actions: [{ label: "OK", variant: "primary" }] });
  renderSolo(mount);
}

/** The powers option: Outmaneuver or Prepare instead of rolling the next check. */
function usePowerOption(state, mount, kind, power) {
  const enc = state.encounter;
  const ladder = S.ENCOUNTER_TIMER.ladder;
  const i = encIndex(enc.presence);
  if (kind === "outmaneuver") {
    enc.presence = ladder[Math.max(0, i - 1)].key;
    enc.detail = { kind: `${power} — outmaneuver`, text: `You put distance between you and them as you move on: ${encRung(enc.presence).name}.` };
  } else {
    enc.presence = "encountered";
    enc.behaviour = { highest: 5, name: "Prepared", effect: "You automatically spot them; they must roll INTUITION to spot you." };
    enc.threat = S.ENEMY_THREAT.find((t) => t.sixes === Math.min(3, enc.lastCheck?.sixes || 1)) || S.ENEMY_THREAT[0];
    enc.surprised = false;
    enc.phase = "revealed";
    enc.detail = { kind: `${power} — prepare`, text: "You force the meeting on your terms: the behaviour table is ignored." };
  }
  enc.lastCheck = null;
  logEvent(state, `${power}: ${kind}.`);
  save(state);
  renderSolo(mount);
}

/** Searching a zone: an INTUITION check that costs time, per the chapter's search rules. */
async function searchZone(state, mount) {
  const c = Store.activeCharacter();
  const mode = encMode(state);
  const looking = await promptModal("What are you looking for? Leave blank for a general sweep.", {
    title: "Search this zone",
    hints: ["Looking for something specific: the roll tells you whether you find it.",
      "A general sweep: roll the Complex Response Engine and interpret what turns up.",
      "Searching takes a few minutes or more, so it advances your crisis timers afterwards."],
  });
  if (looking === null) return;
  const pool = Math.max(1, (c ? Derived.attributePool(c, "intuition") : 3) + mode.ownIntuition);
  const faces = Array.from({ length: pool }, () => d6());
  const sixes = faces.filter((f) => f === 6).length;
  const found = sixes > 0;
  const body = diceLine(faces, `${pool} INTUITION dice — ${found ? "you find something" : "nothing turns up"}.`);
  let text = found ? "You find what you were after." : "Nothing here, or nothing you can reach.";
  if (found && !looking) {
    const phrase = complexPhrase();
    text = `The sweep turns up: ${phrase}`;
    body.append(el("p", { class: "lede", text: phrase }),
      el("p", { class: "muted small", text: "Complex Response Engine — interpret it for what the search uncovered." }));
  } else if (looking) {
    text = found ? `You find it: ${looking}.` : `No sign of ${looking} here.`;
  }
  const bonus = bonusSixBlock(state, sixes);
  if (bonus) body.append(bonus);
  state.encounter.detail = { kind: "Search", text, note: "Searching takes time — check your crisis timers." };
  state.encounter.phase = "advance";
  logEvent(state, `Searched the zone: ${sixes} sixes.`);
  save(state);
  modal({ title: "Search", body, actions: [{ label: "OK", variant: "primary" }] });
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
