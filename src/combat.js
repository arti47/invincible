// combat.js — initiative, combatant cards, the generic progress/challenge tracker,
// and the scene / session / adventure lifecycle engine with confirmation + one-step undo.

import { el, clear, uid, clamp, d6 } from "./core.js";
import { modal, showToast, confirmModal, promptModal, chooseModal, announce, helpPanel } from "./ui.js";
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

/**
 * A combatant joining a round in progress draws one card; everyone else keeps theirs and keeps
 * whether they have acted. A full redraw belongs to the start of a round, not to reinforcements.
 */
export function dealCard(combat, cb) {
  const taken = new Set(combat.combatants.map((c) => c.card).filter(Boolean));
  const free = Array.from({ length: 10 }, (_, i) => i + 1).filter((n) => !taken.has(n));
  cb.card = free.length ? free[Math.floor(Math.random() * free.length)] : 1 + Math.floor(Math.random() * 10);
  cb.acted = false;
  cb.held = false;
  cb.actions = { full: true, quick: true };
  combat.combatants.sort((a, b) => (a.card || 99) - (b.card || 99));
  return combat;
}

/**
 * Spend what an attack costs and end the attacker's turn (§3.17). Every attack kind is a full
 * action; a charge is full + quick. With the full action gone the turn is over, so `acted` is set
 * and `currentTurn` moves on to the next card.
 */
export function spendAttackTurn(combat, attacker, kind) {
  attacker.actions = attacker.actions || { full: true, quick: true };
  attacker.actions.full = false;
  if (kind === "charge") attacker.actions.quick = false;
  attacker.acted = true;
  return currentTurn(combat);
}

/** Blocking and dodging are quick actions taken out of turn — they cost the action, not the turn. */
export function spendDefence(target) {
  target.actions = target.actions || { full: true, quick: true };
  target.actions.quick = false;
  return target;
}

/** Whose turn it is: lowest card first, skipping anyone who has already acted (§3.17). */
export function currentTurn(combat) {
  return combat.combatants.find((c) => !c.acted && c.health > 0) || null;
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

/* ---------------------------------------------------------------- where you are in the session */

/**
 * The one thing the whole app can agree on: which beat of §3.12 is live, and the single control
 * that carries it forward. Every surface reads this rather than guessing from its own state, so
 * "what do I do next" has the same answer on Home, the Sheet and the Action tab.
 */
export function sessionStage(c = Store.activeCharacter()) {
  if (!c) return { key: "create", title: "Make a hero", why: "Nothing to play yet. Build a hero or take a published one.", label: "Create your hero", href: "#/create" };
  const combat = getCombat();
  if (combat?.active) {
    const up = currentTurn(combat);
    return { key: "inAction", title: `Action scene — round ${combat.round}`,
      why: up ? `${up.name} acts now. Work down the initiative cards, then draw the next round.` : "Everyone has acted. Draw the next round or end the scene.",
      label: "Go to the action scene", href: "#/combat" };
  }
  const st = c.state.session || {};
  if (st.spendUnlocked || st.stage === "idle") {
    return { key: "start", title: "Between sessions", why: "Karma can be spent now, in a safe location. Start the session when play begins.",
      label: "Start session", run: () => openLifecycle("start") };
  }
  if (st.stage === "afterAction") {
    return { key: "social", title: "The action scene is over", why: "Alternate scenes: a social scene now restores Resolve equal to your PRESENCE.",
      label: "End social scene", run: () => openLifecycle("social") };
  }
  if (st.stage === "afterSocial") {
    return { key: "next", title: "Between scenes", why: "Back to the story: start the next action scene, or close the session if the issue is done.",
      label: "Start action scene", run: () => { startActionScene(); location.hash = "#/combat"; } };
  }
  return { key: "open", title: "Session open", why: "Open with a briefing, then alternate action and social scenes.",
    label: "Start action scene", run: () => { startActionScene(); location.hash = "#/combat"; } };
}

/** The stage rendered as the same "do this next" card the Solo tab uses. */
export function stageCard() {
  const s = sessionStage();
  const action = s.href
    ? el("a", { class: "btn primary big", href: s.href }, s.label)
    : el("button", { class: "btn primary big", onclick: () => s.run() }, s.label);
  return el("section", { class: "card next-step", id: "session-stage" },
    el("p", { class: "next-step-eyebrow", text: "Now" }),
    el("h2", { text: s.title }),
    el("p", { class: "next-step-why", text: s.why }),
    el("div", { class: "row-actions" }, action));
}

/* ---------------------------------------------------------------- attacking from the board */

/**
 * The whole attack, resolved against a combatant already on the board: pick a kind, pick a target
 * off the initiative list, let the defender declare a block or dodge (rolled from their own
 * attributes, not typed in), roll, then APPLY the damage. Nothing is copied by hand.
 */
async function openAttack(attacker, combat, mount) {
  const targets = combat.combatants.filter((c) => c.id !== attacker.id && c.health > 0);
  if (!targets.length) { showToast("Nobody left to attack.", { variant: "warn" }); return; }

  const kind = await chooseModal(`${attacker.name} attacks — how?`, [
    { label: "Slugfest", hint: "FIGHTING, same zone, full action. Blockable.", value: "slugfest" },
    { label: "Shooting", hint: "AGILITY at range, full action. Dodgeable.", value: "shooting" },
    { label: "Charge", hint: "STRENGTH, full + quick. Cannot be blocked, can be dodged.", value: "charge" },
    { label: "Grapple", hint: "FIGHTING, no weapon. Blockable.", value: "grapple" },
  ]);
  if (!kind) return;

  const targetId = targets.length === 1 ? targets[0].id : await chooseModal("Attack whom?", targets.map((t) => ({
    label: t.name + (t.minionCount > 0 ? ` (${t.health} left)` : ""),
    hint: `${t.altitude} · Health ${t.health}/${t.maxHealth}${t.armor ? ` · Armor ${t.armor}` : ""}${t.huge ? " · Huge" : ""}`,
    value: t.id })));
  const target = targets.find((t) => t.id === targetId);
  if (!target) return;

  const conf = Roller.ATTACK_KINDS[kind];
  if (kind === "grapple" && target.huge) { showToast("Huge creatures cannot be grappled.", { variant: "warn" }); return; }

  // The defence is declared before any dice are rolled (§3.2).
  const defKind = conf.blockable ? "block" : conf.dodgeable ? "dodge" : null;
  const defAttr = defKind === "block" ? "fighting" : "agility";
  let defence = null;
  if (defKind && !target.huge) {
    const dice = target.attrs?.[defAttr] || 0;
    const declared = dice > 0 && await confirmModal(
      `Declared before the roll: does ${target.name} spend a quick action to ${defKind}? They would roll ${dice} ${defAttr.toUpperCase()} dice, and each 6 cancels one of the attacker's.`,
      { title: defKind === "block" ? "Block?" : "Dodge?", confirmLabel: `They ${defKind}`, cancelLabel: "No defence" });
    if (declared) { defence = { kind: defKind, dice }; spendDefence(target); }
  }

  const heroChar = attacker.refId ? Store.getCharacter(attacker.refId) : null;
  const weapon = heroChar ? await pickWeapon(heroChar) : null;
  const roll = heroChar
    ? Roller.makeAttack(heroChar, kind, { weapon, huge: target.huge, targetName: target.name })
    : npcAttack(attacker, kind, target);

  // The action is spent as soon as the dice hit the table, hit or miss.
  const upNext = spendAttackTurn(combat, attacker, kind);
  save(combat);

  let resolved = null;
  if (defence) {
    const dr = Roller.rollRaw(defence.dice, `${target.name} ${defence.kind}s`, { pushable: false });
    resolved = { ...defence, roll: dr,
      ...(defence.kind === "block" ? Roller.resolveBlock(roll, dr) : Roller.resolveDodge(roll, dr)) };
  }
  showAttack(attacker, target, kind, roll, resolved, combat, mount, upNext);
}

/** Weapons the hero could be swinging; skipped entirely when they have none. */
async function pickWeapon(hero) {
  const weapons = (hero.inventory?.items || []).filter((i) => i.damage || i.bonus);
  if (!weapons.length) return null;
  const pick = await chooseModal("Weapon?", [{ label: "Unarmed / powers", value: "__none" },
    ...weapons.map((w) => ({ label: w.name, hint: `Bonus +${w.bonus || 0}, Damage ${w.damage || "—"}`, value: w.name }))]);
  return weapons.find((w) => w.name === pick) || null;
}

/** An NPC attacking: the same arithmetic, rolled off the profile's attributes. */
function npcAttack(attacker, kind, target) {
  const attr = Roller.ATTACK_KINDS[kind].attr;
  const dice = Math.max(1, attacker.attrs?.[attr] || 1);
  const r = Roller.rollRaw(dice, `${attacker.name} — ${Roller.ATTACK_KINDS[kind].label} → ${target.name}`, { pushable: false });
  r.meta = { kind, damage: attacker.slugfest || 1, damageSource: "Slugfest Damage",
    stunts: Roller.stuntsFor(kind, { huge: target.huge }) };
  return r;
}

function showAttack(attacker, target, kind, roll, defence, combat, mount, upNext = null) {
  const effective = defence ? defence.remainingSixes : roll.sixes;
  const stunts = Roller.stuntsFor(kind, { huge: target.huge });
  const available = Math.max(0, effective - 1);
  const chosen = new Set();

  const body = el("div", {});
  const draw = () => {
    clear(body);
    body.append(el("div", { class: "dice-row" }, ...roll.dice.map((v) =>
      el("span", { class: `die ${v === 6 ? "six" : v === 1 ? "one" : ""}`, text: String(v) }))));
    if (defence) {
      body.append(el("p", { class: "muted small", text: `${target.name} ${defence.kind}s: ${defence.roll.sixes} six${defence.roll.sixes === 1 ? "" : "es"} cancelling.` }),
        el("div", { class: "dice-row" }, ...defence.roll.dice.map((v) =>
          el("span", { class: `die ${v === 6 ? "six" : v === 1 ? "one" : ""}`, text: String(v) }))));
    }
    const dmg = damageFor();
    body.append(el("p", { class: `outcome ${effective ? "good" : "bad"}`,
      text: effective
        ? `Hit — ${dmg} damage${target.armor ? ` before ${target.name}'s Armor ${target.armor}` : ""}.`
        : defence ? `Stopped — the ${defence.kind} cancelled it.` : "Miss." }));
    if (defence?.note) body.append(el("p", { class: "warn", text: defence.note }));

    if (effective && available) {
      body.append(el("p", { class: "muted small", text: `${available} stunt${available === 1 ? "" : "s"} available — tap to apply.` }));
      const row = el("div", { class: "chiprow" });
      for (const st of stunts) {
        row.append(el("button", {
          class: `chip selectable ${chosen.has(st.name) ? "selected" : ""}`, title: st.desc,
          onclick: () => {
            if (chosen.has(st.name)) chosen.delete(st.name);
            else if (chosen.size < available) chosen.add(st.name);
            else { showToast(`Only ${available} stunt${available === 1 ? "" : "s"} to spend.`, { variant: "warn" }); return; }
            draw();
          },
        }, st.name));
      }
      body.append(row);
      for (const name of chosen) {
        const st = stunts.find((x) => x.name === name);
        if (st) body.append(el("p", { class: "small" }, el("strong", { text: `${st.name}: ` }), st.desc));
      }
    }
    body.append(el("p", { class: "cite" }, el("a", { href: "#/rules/stunts", class: "rules-link" }, "Rules: Stunts")));
    body.append(el("p", { class: "stage-label",
      text: upNext ? `Turn spent — ${upNext.name} acts next (card #${upNext.card || "—"}).`
        : "Turn spent — everyone has acted. Draw the next round." }));
  };

  const damageFor = () => {
    let d = roll.meta.damage || 0;
    if (chosen.has("Double Damage")) d *= 2;
    return d;
  };

  draw();
  const actions = [{ label: "Done", variant: "ghost" }];
  if (effective) {
    actions.push({ label: "Apply damage", variant: "primary", onClick: () => {
      applyAttackDamage(target, damageFor(), combat, [...chosen]);
      return true;
    } });
  }
  modal({ title: `${attacker.name} → ${target.name}`, body, actions }).promise.then(() => {
    announce(upNext ? `${upNext.name} acts next.` : "Everyone has acted.");
    renderCombat(mount);
  });
}

/** Damage lands on the board: minions drop one per point, heroes route through the crit engine. */
export function applyAttackDamage(target, amount, combat, stunts = []) {
  const after = Math.max(0, amount - (target.armor || 0));
  if (target.minionCount > 0) {
    target.health = Math.max(0, target.health - after);
    showToast(`${after} minion(s) down. ${target.health} remain.`, { variant: "good" });
  } else if (target.refId) {
    Store.updateCharacter((ch) => { Roller.applyDamage(ch, amount, { armor: target.armor }); }, { id: target.refId });
    const updated = Store.getCharacter(target.refId);
    target.health = updated.state.health;
    showToast(`${target.name} takes ${after}${updated.state.broken ? " — BROKEN" : ""}.`, { variant: updated.state.broken ? "danger" : "" });
  } else {
    target.health = Math.max(0, target.health - after);
    showToast(target.health === 0
      ? `${target.name} is broken — knocked out or killed, as fits the moment.`
      : `${target.name} takes ${after} damage.`, { variant: target.health === 0 ? "danger" : "good", timeout: 5000 });
  }
  for (const st of stunts) applyStunt(target, st);
  save(combat);
}

/** Stunts that change the board rather than the damage number. */
function applyStunt(target, name) {
  if (name === "Stun") target.conditions = { ...target.conditions, stunned: true };
  if (name === "Trap") target.conditions = { ...target.conditions, immobilised: true };
  if (name === "Suppressed") target.conditions = { ...target.conditions, suppressed: true };
  if (name === "Knockback") target.zone = (target.zone || 1) + 1;
}

/* ---------------------------------------------------------------- rendering */

export function renderCombat(mount) {
  clear(mount);
  let combat = getCombat();
  if (!combat || !combat.active) {
    mount.append(el("div", { class: "empty" },
      el("h2", { text: "No action scene running" }),
      el("p", { text: "Start a scene to draw initiative, track combatants and apply damage." }),
      el("button", { class: "btn primary", onclick: () => { startActionScene(); renderCombat(mount); } }, "Start action scene"),
      // Between scenes, not next steps: these close stages you have already played.
      el("p", { class: "stage-label", text: "Between scenes" }),
      el("div", { class: "row-actions" },
        el("button", { class: "btn ghost", onclick: () => openLifecycle("social") }, "End social scene"),
        el("button", { class: "btn ghost", onclick: () => openLifecycle("session") }, "End session"))));
    renderTasks(mount);
    return;
  }

  const up = currentTurn(combat);
  const roundDone = !up;
  mount.append(el("div", { class: "combat-head" },
    el("h2", { text: `Round ${combat.round}` }),
    el("p", { class: "stage-label", text: roundDone ? "Everyone has acted — draw the next round" : `${up.name} acts now (card #${up.card || "—"})` }),
    // Round order: set the board, take actions (wrecking is one), then advance, then finish.
    el("div", { class: "row-actions" },
      el("button", { class: "btn ghost", onclick: () => openAddCombatant(mount) }, "Add combatant"),
      el("button", { class: "btn ghost", onclick: () => openWreck(combat, mount) }, "Wreck a zone"),
      el("button", { class: roundDone ? "btn primary" : "btn", onclick: () => { combat.round += 1; save(drawInitiative(combat)); renderCombat(mount); } }, "Next round"),
      el("button", { class: "btn danger", onclick: async () => {
        if (await confirmModal("End the action scene and run the end-of-scene recovery?", { title: "End action scene", confirmLabel: "End scene" })) {
          Store.clearCombat(); openLifecycle("action"); renderCombat(mount);
        }
      } }, "End scene"))));

  const list = el("div", { class: "combatants" });
  for (const cb of combat.combatants) list.append(combatantCard(cb, combat, mount, cb === up));
  mount.append(list);

  if (combat.wreckedZones.length) {
    mount.append(el("p", { class: "warn small", text: `Wrecked zones this scene: ${combat.wreckedZones.join(", ")} — wrecking costs bad karma at the end of the session.` }));
  }
  renderTasks(mount);
}

function combatantCard(cb, combat, mount, isUp = false) {
  const isMinion = cb.minionCount > 0;
  return el("div", { class: `combatant ${cb.side} ${cb.acted ? "acted" : ""} ${cb.health <= 0 ? "down" : ""} ${isUp ? "current" : ""}` },
    el("div", { class: "cbt-head" },
      el("span", { class: "cbt-card", text: cb.card ? `#${cb.card}` : "—" }),
      el("strong", { text: cb.name + (isMinion ? ` (${cb.health} minions)` : "") }),
      isUp ? el("span", { class: "chip", text: "Acts now" }) : null,
      cb.huge ? el("span", { class: "chip warn", text: "Huge" }) : null),
    el("div", { class: "cbt-stats" },
      el("span", { text: isMinion ? `Minions ${cb.health}/${cb.maxHealth}` : `Health ${cb.health}/${cb.maxHealth}` }),
      el("span", { text: `Resolve ${cb.resolve}/${cb.maxResolve}` }),
      cb.armor ? el("span", { text: `Armor ${cb.armor}` }) : null,
      el("span", { text: `Slugfest ${cb.slugfest}` }),
      el("span", { text: cb.altitude })),
    // A turn in order: pass your place, move, resolve what hits you, then mark the turn spent.
    el("div", { class: "cbt-actions" },
      cb.health > 0 ? el("button", { class: "btn tiny primary", onclick: () => openAttack(cb, combat, mount) }, "Attack") : null,
      el("button", { class: "btn tiny ghost", onclick: () => holdOff(cb, combat, mount) }, "Hold off"),
      el("button", { class: "btn tiny ghost", onclick: () => cycleAltitude(cb, combat, mount) }, "Altitude"),
      el("button", { class: "btn tiny ghost", onclick: () => damageCombatant(cb, combat, mount) }, "Damage"),
      el("button", { class: "btn tiny", onclick: () => { cb.acted = !cb.acted; save(combat); renderCombat(mount); } }, cb.acted ? "Un-act" : "Acted"),
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
  const added = combat.combatants[combat.combatants.length - 1];
  if (combat.round > 1 || combat.combatants.some((c) => c.acted)) dealCard(combat, added);
  else drawInitiative(combat);
  save(combat);
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
    helpPanel(["A challenge is an obstacle with a rating and a time limit rather than an enemy to hit.", "Every 6 anyone rolls removes 1 point from the rating. Clear it to 0 inside the limit and you succeed; run out of time and the stated failure happens.", "Handling an objective always needs a roll, even if a power would obviously solve it."]),
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
      ch.state.session.stage = "open";
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
      ch.state.session.stage = "afterAction";
      if (cleared.length) summaryLines.push(`Cleared: ${cleared.join(", ")}.`);
    } else if (kind === "social") {
      const before = ch.state.resolve;
      ch.state.resolve = Math.min(Derived.maxResolve(ch), ch.state.resolve + Derived.effectiveAttributes(ch).presence);
      summaryLines.push(`Resolve ${before} → ${ch.state.resolve} (+${ch.state.resolve - before}).`);
      ch.state.session.karmaAnswers.social = true;
      ch.state.session.stage = "afterSocial";
      if (Settings.soloMode()) socialScenePlayed = true;
    } else if (kind === "adventure") {
      ch.state.session.spendUnlocked = true;
      ch.state.session.karmaAnswers = {};
      ch.state.session.badKarmaAnswers = {};
      ch.state.scene = { wreckedZones: [], usedOncePerScene: [], energyDice: 0, barriers: [] };
      ch.advancementLog.push({ at: Date.now(), kind: "adventure", label: "Adventure closed", cost: 0 });
      ch.state.session.stage = "idle";
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
    ch.state.session.stage = "idle";
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

/**
 * The session in the order it is played (§3.12): open the session, then alternate scenes, then
 * close out. The scene bundles are all "end" bundles in the book, so the only start control the
 * rules give us is the action scene itself — it is here so the row never asks you to end a scene
 * you were never offered a way to begin.
 */
export function lifecycleButtons() {
  const c = Store.activeCharacter();
  const running = !!(c && !c.state.session.spendUnlocked);
  const inScene = !!getCombat()?.active;
  return el("div", { class: "lifecycle" },
    el("p", { class: "stage-label", text: "1 · Open the session" }),
    el("div", { class: "row-actions" },
      el("button", { class: running ? "btn ghost" : "btn primary", onclick: () => openLifecycle("start") }, "Start session")),
    el("p", { class: "stage-label", text: "2 · Alternate scenes — briefing, action, social" }),
    el("div", { class: "row-actions" },
      inScene
        ? el("a", { class: "btn", href: "#/combat" }, "Go to the action scene")
        : el("button", { class: "btn", onclick: () => { startActionScene(); location.hash = "#/combat"; } }, "Start action scene"),
      el("button", { class: "btn ghost", onclick: () => openLifecycle("action") }, "End action scene"),
      el("button", { class: "btn ghost", onclick: () => openLifecycle("social") }, "End social scene")),
    el("p", { class: "stage-label", text: "3 · Close out" }),
    el("div", { class: "row-actions" },
      el("button", { class: "btn ghost", onclick: () => openLifecycle("session") }, "End session"),
      el("button", { class: "btn ghost", onclick: () => openLifecycle("adventure") }, "End adventure"),
      Store.canUndo() ? el("button", { class: "btn warn", onclick: () => { Store.undo(); showToast("Last lifecycle change undone."); } }, `Undo ${Store.undoLabel()}`) : null));
}

/**
 * Start an action scene: new combat, the active hero in it, initiative drawn. A scene that is
 * already running is returned untouched — starting one must never wipe a fight in progress.
 */
export function startActionScene() {
  const running = getCombat();
  if (running?.active) return running;
  const c = newCombat();
  const hero = Store.activeCharacter();
  if (hero) c.combatants.push(combatantFromCharacter(hero));
  save(drawInitiative(c));
  return c;
}

/** Put a combatant into a running scene without disturbing anyone else's card or turn. */
export function joinCombat(combat, combatant) {
  combat.combatants.push(combatant);
  dealCard(combat, combatant);
  save(combat);
  return combatant;
}

/** A combatant with nothing but a name — for an enemy the player is inventing on the spot. */
export function blankCombatant(name, { health = 4, slugfest = 2 } = {}) {
  return {
    id: uid("cbt"), refId: null, name: name || "Enemy", side: "adversary",
    attrs: { fighting: 3, agility: 3, strength: 3, reason: 2, intuition: 2, presence: 2 },
    health, maxHealth: health, resolve: 3, maxResolve: 3, armor: 0, slugfest,
    conditions: {}, altitude: "ground", zone: 1, minionCount: 0, huge: false,
    card: null, acted: false, actions: { full: true, quick: true },
  };
}
