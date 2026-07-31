// roller.js — the dice engine. Pools, push economy, stunts, opposed sequences, attacks,
// damage, purchases and the roll log. Rules numbers come from data.js only.

import { pool, countSixes, countOnes, d6, clamp, uid, SUCCESS, BANE } from "./core.js";
import * as R from "./rules.js";
import { D } from "./rules.js";
import * as Derived from "./derived.js";
import { pushRollLog } from "./store.js";
import { Settings } from "./settings.js";

/* ---------------------------------------------------------------- pools */

/**
 * Build a dice pool with every modifier applied. Pool floor is 1 (audit A1).
 * @returns {{pool:number, base:number, mods:Array<{label:string,value:number}>}}
 */
export function buildPool(character, attr, { extra = 0, help = 0, gear = 0, situational = [] } = {}) {
  const base = character ? Derived.effectiveAttributes(character)[attr] || 1 : 1;
  const mods = [];
  if (character) {
    const crit = Derived.critPenalty(character).dice[attr] || 0;
    if (crit) mods.push({ label: "Critical injury", value: crit });
    const cond = Derived.conditionPenalty(character).dice[attr] || 0;
    if (cond) mods.push({ label: "Condition", value: cond });
  }
  if (help) mods.push({ label: "Help", value: help });
  if (gear) mods.push({ label: "Gear", value: gear });
  if (extra) mods.push({ label: "Modifier", value: extra });
  for (const s of situational) if (s && s.value) mods.push(s);
  const total = base + mods.reduce((n, m) => n + m.value, 0);
  return { pool: Math.max(1, total), base, mods, clamped: total < 1 };
}

/** Roll a pool, or accept manually entered faces. */
export function rollPool(size, manualFaces = null) {
  if (Array.isArray(manualFaces) && manualFaces.length) {
    return manualFaces.map((f) => clamp(Math.round(Number(f) || 1), 1, 6));
  }
  return pool(size);
}

export function makeRoll({ character, attr, label, dice, poolInfo, passive = false, defending = false, meta = {} }) {
  return {
    id: uid("roll"),
    label, attr, dice,
    pool: poolInfo?.pool ?? dice.length,
    base: poolInfo?.base,
    mods: poolInfo?.mods || [],
    sixes: countSixes(dice),
    ones: countOnes(dice),
    pushes: 0,
    stressTaken: 0,
    passive, defending,
    characterId: character?.id || null,
    characterName: character?.identity?.heroName || character?.identity?.realName || null,
    meta,
  };
}

/**
 * Roll an attribute for a character.
 */
export function roll(character, attr, label, opts = {}) {
  const poolInfo = buildPool(character, attr, opts);
  const dice = rollPool(poolInfo.pool, opts.manualFaces);
  const r = makeRoll({ character, attr, label, dice, poolInfo, passive: opts.passive, defending: opts.defending, meta: opts.meta });
  if (opts.log !== false) logRoll(r);
  return r;
}

/** A raw pool roll not tied to an attribute (Reputation, Blast rating, fire Intensity…). */
export function rollRaw(size, label, { pushable = false, meta = {}, manualFaces = null, log = true } = {}) {
  const dice = rollPool(size, manualFaces);
  const r = makeRoll({ attr: null, label, dice, poolInfo: { pool: size, base: size, mods: [] }, meta });
  r.pushable = pushable;
  if (log) logRoll(r);
  return r;
}

/* ---------------------------------------------------------------- push (audits A2, A3) */

export function canPush(character, roll) {
  if (roll.pushable === false) return { ok: false, reason: "This roll cannot be pushed." };
  return Derived.canPush(character, {
    passive: roll.passive, defending: roll.defending,
    alreadyPushed: roll.pushes, attr: roll.attr,
  });
}

/**
 * Push a roll: re-roll every die showing neither 6 nor 1. All dice count afterwards, and each 1
 * showing after the push costs 1 stress (audit A2).
 * Returns { roll, stress } — the caller applies the stress to the character.
 */
export function pushRoll(character, roll, manualFaces = null) {
  const check = canPush(character, roll);
  if (!check.ok) return { ok: false, reason: check.reason, roll };
  const kept = roll.dice.filter((v) => v === SUCCESS || v === BANE);
  const rerollCount = roll.dice.length - kept.length;
  const rerolled = rollPool(rerollCount, manualFaces);
  const dice = [...kept, ...rerolled];
  const indomitable = false; // Indomitable is applied by the caller before charging stress.
  roll.dice = dice;
  roll.sixes = countSixes(dice);
  roll.ones = countOnes(dice);
  roll.pushes += 1;
  const stress = indomitable ? 0 : roll.ones;
  roll.stressTaken += stress;
  roll.pushedAt = Date.now();
  logRoll(roll, { update: true });
  return { ok: true, roll, stress, rerolled: rerollCount };
}

/* ---------------------------------------------------------------- opposed (audit A4) */

/**
 * Resolve an opposed roll. The active party must succeed AND roll more 6s; each opposing 6
 * cancels one. Ties fail for the active party.
 */
export function resolveOpposed(activeRoll, opposingRoll) {
  const net = activeRoll.sixes - opposingRoll.sixes;
  const success = activeRoll.sixes > 0 && net > 0;
  return {
    success,
    tie: activeRoll.sixes === opposingRoll.sixes,
    net: Math.max(0, net),
    stunts: Math.max(0, net - 1),
    activeSixes: activeRoll.sixes,
    opposingSixes: opposingRoll.sixes,
    note: activeRoll.sixes === opposingRoll.sixes
      ? "Tie — the active party's action fails. Re-roll the whole contest if a tie must be broken."
      : null,
  };
}

/** Block (audit A5): surplus 6s beyond those needed to cancel become an automatic counterattack. */
export function resolveBlock(attackRoll, blockRoll) {
  const blocked = blockRoll.sixes >= attackRoll.sixes && attackRoll.sixes > 0;
  const surplus = blockRoll.sixes - attackRoll.sixes;
  return {
    hit: attackRoll.sixes > 0 && blockRoll.sixes < attackRoll.sixes,
    remainingSixes: Math.max(0, attackRoll.sixes - blockRoll.sixes),
    blocked,
    counterattack: surplus > 0,
    counterSixes: Math.max(0, surplus),
    counterStunts: Math.max(0, surplus - 1),
    note: surplus > 0
      ? `Counterattack! It hits automatically with ${surplus} success${surplus === 1 ? "" : "es"}; a counterattack cannot be blocked.`
      : null,
  };
}

/** Dodge: surplus 6s let you move one zone each. */
export function resolveDodge(attackRoll, dodgeRoll) {
  const surplus = dodgeRoll.sixes - attackRoll.sixes;
  return {
    hit: attackRoll.sixes > 0 && dodgeRoll.sixes < attackRoll.sixes,
    remainingSixes: Math.max(0, attackRoll.sixes - dodgeRoll.sixes),
    dodgeMove: Math.max(0, surplus),
    note: surplus > 0 ? `Dodge move: you may move ${surplus} zone${surplus === 1 ? "" : "s"}.` : null,
  };
}

/* ---------------------------------------------------------------- attacks */

export const ATTACK_KINDS = {
  slugfest: { attr: "fighting", label: "Slugfest attack", stunts: () => D.SLUGFEST_STUNTS, blockable: true },
  shooting: { attr: "agility", label: "Shooting attack", stunts: () => D.SHOOTING_STUNTS, dodgeable: true },
  charge: { attr: "strength", label: "Charge attack", stunts: () => D.SLUGFEST_STUNTS.filter((s) => s.name === "Double Damage").concat([{ name: "Slam", desc: D.SPECIAL_ATTACKS.slam }]), dodgeable: true, blockable: false },
  grapple: { attr: "fighting", label: "Grapple", stunts: () => D.SLUGFEST_STUNTS.filter((s) => s.name === "Double Damage"), blockable: true },
};

/** Stunts legal against this target (audit A19). */
export function stuntsFor(kind, { huge = false } = {}) {
  const list = (ATTACK_KINDS[kind]?.stunts() || []).slice();
  if (!huge) return list;
  const banned = ["Knockback", "Stun", "Slam", "Suppressed", "Deadly Hit"];
  return list.filter((s) => !banned.includes(s.name));
}

export function attackDamage(character, kind, { weapon = null, power = null, powerLevel = 0 } = {}) {
  if (power) {
    const def = R.findPower(power);
    const dmg = R.powerValue(def, "damage", powerLevel);
    if (dmg !== undefined) return { damage: dmg, source: R.powerDisplayName({ name: def.name, level: powerLevel }) };
  }
  if (weapon && weapon.damage) return { damage: weapon.damage, source: weapon.name };
  if (kind === "shooting") return { damage: 0, source: "No ranged weapon or power" };
  return { damage: Derived.slugfestDamage(character), source: "Slugfest Damage" };
}

/**
 * Damage from the Knockback / Bang Heads / Slam stunts = half BASE STRENGTH, round up —
 * never Slugfest Damage (audit A6).
 */
export function stuntDamage(character) {
  const str = Derived.effectiveAttributes(character).strength || 1;
  return Math.ceil(str / 2);
}

export function makeAttack(character, kind, opts = {}) {
  const conf = ATTACK_KINDS[kind];
  if (!conf) throw new Error(`Unknown attack kind: ${kind}`);
  const situational = [];
  if (opts.unaware) situational.push({ label: "Unaware/restrained target", value: 2 });
  if (opts.wreckBonus) situational.push({ label: "Wrecking the zone", value: opts.wreckBonus });
  if (opts.underMinimumRange) situational.push({ label: "Inside minimum range", value: -3 });
  if (opts.weapon?.bonus) situational.push({ label: opts.weapon.name, value: opts.weapon.bonus });
  if (kind === "charge" && R.hasTalent(character, "Charger")) situational.push({ label: "Charger", value: 2 });
  if (kind === "grapple" && R.hasTalent(character, "Subdue")) situational.push({ label: "Subdue", value: 2 });
  if (kind === "slugfest" && opts.huge && R.hasTalent(character, "Bigger They Are")) situational.push({ label: "Bigger They Are", value: 2 });
  if (kind === "slugfest" && opts.hardHitter && R.hasTalent(character, "Hard Hitter")) situational.push({ label: "Hard Hitter (quick action spent)", value: 2 });
  if (kind === "shooting" && opts.aimed && R.hasTalent(character, "Sniper")) situational.push({ label: "Sniper (aimed)", value: 2 });
  if (opts.quickAction && kind === "slugfest" && R.hasTalent(character, "Martial Arts")) situational.push({ label: "Martial Arts (quick action)", value: -2 });
  if (opts.quickAction && kind === "shooting" && R.hasTalent(character, "Rapid Fire")) situational.push({ label: "Rapid Fire (quick action)", value: -2 });

  const r = roll(character, conf.attr, `${conf.label}${opts.targetName ? ` → ${opts.targetName}` : ""}`, {
    ...opts, situational: [...situational, ...(opts.situational || [])],
    meta: { kind, ...(opts.meta || {}) },
  });
  const dmg = attackDamage(character, kind, opts);
  r.meta.damage = dmg.damage;
  r.meta.damageSource = dmg.source;
  r.meta.stunts = stuntsFor(kind, { huge: opts.huge });
  r.meta.availableStunts = Math.max(0, r.sixes - 1);
  return r;
}

/* ---------------------------------------------------------------- damage & crits */

/**
 * Apply damage to a character (audit A8).
 * Returns { damageTaken, broken, critRoll, excess, absorbed }.
 */
export function applyDamage(character, amount, { armor = null, ignoreArmor = false, doubled = false, whileBroken = false } = {}) {
  const state = character.state;
  const armorValue = ignoreArmor ? 0 : (armor ?? Derived.armorRating(character).value);
  const raw = doubled ? amount * 2 : amount;
  const after = Math.max(0, raw - armorValue);
  const wasBroken = whileBroken || state.health <= 0;

  if (after === 0) return { damageTaken: 0, absorbed: raw, broken: wasBroken, crit: null };

  if (wasBroken) {
    // Damage while broken: another crit, adding the FULL damage to the D6.
    const crit = rollCriticalInjury(character, after);
    return { damageTaken: after, absorbed: armorValue, broken: true, crit, whileBroken: true };
  }

  const before = state.health;
  state.health = Math.max(0, before - after);
  if (state.health > 0) return { damageTaken: after, absorbed: armorValue, broken: false, crit: null };

  state.broken = true;
  const excess = after - before; // damage in excess of what was needed to break you
  const crit = rollCriticalInjury(character, excess);
  return { damageTaken: after, absorbed: armorValue, broken: true, excess, crit };
}

/**
 * Roll a critical injury (audit A9).
 * Adds +1 per existing crit; results at or below the worst existing crit bump one step worse.
 */
export function rollCriticalInjury(character, bonus = 0, { deadlyHit = false, manualDie = null } = {}) {
  const existing = (character.state.crits || []).filter((c) => !c.healed);
  const worst = existing.reduce((n, c) => Math.max(n, c.roll), 0);
  const die = manualDie || d6();
  const add = deadlyHit ? Math.min(6, bonus) : bonus;
  let value = die + add + existing.length;
  if (worst && value <= worst) value = worst + 1;
  const entry = R.critEntry(value, Settings.familyFriendly());
  const record = {
    id: uid("crit"), roll: entry.roll, rawValue: value, die, bonus: add,
    name: entry.name, healing: entry.healing, healed: false, at: Date.now(),
  };
  character.state.crits.push(record);
  if (entry.dying) {
    character.state.dying = { active: true, deadline: entry.dying, stabiliseAttempted: false, critId: record.id };
  }
  if (entry.dead) character.state.dead = true;
  logRoll({
    id: uid("roll"), label: `Critical injury — ${entry.name}`, attr: null,
    dice: [die], sixes: 0, ones: 0, pool: 1, mods: [{ label: "Damage/crit modifiers", value: add + existing.length }],
    characterId: character.id, characterName: character.identity?.heroName,
    meta: { crit: true, result: entry.name, value },
  });
  return { entry, record, value };
}

/** Rally (audit A11): impossible at crit 9 or worse. */
export function canRally(character) {
  const worst = (character.state.crits || []).filter((c) => !c.healed).reduce((n, c) => Math.max(n, c.roll), 0);
  if (!character.state.broken) return { ok: false, reason: "You are not broken." };
  if (worst >= 9) return { ok: false, reason: `You cannot rally with a ${R.critEntry(worst).name} injury (9 or worse).` };
  return { ok: true };
}

export function rally(character, { byAlly = false, manualFaces = null } = {}) {
  const check = canRally(character);
  if (!check.ok) return { ok: false, reason: check.reason };
  let attr = "presence";
  const situational = [];
  if (!byAlly && R.hasTalent(character, "Second Wind")) { attr = "strength"; situational.push({ label: "Second Wind", value: 2 }); }
  if (byAlly && R.hasTalent(character, "Motivator")) situational.push({ label: "Motivator", value: 2 });
  const r = roll(character, attr, byAlly ? "Rally an ally" : "Rally", { situational, manualFaces });
  const healed = r.sixes;
  if (healed > 0) {
    character.state.health = Math.min(Derived.maxHealth(character), healed);
    character.state.broken = character.state.health <= 0;
  }
  r.meta.healed = healed;
  return { ok: true, roll: r, healed };
}

/** Stabilise a dying character — one attempt only (audit A12). */
export function stabilise(character, medic, { gearBonus = 0, manualFaces = null } = {}) {
  const dying = character.state.dying;
  if (!dying?.active) return { ok: false, reason: "This character is not dying." };
  if (dying.stabiliseAttempted) return { ok: false, reason: "Only one stabilisation attempt is allowed, and it has been made." };
  const situational = [];
  if (gearBonus) situational.push({ label: "Medical gear", value: gearBonus });
  if (R.hasTalent(medic || character, "Medic")) situational.push({ label: "Medic", value: 2 });
  const r = roll(medic || character, "reason", "Stabilise a dying character", { situational, manualFaces });
  dying.stabiliseAttempted = true;
  if (r.sixes > 0) { dying.active = false; dying.stabilised = true; }
  return { ok: true, roll: r, success: r.sixes > 0 };
}

/* ---------------------------------------------------------------- other rolls */

/** Reputation recognition roll — never pushable (audit A21). */
export function rollReputation(character, { manualFaces = null } = {}) {
  const rep = Derived.reputation(character);
  if (rep <= 0) {
    return { recognised: false, roll: null, note: "Reputation 0 — nobody has heard of you yet." };
  }
  const r = rollRaw(rep, `Reputation (${rep})`, { pushable: false, manualFaces, meta: { reputation: true } });
  return {
    recognised: r.sixes > 0, roll: r,
    note: r.sixes > 0 ? "Recognised: +2 dice on PRESENCE rolls to persuade or intimidate here." : "Nobody recognises you.",
  };
}

/** Action banter — opposed PRESENCE, 1 stress per excess 6. */
export function banter(character, targetPresence, { targetHuge = false, manualFaces = null } = {}) {
  if (targetHuge) return { ok: false, reason: "Action banter does not work against huge creatures." };
  const situational = R.hasTalent(character, "Sharp-Tongued") ? [{ label: "Sharp-Tongued", value: 2 }] : [];
  const mine = roll(character, "presence", "Action banter", { situational, manualFaces });
  const theirs = rollRaw(Math.max(1, targetPresence), "Banter resistance (PRESENCE)", { log: false });
  const res = resolveOpposed(mine, theirs);
  const stress = Math.max(0, mine.sixes - theirs.sixes);
  mine.meta.opposed = { theirs: theirs.dice, stress };
  return { ok: true, roll: mine, opposing: theirs, result: res, stress };
}

/** Purchase (audit A13). */
export function purchase(character, item, { loan = 0, pooledDice = 0, manualFaces = null } = {}) {
  const res = Derived.resources(character);
  const streetwise = R.hasTalent(character, "Streetwise");
  const check = R.purchaseCheck({ resources: res, cost: item.cost, restricted: !!item.restricted, streetwise, loan });
  if (!check.allowed) return { ok: false, ...check };
  if (check.mode === "automatic") {
    logRoll({ id: uid("roll"), label: `Purchase: ${item.name}`, dice: [], sixes: 0, ones: 0, pool: 0, mods: [],
      characterId: character.id, characterName: character.identity?.heroName,
      meta: { purchase: true, automatic: true, item: item.name } });
    return { ok: true, mode: "automatic", success: true, note: check.reason };
  }
  const size = check.dice + pooledDice;
  const r = rollRaw(size, `Purchase: ${item.name} (Resources ${res}${pooledDice ? ` +${pooledDice} pooled` : ""})`,
    { pushable: false, manualFaces, meta: { purchase: true, item: item.name } });
  return {
    ok: true, mode: "roll", success: r.sixes > 0, roll: r,
    note: r.sixes > 0 ? "Purchase complete." : "Failed — you may make one PRESENCE roll to barter, if the GM allows.",
  };
}

export function barter(character, item, { manualFaces = null } = {}) {
  const r = roll(character, "presence", `Barter for ${item.name}`, { manualFaces });
  return { success: r.sixes > 0, roll: r };
}

/** Contribute to a challenge: every 6 removes 1 point from the Challenge rating. */
export function challengeContribution(character, attr, task, { situational = [], manualFaces = null, label } = {}) {
  const r = roll(character, attr, label || `Challenge: ${task.name}`, { situational, manualFaces, meta: { challenge: task.id } });
  return { roll: r, progress: r.sixes };
}

/** Fire damage: roll Intensity dice, 2 damage per 6 (armor applies normally). */
export function fireAttack(intensity, { manualFaces = null } = {}) {
  const r = rollRaw(intensity, `Fire (Intensity ${intensity})`, { pushable: false, manualFaces, meta: { fire: true } });
  return { roll: r, damage: r.sixes * 2 };
}

/** Placed explosive: Blast rating dice, base Damage = half the Blast (round up). */
export function explosion(blast, targets = 1, { manualFaces = null } = {}) {
  const damage = Math.ceil(blast / 2);
  const r = rollRaw(blast, `Explosion (Blast ${blast})`, { pushable: false, manualFaces, meta: { explosion: true } });
  const hits = r.sixes > 0;
  const doubles = Math.min(Math.max(0, r.sixes - 1), targets);
  return { roll: r, hits, damage, doubledTargets: doubles,
    note: hits ? `Everyone in the zone takes ${damage} damage; ${doubles} random target(s) take double.` : "No one is hurt." };
}

/* ---------------------------------------------------------------- log */

export function logRoll(rollObj, { update = false } = {}) {
  pushRollLog({
    rollId: rollObj.id,
    by: rollObj.characterId,
    characterName: rollObj.characterName,
    label: rollObj.label,
    attribute: rollObj.attr,
    pool: rollObj.pool,
    dice: rollObj.dice,
    sixes: rollObj.sixes,
    ones: rollObj.ones,
    pushed: rollObj.pushes || 0,
    stressTaken: rollObj.stressTaken || 0,
    mods: rollObj.mods,
    outcome: describeOutcome(rollObj),
    meta: rollObj.meta || {},
    update,
  });
  return rollObj;
}

export function describeOutcome(r) {
  if (r.meta?.crit) return r.meta.result;
  if (r.sixes === 0) return "Failure";
  const stunts = r.sixes - 1;
  return stunts > 0 ? `Success with ${stunts} stunt${stunts === 1 ? "" : "s"}` : "Success";
}
