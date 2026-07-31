// combat.js — initiative, combatant cards, the generic progress/challenge tracker,
// and the scene / session / adventure lifecycle engine with confirmation + one-step undo.

import { el, clear, uid, clamp, d6 } from "./core.js";
import { modal, showToast, confirmModal, promptModal, chooseModal, announce } from "./ui.js";
import * as R from "./rules.js";
import { D } from "./rules.js";
import * as Derived from "./derived.js";
import * as Store from "./store.js";
import * as Roller from "./roller.js";
import { Settings } from "./settings.js";
import { NPC_PROFILES, CREATURES } from "../data-npcs.js";
import { ADVERSARIES } from "../data-monsters.js";

/* ---------------------------------------------------------------- state */

export function newCombat() {
  return { active: true, round: 1, combatants: [], wreckedZones: [], log: [], startedAt: Date.now() };
}

function getCombat() { return Store.getCombat(); }
function save(c) { return Store.saveCombat(c); }

/* ---------------------------------------------------------------- initiative */

export function drawInitiative(combat) {
  const cards = Array.from({ length: 10 }, (_, i) => i + 1);
  // shuffle
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  const surprised = combat.combatants.filter((c) => c.surprised);
  const others = combat.combatants.filter((c) => !c.surprised);
  // Surprised defenders take the worst cards, distributed randomly (first round only).
  const worst = cards.slice(-surprised.length || cards.length).sort((a, b) => b - a).slice(0, surprised.length);
  const pool = cards.filter((c) => !worst.includes(c));
  others.forEach((c, i) => {
    let card = pool[i % pool.length];
    if (c.fastReflexes) card = Math.min(card, pool[(i + 1) % pool.length]);
    c.card = card;
  });
  surprised.forEach((c, i) => { c.card = worst[i]; c.surprised = false; });
  combat.combatants.forEach((c) => { c.acted = false; c.held = false; c.actions = { full: true, quick: true }; });
  combat.combatants.sort((a, b) => (a.card || 99) - (b.card || 99));
  return combat;
}

export function combatantFromCharacter(c) {
  const s = Derived.summary(c);
  return {
    id: uid("cbt"), refId: c.id, name: c.identity.heroName || c.identity.realName || "Hero",
    side: "hero", attrs: s.attributes, health: c.state.health, maxHealth: s.maxHealth,
    resolve: c.state.resolve, maxResolve: s.maxResolve, armor: s.armor.value,
    slugfest: s.slugfest, conditions: {}, altitude: "ground", zone: 1,
    minionCount: 0, huge: false, card: null, acted: false,
    fastReflexes: R.hasTalent(c, "Fast Reflexes"),
    actions: { full: true, quick: true },
  };
}

export function combatantFromProfile(p, { count = 1 } = {}) {
  const isMinion = !!p.minion;
  return {
    id: uid("cbt"), refId: null, name: p.name, side: "adversary",
    attrs: p.attrs, health: isMinion ? count : (p.health || 1), maxHealth: isMinion ? count : (p.health || 1),
    resolve: p.resolve || 1, maxResolve: p.resolve || 1,
    armor: guessArmor(p), slugfest: p.slugfest || 1, conditions: {},
    altitude: "ground", zone: 1, minionCount: isMinion ? count : 0, huge: !!p.huge,
    card: null, acted: false, actions: { full: true, quick: true },
    profile: p.name, talents: p.talents || [], powers: p.powers || [], drawbacks: p.drawbacks || [],
  };
}

function guessArmor(p) {
  const text = (p.powers || []).join(" ");
  const m = /Armor\s+(\d)/.exec(text);
  return m ? Number(m[1]) : 0;
}

/* ---------------------------------------------------------------- rendering */

export function renderCombat(mount) {
  clear(mount);
  let combat = getCombat();
  if (!combat || !combat.active) {
    mount.append(el("div", { class: "empty" },
      el("h2", { text: "No action scene running" }),
      el("p", { text: "Start a scene to draw initiative, track combatants and apply damage." }),
      el("button", { class: "btn primary", onclick: () => { const c = newCombat(); const hero = Store.activeCharacter(); if (hero) c.combatants.push(combatantFromCharacter(hero)); save(drawInitiative(c)); renderCombat(mount); } }, "Start action scene"),
      el("div", { class: "row-actions" },
        el("button", { class: "btn ghost", onclick: () => openLifecycle("social") }, "End social scene"),
        el("button", { class: "btn ghost", onclick: () => openLifecycle("session") }, "End session"))));
    renderTasks(mount);
    return;
  }

  mount.append(el("div", { class: "combat-head" },
    el("h2", { text: `Round ${combat.round}` }),
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => { combat.round += 1; save(drawInitiative(combat)); renderCombat(mount); } }, "Next round"),
      el("button", { class: "btn ghost", onclick: () => openAddCombatant(mount) }, "Add combatant"),
      el("button", { class: "btn ghost", onclick: () => openWreck(combat, mount) }, "Wreck a zone"),
      el("button", { class: "btn danger", onclick: async () => {
        if (await confirmModal("End the action scene and run the end-of-scene recovery?", { title: "End action scene", confirmLabel: "End scene" })) {
          Store.clearCombat(); openLifecycle("action"); renderCombat(mount);
        }
      } }, "End scene"))));

  const list = el("div", { class: "combatants" });
  for (const cb of combat.combatants) list.append(combatantCard(cb, combat, mount));
  mount.append(list);

  if (combat.wreckedZones.length) {
    mount.append(el("p", { class: "warn small", text: `Wrecked zones this scene: ${combat.wreckedZones.join(", ")} — wrecking costs bad karma at the end of the session.` }));
  }
  renderTasks(mount);
}

function combatantCard(cb, combat, mount) {
  const isMinion = cb.minionCount > 0;
  return el("div", { class: `combatant ${cb.side} ${cb.acted ? "acted" : ""} ${cb.health <= 0 ? "down" : ""}` },
    el("div", { class: "cbt-head" },
      el("span", { class: "cbt-card", text: cb.card ? `#${cb.card}` : "—" }),
      el("strong", { text: cb.name + (isMinion ? ` (${cb.health} minions)` : "") }),
      cb.huge ? el("span", { class: "chip warn", text: "Huge" }) : null),
    el("div", { class: "cbt-stats" },
      el("span", { text: isMinion ? `Minions ${cb.health}/${cb.maxHealth}` : `Health ${cb.health}/${cb.maxHealth}` }),
      el("span", { text: `Resolve ${cb.resolve}/${cb.maxResolve}` }),
      cb.armor ? el("span", { text: `Armor ${cb.armor}` }) : null,
      el("span", { text: `Slugfest ${cb.slugfest}` }),
      el("span", { text: cb.altitude })),
    el("div", { class: "cbt-actions" },
      el("button", { class: "btn tiny danger", onclick: () => damageCombatant(cb, combat, mount) }, "Damage"),
      el("button", { class: "btn tiny", onclick: () => { cb.acted = !cb.acted; save(combat); renderCombat(mount); } }, cb.acted ? "Un-act" : "Acted"),
      el("button", { class: "btn tiny ghost", onclick: () => cycleAltitude(cb, combat, mount) }, "Altitude"),
      el("button", { class: "btn tiny ghost", onclick: () => holdOff(cb, combat, mount) }, "Hold off"),
      el("button", { class: "btn tiny ghost", onclick: () => { combat.combatants = combat.combatants.filter((x) => x.id !== cb.id); save(combat); renderCombat(mount); } }, "Remove")));
}

async function damageCombatant(cb, combat, mount) {
  const v = Number(await promptModal(`Damage to ${cb.name}? Armor ${cb.armor} is applied automatically.`, { title: "Damage", value: "1" }));
  if (!v) return;
  const after = Math.max(0, v - (cb.armor || 0));
  if (cb.minionCount > 0) {
    // Minion group: Health equals the number of minions; each point removes one, no crits (audit A18).
    cb.health = Math.max(0, cb.health - after);
    showToast(`${after} minion(s) down. ${cb.health} remain.`);
  } else if (cb.refId) {
    const hero = Store.getCharacter(cb.refId);
    if (hero) {
      Store.updateCharacter((ch) => { Roller.applyDamage(ch, v, { armor: cb.armor }); }, { id: cb.refId });
      const updated = Store.getCharacter(cb.refId);
      cb.health = updated.state.health;
      showToast(`${cb.name} takes ${after} damage.`);
    }
  } else {
    cb.health = Math.max(0, cb.health - after);
    if (cb.health === 0) showToast(`${cb.name} is broken — the GM may declare them knocked out or killed.`, { timeout: 5000 });
  }
  save(combat);
  renderCombat(mount);
}

function cycleAltitude(cb, combat, mount) {
  const order = D.ALTITUDES.map((a) => a.key);
  cb.altitude = order[(order.indexOf(cb.altitude) + 1) % order.length];
  save(combat); renderCombat(mount);
}

async function holdOff(cb, combat, mount) {
  const later = combat.combatants.filter((x) => x.id !== cb.id && !x.acted && !x.held && (x.card || 99) > (cb.card || 0));
  if (!later.length) { showToast("Nobody later in the order to swap with.", { variant: "warn" }); return; }
  const pick = await chooseModal("Swap initiative with…", later.map((x) => ({ label: `${x.name} (#${x.card})`, value: x.id })));
  if (!pick) return;
  const other = combat.combatants.find((x) => x.id === pick);
  [cb.card, other.card] = [other.card, cb.card];
  cb.held = true;
  combat.combatants.sort((a, b) => (a.card || 99) - (b.card || 99));
  save(combat); renderCombat(mount);
  showToast("Cards swapped. Spent quick actions stay spent.");
}

async function openAddCombatant(mount) {
  const combat = getCombat() || newCombat();
  const options = [
    { label: "Your hero", value: "hero" },
    ...NPC_PROFILES.map((p) => ({ label: p.name + (p.minion ? " (minions)" : ""), hint: p.desc, value: `npc:${p.name}` })),
    ...ADVERSARIES.map((a) => ({ label: a.name, hint: a.descriptor, value: `adv:${a.name}` })),
    ...CREATURES.map((c) => ({ label: c.name, hint: "Creature", value: `crt:${c.name}` })),
  ];
  const pick = await chooseModal("Add a combatant", options);
  if (!pick) return;
  if (pick === "hero") {
    const hero = Store.activeCharacter();
    if (hero) combat.combatants.push(combatantFromCharacter(hero));
  } else {
    const [kind, name] = pick.split(/:(.+)/);
    let profile = null;
    if (kind === "npc") profile = NPC_PROFILES.find((p) => p.name === name);
    else if (kind === "adv") profile = ADVERSARIES.find((p) => p.name === name);
    else profile = { ...CREATURES.find((p) => p.name === name), slugfest: 2 };
    if (!profile) return;
    let count = 1;
    if (profile.minion) count = Number(await promptModal("How many minions in the group?", { title: profile.name, value: "5" })) || 1;
    combat.combatants.push(combatantFromProfile(profile, { count }));
  }
  combat.active = true;
  save(drawInitiative(combat));
  renderCombat(mount);
}

async function openWreck(combat, mount) {
  const pick = await chooseModal("Wreck which terrain?", D.ZONE_TERRAIN.map((t) => ({
    label: t.name, hint: `Needs STRENGTH ${t.minStrength} · +${t.bonus} dice`, value: t.name })));
  if (!pick) return;
  const terrain = D.ZONE_TERRAIN.find((t) => t.name === pick);
  const hero = Store.activeCharacter();
  const str = hero ? Derived.effectiveAttributes(hero).strength : 0;
  if (hero && str < terrain.minStrength) {
    showToast(`${pick} needs STRENGTH ${terrain.minStrength}; you have ${str}.`, { variant: "warn" });
    return;
  }
  combat.wreckedZones.push(pick);
  save(combat);
  if (hero) Store.updateCharacter((ch) => { ch.state.scene.wreckedZones.push(pick); });
  showToast(`${pick} wrecked: +${terrain.bonus} dice, the attack reaches an adjacent zone, and you take bad karma at the end of the session.`, { timeout: 6000 });
  renderCombat(mount);
}

/* ---------------------------------------------------------------- challenges / progress tasks */

export function renderTasks(mount) {
  const tasks = Store.getTasks();
  const section = el("section", { class: "card" },
    el("h3", { text: "Challenges & progress" }),
    el("p", { class: "muted small", text: "Every 6 rolled removes 1 point from the Challenge rating. Handling an objective always needs a roll, even with a power." }));
  for (const t of tasks) {
    section.append(el("div", { class: "task" },
      el("div", {},
        el("strong", { text: t.name }),
        el("p", { class: "muted small", text: `${t.remaining} of ${t.rating} remaining · limit ${t.timeLimit} · ${t.timeSpent} spent` }),
        t.detail ? el("p", { class: "small", text: t.detail }) : null,
        (t.objectives || []).length ? el("details", {}, el("summary", { text: "Objectives" }),
          ...t.objectives.map((o) => el("p", { class: "small" }, el("strong", { text: `${o.name}: ` }), o.desc))) : null),
      el("div", { class: "chosen-actions" },
        el("button", { class: "btn tiny primary", onclick: () => contributeToTask(t, mount) }, "Roll"),
        el("button", { class: "btn tiny ghost", onclick: () => { t.timeSpent += 1; Store.saveTasks(tasks); renderRefresh(mount); } }, "Advance time"),
        el("button", { class: "btn tiny danger", onclick: () => { Store.saveTasks(tasks.filter((x) => x.id !== t.id)); renderRefresh(mount); } }, "Drop"))));
  }
  section.append(el("div", { class: "row-actions" },
    el("button", { class: "btn", onclick: () => openChallengePicker(mount) }, "Add a challenge"),
    el("button", { class: "btn ghost", onclick: () => openCustomTask(mount) }, "Custom progress task")));
  mount.append(section);
}

function renderRefresh(mount) {
  const scroll = window.scrollY;
  renderCombat(mount);
  window.scrollTo(0, scroll);
}

async function openChallengePicker(mount) {
  const pick = await chooseModal("Published challenges", D.CHALLENGES.map((c) => ({
    label: c.name, hint: `Rating ${c.rating} · ${c.limit}`, value: c.name })));
  if (!pick) return;
  const src = D.CHALLENGES.find((c) => c.name === pick);
  const tasks = Store.getTasks();
  tasks.push({ id: uid("task"), name: src.name, detail: `${src.tagline} ${src.detail}`, rating: src.rating, remaining: src.rating, timeLimit: src.limit, timeSpent: 0, objectives: src.objectives, contributors: [] });
  Store.saveTasks(tasks);
  renderRefresh(mount);
}

async function openCustomTask(mount) {
  const name = await promptModal("What is the challenge?", { title: "Custom challenge" });
  if (!name) return;
  const rating = Number(await promptModal("Challenge rating?", { title: name, value: "6" })) || 6;
  const limit = await promptModal("Time limit? (e.g. 3 rounds, 2 days)", { title: name, value: "3 rounds" });
  const tasks = Store.getTasks();
  tasks.push({ id: uid("task"), name, rating, remaining: rating, timeLimit: limit || "—", timeSpent: 0, objectives: [], contributors: [] });
  Store.saveTasks(tasks);
  renderRefresh(mount);
}

async function contributeToTask(task, mount) {
  const hero = Store.activeCharacter();
  if (!hero) { showToast("No active hero.", { variant: "warn" }); return; }
  const attr = await chooseModal("Which attribute?", D.ATTRIBUTES.map((a) => ({ label: a.name, hint: a.desc, value: a.key })));
  if (!attr) return;
  const res = Roller.challengeContribution(hero, attr, task);
  const tasks = Store.getTasks();
  const t = tasks.find((x) => x.id === task.id);
  t.remaining = Math.max(0, t.remaining - res.progress);
  t.contributors = t.contributors || [];
  t.contributors.push({ name: hero.identity.heroName, progress: res.progress, at: Date.now() });
  Store.saveTasks(tasks);
  announce(`${res.progress} progress. ${t.remaining} remaining.`);
  modal({ title: task.name,
    body: el("div", {},
      el("div", { class: "dice-row" }, ...res.roll.dice.map((v) => el("span", { class: `die ${v === 6 ? "six" : v === 1 ? "one" : ""}`, text: String(v) }))),
      el("p", { class: res.progress ? "good" : "bad", text: res.progress ? `${res.progress} point(s) removed from the Challenge rating.` : "No progress this attempt." }),
      el("p", { text: `${t.remaining} of ${t.rating} remaining.` }),
      t.remaining === 0 ? el("p", { class: "good", text: "Challenge overcome!" }) : null,
      el("p", { class: "cite" }, el("a", { href: "#/rules/challenges", class: "rules-link" }, "Rules: Challenges"))),
    actions: [{ label: "Done", variant: "primary" }] });
  renderRefresh(mount);
}

/* ---------------------------------------------------------------- lifecycle engine */

const BUNDLES = {
  start: { title: "Start session", steps: D.LIFECYCLE.startSession },
  action: { title: "End action scene", steps: D.LIFECYCLE.endActionScene },
  social: { title: "End social scene", steps: D.LIFECYCLE.endSocialScene },
  session: { title: "End session", steps: D.LIFECYCLE.endSession },
  adventure: { title: "End adventure", steps: D.LIFECYCLE.endAdventure },
};

export async function openLifecycle(kind) {
  const bundle = BUNDLES[kind];
  if (!bundle) return;
  const c = Store.activeCharacter();
  if (!c) { showToast("No active hero.", { variant: "warn" }); return; }

  if (kind === "session") return openSessionEnd(c);

  const preview = el("ul", {}, ...bundle.steps.map((s) => el("li", { text: s })));
  const ok = await modal({
    title: bundle.title,
    body: el("div", {}, el("p", { class: "muted", text: "This will apply the whole bundle. You can undo it in one step." }), preview),
    actions: [{ label: "Cancel", value: false, variant: "ghost" }, { label: "Apply", value: true, variant: "primary" }],
  }).promise;
  if (!ok) return;

  const summaryLines = await applyBundle(kind, { id: c.id });

  showToast(`${bundle.title} applied. ${summaryLines.join(" ")}`, {
    variant: "good", timeout: 8000,
    action: { label: "Undo", onClick: () => { Store.undo(); showToast("Undone."); } },
  });
  announce(`${bundle.title} applied.`);
}

/**
 * Apply a lifecycle bundle's state changes. Split out of openLifecycle so the flow is testable
 * headlessly and so nothing but the confirmation UI lives in the dialog path.
 * Snapshots first, so every bundle is undoable in one step (audit A23).
 */
export async function applyBundle(kind, { id } = {}) {
  const bundle = BUNDLES[kind];
  if (!bundle) return [];
  Store.snapshot(bundle.title);
  const summaryLines = [];
  let socialScenePlayed = false;
  Store.updateCharacter((ch) => {
    if (kind === "start") {
      ch.state.session.spendUnlocked = false;   // karma is spent only BETWEEN sessions (§3.3)
      ch.state.session.karmaAnswers = {};
      ch.state.session.badKarmaAnswers = {};
      ch.state.session.wreckedZones = [];
      ch.state.scene = { wreckedZones: [], usedOncePerScene: [], energyDice: 0, barriers: [] };
      ch.state.indomitableUsed = false;
      summaryLines.push("Session open; karma spending is locked until it ends.");
    } else if (kind === "action") {
      const heal = Derived.effectiveAttributes(ch).strength;
      const before = ch.state.health;
      ch.state.health = Math.min(Derived.maxHealth(ch), ch.state.health + heal);
      ch.state.broken = ch.state.health <= 0;
      summaryLines.push(`Health ${before} → ${ch.state.health} (+${ch.state.health - before}).`);
      const cleared = Object.keys(ch.state.conditions).filter((k) => ch.state.conditions[k]);
      ch.state.conditions = {};
      // Wrecking is scene-scoped for play but SESSION-scoped for bad karma: carry it over before
      // clearing the scene markers, or the end-of-session question can never fire.
      const wrecked = ch.state.scene.wreckedZones || [];
      if (wrecked.length) {
        ch.state.session.wreckedZones = [...(ch.state.session.wreckedZones || []), ...wrecked];
        summaryLines.push(`${wrecked.length} wrecked zone(s) noted for bad karma.`);
      }
      ch.state.scene = { wreckedZones: [], usedOncePerScene: [], energyDice: 0, barriers: [] };
      if (cleared.length) summaryLines.push(`Cleared: ${cleared.join(", ")}.`);
    } else if (kind === "social") {
      const before = ch.state.resolve;
      ch.state.resolve = Math.min(Derived.maxResolve(ch), ch.state.resolve + Derived.effectiveAttributes(ch).presence);
      summaryLines.push(`Resolve ${before} → ${ch.state.resolve} (+${ch.state.resolve - before}).`);
      ch.state.session.karmaAnswers.social = true;
      if (Settings.soloMode()) socialScenePlayed = true;
    } else if (kind === "adventure") {
      ch.state.session.spendUnlocked = true;
      ch.state.session.karmaAnswers = {};
      ch.state.session.badKarmaAnswers = {};
      ch.state.scene = { wreckedZones: [], usedOncePerScene: [], energyDice: 0, barriers: [] };
      ch.advancementLog.push({ at: Date.now(), kind: "adventure", label: "Adventure closed", cost: 0 });
      summaryLines.push("Adventure logged and session flags cleared; karma spending unlocked.");
    }
  }, { id });

  if (socialScenePlayed) {
    const Solo = await import("./solo.js");
    Solo.markSocialScenePlayed();
  }
  return summaryLines;
}

async function openSessionEnd(c) {
  const answers = {};
  const bad = {};
  // Solo heroes earn karma from objective timers, not the session questions (§3.20) — asking both
  // would double-count.
  const solo = Settings.soloMode();
  const body = el("div", { class: "session-end" });
  const total = el("p", { class: "stat-line", "aria-live": "polite" });

  const update = () => {
    const gained = solo ? 0 : D.KARMA.earnQuestions.reduce((n, q) => n + (answers[q.key] ? (q.key === "flaw" && answers.flawOvercome ? D.KARMA.overcomeFlawBonus : 1) : 0), 0);
    const lost = solo ? 0 : D.KARMA.badQuestions.reduce((n, q) => n + (bad[q.key] ? 1 : 0), 0);
    total.textContent = solo
      ? `Solo play: karma comes from completed objectives on the Solo tab (current total ${c.state.karma}).`
      : `Karma this session: +${gained} − ${lost} = ${Math.max(0, gained - lost)} (current total ${c.state.karma})`;
  };

  if (solo) {
    body.append(el("p", { class: "muted", text: "Crisis Mode is on. In solo play karma is earned by reaching objectives on the objective timer, so the ten session questions do not apply — claim objective karma on the Solo tab instead." }));
    body.append(el("p", { class: "cite" }, el("a", { href: "#/solo", class: "rules-link" }, "Open the Solo tab")));
  }

  if (!solo) body.append(el("h4", { class: "section", text: "Karma questions" }));
  for (const q of solo ? [] : D.KARMA.earnQuestions) {
    // Pre-tick anything the scene bundles already answered during play (§3.12).
    answers[q.key] = !!c.state.session.karmaAnswers?.[q.key];
    const cb = el("input", { type: "checkbox", checked: answers[q.key], onchange: (e) => { answers[q.key] = e.target.checked; update(); } });
    body.append(el("label", { class: "check" }, cb, ` ${q.text}`));
    if (q.key === "flaw") {
      const oc = el("input", { type: "checkbox", onchange: (e) => { answers.flawOvercome = e.target.checked; if (e.target.checked) { answers.flaw = true; } update(); } });
      body.append(el("label", { class: "check indent" }, oc, " I overcame my flaw instead (2 karma, and the flaw is removed)"));
    }
  }
  if (!solo) body.append(el("h4", { class: "section", text: "Bad karma" }));
  for (const q of solo ? [] : D.KARMA.badQuestions) {
    const pre = q.key === "wrecked" && ((c.state.session.wreckedZones || []).length > 0 || (c.state.scene.wreckedZones || []).length > 0);
    const cb = el("input", { type: "checkbox", checked: pre, onchange: (e) => { bad[q.key] = e.target.checked; update(); } });
    if (pre) bad[q.key] = true;
    body.append(el("label", { class: "check" }, cb, ` ${q.text}`));
  }
  body.append(el("h4", { class: "section", text: "Reputation" }));
  const repUp = el("input", { type: "checkbox" });
  body.append(el("label", { class: "check" }, repUp, " A great or terrible deed became publicly known (+1 Reputation)"));
  const repDown = el("input", { type: "checkbox" });
  body.append(el("label", { class: "check" }, repDown, " A few months have passed with no increase (−1 Reputation)"));
  body.append(total);
  body.append(el("p", { class: "cite" }, el("a", { href: "#/rules/karma", class: "rules-link" }, "Rules: Karma")));
  update();

  const go = await modal({ title: "End session", body, size: "wide",
    actions: [{ label: "Cancel", value: false, variant: "ghost" }, { label: "Apply", value: true, variant: "primary" }] }).promise;
  if (!go) return;

  Store.snapshot("End session");
  let msg = "";
  Store.updateCharacter((ch) => {
    const gained = solo ? 0 : D.KARMA.earnQuestions.reduce((n, q) => n + (answers[q.key] ? (q.key === "flaw" && answers.flawOvercome ? D.KARMA.overcomeFlawBonus : 1) : 0), 0);
    const lost = solo ? 0 : D.KARMA.badQuestions.reduce((n, q) => n + (bad[q.key] ? 1 : 0), 0);
    const before = ch.state.karma;
    ch.state.karma = Math.max(D.KARMA.floor, ch.state.karma + gained - lost);
    if (repUp.checked) ch.state.reputationGained = (ch.state.reputationGained || 0) + 1;
    if (repDown.checked) ch.state.reputationGained = (ch.state.reputationGained || 0) - 1;
    if (answers.flawOvercome) {
      ch.identity.flaw = "";
      ch.state.session.flawState = "removed";
      ch.state.session.flawlessSessions = 0;
    } else if (ch.state.session.flawState === "removed") {
      ch.state.session.flawlessSessions = (ch.state.session.flawlessSessions || 0) + 1;
      if (ch.state.session.flawlessSessions >= 1) ch.state.session.flawState = "chooseNew";
    }
    ch.state.session.spendUnlocked = true;
    ch.state.session.karmaAnswers = {};
    ch.state.session.badKarmaAnswers = {};
    ch.state.indomitableUsed = false;
    ch.state.scene.wreckedZones = [];
    ch.state.session.wreckedZones = [];
    msg = `Karma ${before} → ${ch.state.karma}. Spending is now unlocked.`;
  }, { id: c.id });

  const updated = Store.activeCharacter();
  if (updated.state.session.flawState === "chooseNew") {
    showToast("You played a full session without a flaw — choose a new one, preferably based on what happened in play.", { timeout: 8000 });
  }
  showToast(`Session ended. ${msg}`, { variant: "good", timeout: 8000,
    action: { label: "Undo", onClick: () => { Store.undo(); showToast("Undone."); } } });
  announce(`Session ended. ${msg}`);

  // Base event roll if a team exists.
  const team = Store.getTeam();
  if (team) {
    const wantsEvent = await confirmModal("Has a week of play passed? Roll on the base events table?", { title: "Base events", confirmLabel: "Roll" });
    if (wantsEvent) {
      const res = R.rollNamedTable({ die: "D66", entries: D.BASE_EVENTS });
      modal({ title: `Base event (${res.value})`,
        body: el("div", {}, el("h4", { text: res.entry.name }), el("p", { text: res.entry.desc })),
        actions: [{ label: "OK", variant: "primary" }] });
    }
  }
}

export function lifecycleButtons() {
  const c = Store.activeCharacter();
  const locked = c && !c.state.session.spendUnlocked;
  return el("div", { class: "row-actions" },
    el("button", { class: locked ? "btn ghost" : "btn", onclick: () => openLifecycle("start") }, "Start session"),
    el("button", { class: "btn ghost", onclick: () => openLifecycle("action") }, "End action scene"),
    el("button", { class: "btn ghost", onclick: () => openLifecycle("social") }, "End social scene"),
    el("button", { class: "btn ghost", onclick: () => openLifecycle("session") }, "End session"),
    el("button", { class: "btn ghost", onclick: () => openLifecycle("adventure") }, "End adventure"),
    Store.canUndo() ? el("button", { class: "btn warn", onclick: () => { Store.undo(); showToast("Last lifecycle change undone."); } }, `Undo ${Store.undoLabel()}`) : null);
}
