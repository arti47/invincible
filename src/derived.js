// derived.js — all derived calculations, condition/crit penalties, normalisation & migration.
// Every formula here is cited to the rules; no rules numbers are invented in this module.

import { ceilHalf, clamp, SCHEMA_VERSION, deepClone } from "./core.js";
import * as R from "./rules.js";
import { D } from "./rules.js";

export const ATTR_KEYS = D.ATTRIBUTES.map((a) => a.key);

export function blankAttributes() {
  return ATTR_KEYS.reduce((o, k) => { o[k] = 2; return o; }, {});
}

/* ---------------------------------------------------------------- talent stat bonuses */

function talentStatBonus(character, stat) {
  let total = 0;
  for (const t of character.talents || []) {
    const def = R.findTalent(t.name);
    if (!def || !def.effect || def.effect.type !== "statBonus" || def.effect.stat !== stat) continue;
    const maxRanks = def.maxRanks || 1;
    total += def.effect.value * clamp(t.rank || 1, 1, maxRanks);
  }
  for (const d of character.drawbacks || []) {
    const def = R.findDrawback(d.name);
    if (def && def.effect && def.effect.type === "statBonus" && def.effect.stat === stat) {
      total += def.effect.value * (d.rank || 1);
    }
  }
  return total;
}

/* ---------------------------------------------------------------- core formulas (Ch.2) */

export function maxHealth(character) {
  const a = effectiveAttributes(character);
  return Math.max(1, ceilHalf(a.fighting + a.agility + a.strength) + talentStatBonus(character, "maxHealth"));
}

export function maxResolve(character) {
  const a = effectiveAttributes(character);
  return Math.max(1, ceilHalf(a.reason + a.intuition + a.presence) + talentStatBonus(character, "maxResolve"));
}

/**
 * Slugfest Damage = ceil(STRENGTH / 2), plus the single highest of STRIKE / EMANATION /
 * SIZE ALTERATION — those three never combine (audit A7).
 */
export function slugfestDamage(character) {
  const a = effectiveAttributes(character);
  const base = ceilHalf(a.strength);
  let bonus = 0;
  for (const entry of character.powers || []) {
    const power = R.findPower(entry.name);
    if (!power) continue;
    if (power.name === "STRIKE") {
      const v = R.powerValue(power, "slugfestBonus", entry.level || 0) || 0;
      bonus = Math.max(bonus, v);
    } else if (power.name === "EMANATION") {
      const potent = (entry.boosts || []).some((b) => /potent/i.test(b));
      bonus = Math.max(bonus, potent ? 3 : 2);
    }
    // SIZE ALTERATION changes STRENGTH itself while active; it is applied in effectiveAttributes.
  }
  return base + bonus;
}

export function reputation(character) {
  const rank = R.findRank(character.identity?.rank);
  const base = character.identity?.reputationBase ?? rank.reputation;
  return Math.max(0, base + talentStatBonus(character, "reputation") + (character.state?.reputationGained || 0));
}

export function resources(character) {
  const occ = R.findOccupation(character.identity?.occupation);
  const base = character.identity?.resourcesBase ?? (occ ? occ.resources : 3);
  return clamp(base + talentStatBonus(character, "resources"), 1, 8);
}

export function liftLimit(character) {
  const a = effectiveAttributes(character);
  return D.LIFT_TABLE[clamp(a.strength, 1, 12)];
}

/** Armor from powers and worn gear. Only one armor applies at a time — take the best. */
export function armorRating(character) {
  let best = 0;
  const sources = [];
  for (const entry of character.powers || []) {
    const power = R.findPower(entry.name);
    if (!power) continue;
    const v = R.powerValue(power, "armor", entry.level || 0);
    if (v) { sources.push({ name: R.powerDisplayName(entry), value: v }); best = Math.max(best, v); }
  }
  for (const item of character.inventory?.items || []) {
    if (item.equipped && item.armor) { sources.push({ name: item.name, value: item.armor }); best = Math.max(best, item.armor); }
  }
  return { value: best, sources };
}

/* ---------------------------------------------------------------- alternate forms */

const HALVE = (n) => Math.ceil(n / 2);

/** Attributes after any active alternate-form / super-suit / item-dependent reduction. */
export function effectiveAttributes(character) {
  const base = { ...blankAttributes(), ...(character.attributes || {}) };
  const alt = character.state?.altForm;
  if (!alt || !alt.active) return base;
  if (character.altAttributes) return { ...base, ...character.altAttributes };
  const out = { ...base };
  if (alt.mode === "physical") {
    for (const k of ["fighting", "agility", "strength"]) out[k] = HALVE(out[k]);
  } else {
    const order = ATTR_KEYS.slice().sort((a, b) => out[b] - out[a]).slice(0, 3);
    for (const k of order) out[k] = HALVE(out[k]);
  }
  return out;
}

export function altFormSources(character) {
  const out = [];
  for (const d of character.drawbacks || []) {
    const def = R.findDrawback(d.name);
    if (def?.effect?.type === "altForm") out.push({ name: def.name, mode: def.effect.halve === "physical" ? "physical" : "highestThree" });
  }
  for (const p of character.powers || []) {
    if (R.findPower(p.name)?.name === "SIGNATURE ITEM" && (p.limits || []).some((l) => /item dependent/i.test(l))) {
      out.push({ name: "Item Dependent", mode: "highestThree" });
    }
  }
  return out;
}

/* ---------------------------------------------------------------- penalties */

/**
 * Critical injury penalties. Penalties to the same attributes never stack —
 * only the worst applies (audit A10).
 */
export function critPenalty(character) {
  const out = ATTR_KEYS.reduce((o, k) => { o[k] = 0; return o; }, {});
  let movementFullAction = false;
  for (const crit of character.state?.crits || []) {
    if (crit.healed) continue;
    const entry = D.CRITICAL_INJURIES.find((c) => c.roll === crit.roll) || null;
    if (!entry) continue;
    if (entry.movementFullAction) movementFullAction = true;
    if (!entry.penalty) continue;
    for (const attr of entry.penalty.attrs) out[attr] = Math.min(out[attr], entry.penalty.dice);
  }
  return { dice: out, movementFullAction };
}

/** Active condition penalties (auto-applied — audit A20). */
export function conditionPenalty(character) {
  const out = ATTR_KEYS.reduce((o, k) => { o[k] = 0; return o; }, {});
  let notes = [];
  const conds = character.state?.conditions || {};
  for (const [key, on] of Object.entries(conds)) {
    if (!on) continue;
    const def = R.findCondition(key);
    if (!def) continue;
    if (def.effect?.allAttributes) {
      const v = key === "afflicted" && conds.afflictedPotent ? -4 : def.effect.allAttributes;
      for (const k of ATTR_KEYS) out[k] += v;
      notes.push(`${def.name} ${v} dice to all rolls`);
    }
    if (def.effect?.attackDice) notes.push(`${def.name} ${def.effect.attackDice} dice to attacks in the zone`);
    if (def.effect?.shootingDice) notes.push(`${def.name} ${def.effect.shootingDice} dice to shooting`);
  }
  return { dice: out, notes };
}

/** Total dice modifier for an attribute, from crits + conditions. */
export function attributeModifier(character, attr) {
  const c = critPenalty(character).dice[attr] || 0;
  const s = conditionPenalty(character).dice[attr] || 0;
  return c + s;
}

/** Effective dice pool for an attribute before situational modifiers. Never below 1 (audit A1). */
export function attributePool(character, attr) {
  const base = effectiveAttributes(character)[attr] || 1;
  return Math.max(1, base + attributeModifier(character, attr));
}

/* ---------------------------------------------------------------- push legality (audit A3) */

export function canPush(character, { passive = false, defending = false, alreadyPushed = 0, attr } = {}) {
  const resolve = character.state?.resolve ?? 0;
  if (passive) return { ok: false, reason: "Passive rolls cannot be pushed." };
  if (defending) return { ok: false, reason: "The defender in an opposed roll cannot push." };
  if (resolve <= 0) return { ok: false, reason: "You are stressed out — recover at least 1 Resolve before pushing." };
  const doublePush = (character.talents || []).some((t) => {
    const def = R.findTalent(t.name);
    return def?.effect?.type === "doublePush" && def.effect.attr === attr;
  });
  const limit = doublePush ? 2 : 1;
  if (alreadyPushed >= limit) {
    return { ok: false, reason: doublePush ? "You have already pushed this roll twice." : "You can only push a roll once." };
  }
  // Overconfident: cannot push above half total Health (rounded up).
  const over = (character.drawbacks || []).find((d) => R.findDrawback(d.name)?.effect?.type === "pushGate");
  if (over) {
    const half = Math.ceil(maxHealth(character) / 2);
    if ((character.state?.health ?? 0) > half) {
      return { ok: false, reason: "Overconfident: you cannot push while more than half your Health remains." };
    }
  }
  return { ok: true, second: alreadyPushed === 1 };
}

/* ---------------------------------------------------------------- creation budget */

/**
 * Crisis Mode build allowance (Ch.9): a solo hero starts with two extra attribute points and one
 * extra free talent. Read from the character's own `identity.solo` flag, set at creation, so a
 * hero built for solo play keeps its allowance whether or not the toggle is on later.
 */
export function soloAllowance(character) {
  return character?.identity?.solo
    ? { attributePoints: D.SOLO_BUILD.extraAttributePoints, freeTalents: D.SOLO_BUILD.extraFreeTalents }
    : { attributePoints: 0, freeTalents: 0 };
}

export function creationBudget(character) {
  const rank = R.findRank(character.identity?.rank);
  const solo = soloAllowance(character);
  const attrs = character.attributes || blankAttributes();
  const spent = ATTR_KEYS.reduce((n, k) => n + (attrs[k] || 0), 0);

  const powerSlots = (character.powers || []).reduce((n, p) => n + 1 + (p.boosts?.length || 0) + (p.level || 0) - (p.limits?.length || 0), 0);
  const drawbacks = (character.drawbacks || []).length;
  const extraSources = Math.max(0, (character.identity?.powerSources || []).length - 1);
  const extraTalents = Math.max(0, (character.talents || []).length - D.CREATION_TRADES.freeTalents - solo.freeTalents);

  const powerDelta = powerSlots - rank.powers;                    // + = bought powers, - = sold powers
  const available = rank.points
    + solo.attributePoints
    + drawbacks * D.CREATION_TRADES.attributePointPerDrawback
    - Math.max(0, powerDelta) * D.CREATION_TRADES.attributePointsPerExtraPower
    + Math.max(0, -powerDelta) * D.CREATION_TRADES.attributePointsPerSacrificedPower
    - extraSources * D.CREATION_TRADES.attributePointPerExtraPowerSource
    - extraTalents * D.CREATION_TRADES.attributePointPerExtraTalent;

  return { rank, spent, available, remaining: available - spent, powerSlots, powerDelta, drawbacks, extraSources, extraTalents, solo };
}

/** Full creation legality (audit A16, A17). */
export function validateCharacter(character) {
  const errors = [];
  const warnings = [];
  if (character.identity?.pregen) return { errors, warnings, ok: true };

  const b = creationBudget(character);
  const rank = b.rank;
  const attrs = character.attributes || {};

  if (b.remaining > 0) warnings.push(`${b.remaining} attribute point${b.remaining === 1 ? "" : "s"} still unspent.`);
  if (b.remaining < 0) errors.push(`You have spent ${-b.remaining} attribute point(s) more than your budget.`);

  for (const k of ATTR_KEYS) {
    const v = attrs[k] || 0;
    if (v < 1) errors.push(`${k.toUpperCase()} must be at least 1.`);
    if (v > rank.attrMax) errors.push(`${k.toUpperCase()} ${v} exceeds the ${rank.name} maximum of ${rank.attrMax}.`);
  }

  const powers = character.powers || [];
  if (powers.length < D.CREATION_TRADES.minimumPowers) errors.push("You must have at least one power.");
  for (const p of powers) {
    const def = R.findPower(p.name);
    if (!def) { warnings.push(`Unknown power "${p.name}" — kept as written.`); continue; }
    const level = p.level || 0;
    if (level >= 2 && rank.key !== "cosmic") errors.push(`${R.powerDisplayName(p)}: Massive powers are only available at Cosmic Champion rank.`);
    if (level >= 3) errors.push(`${R.powerDisplayName(p)}: no player character can start the game with Monstrous powers.`);
    if (def.levels && level >= def.levels.length) errors.push(`${def.name} has no ${D.POWER_LEVELS[level]} level.`);
    for (const b2 of p.boosts || []) {
      if (!(def.boosts || []).some((x) => x.name.toLowerCase() === String(b2).toLowerCase())) {
        warnings.push(`${def.name}: "${b2}" is not a listed boost.`);
      }
    }
    for (const l of p.limits || []) {
      if (!(def.limits || []).some((x) => x.name.toLowerCase() === String(l).toLowerCase())) {
        warnings.push(`${def.name}: "${l}" is not a listed limit.`);
      }
    }
  }

  if ((character.drawbacks || []).length > D.CREATION_TRADES.maxDrawbacks) {
    errors.push(`You cannot start the game with more than ${D.CREATION_TRADES.maxDrawbacks} drawbacks.`);
  }

  for (const t of character.talents || []) {
    const def = R.findTalent(t.name);
    if (!def) { warnings.push(`Unknown talent "${t.name}".`); continue; }
    const ranks = (character.talents || []).filter((x) => R.findTalent(x.name)?.name === def.name).length;
    const max = def.maxRanks || 1;
    if (ranks > max) errors.push(`${def.name} can only be taken ${max} time(s).`);
  }

  if (!character.identity?.heroName) warnings.push("Your hero has no hero name yet.");
  if (!(character.identity?.powerSources || []).length) warnings.push("No power source chosen.");

  return { errors, warnings, ok: errors.length === 0 };
}

/* ---------------------------------------------------------------- normalisation */

export function blankCharacter(overrides = {}) {
  const now = Date.now();
  return {
    id: overrides.id || `char_${now.toString(36)}`,
    schemaVersion: SCHEMA_VERSION,
    owner: null,
    campaignId: null,
    identity: {
      realName: "", heroName: "", rank: "global", role: "", archetype: "", occupation: "",
      powerSources: [], personality: [], drive: "", flaw: "", appearance: "",
      keyRelationships: [], identitySecret: true, portraitUrl: "", pregen: false, solo: false,
    },
    attributes: blankAttributes(),
    talents: [],
    powers: [],
    drawbacks: [],
    inventory: { items: [] },
    state: {
      health: 1, resolve: 1, karma: 0, reputationGained: 0,
      conditions: {}, crits: [], broken: false,
      dying: { active: false, deadline: null, stabiliseAttempted: false },
      scene: { wreckedZones: [], usedOncePerScene: [], energyDice: 0, barriers: [] },
      session: { karmaAnswers: {}, badKarmaAnswers: {}, flawState: "active", flawlessSessions: 0, spendUnlocked: false, wreckedZones: [], stage: "idle" },
      altForm: { active: false, mode: "highestThree", source: null },
      restFlags: {}, indomitableUsed: false,
    },
    notes: "",
    advancementLog: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Back-fill defaults on any stored character so old saves never crash. */
export function normalizeCharacter(raw) {
  if (!raw || typeof raw !== "object") return blankCharacter();
  const base = blankCharacter({ id: raw.id });
  const c = deepClone(raw);
  c.schemaVersion = SCHEMA_VERSION;
  c.identity = { ...base.identity, ...(c.identity || {}) };
  c.attributes = { ...base.attributes, ...(c.attributes || {}) };
  c.state = { ...base.state, ...(c.state || {}) };
  c.state.conditions = c.state.conditions || {};
  c.state.crits = c.state.crits || [];
  c.state.dying = { ...base.state.dying, ...(c.state.dying || {}) };
  c.state.scene = { ...base.state.scene, ...(c.state.scene || {}) };
  c.state.session = { ...base.state.session, ...(c.state.session || {}) };
  c.state.altForm = { ...base.state.altForm, ...(c.state.altForm || {}) };
  c.state.restFlags = c.state.restFlags || {};
  c.talents = (c.talents || []).map((t) => (typeof t === "string" ? { name: t, rank: 1 } : { rank: 1, ...t }));
  c.powers = (c.powers || []).map((p) => (typeof p === "string"
    ? { ...R.parsePowerRef(p), boosts: [], limits: [] }
    : { level: 0, boosts: [], limits: [], ...p }));
  c.drawbacks = (c.drawbacks || []).map((d) => (typeof d === "string" ? { name: d, detail: "" } : d));
  c.inventory = { items: [], ...(c.inventory || {}) };
  c.inventory.items = (c.inventory.items || []).map((i) => ({ qty: 1, equipped: false, ...i }));
  c.advancementLog = c.advancementLog || [];
  c.notes = c.notes || "";

  // Clamp vitals to the current maxima.
  const mh = maxHealth(c), mr = maxResolve(c);
  c.state.health = clamp(Number(c.state.health ?? mh), 0, mh);
  c.state.resolve = clamp(Number(c.state.resolve ?? mr), 0, mr);
  c.state.karma = Math.max(0, Number(c.state.karma) || 0);
  c.state.broken = c.state.health <= 0;
  return c;
}

/** Everything the sheet header shows. */
export function summary(character) {
  const a = effectiveAttributes(character);
  return {
    attributes: a,
    maxHealth: maxHealth(character),
    maxResolve: maxResolve(character),
    slugfest: slugfestDamage(character),
    reputation: reputation(character),
    resources: resources(character),
    armor: armorRating(character),
    lift: liftLimit(character),
    crit: critPenalty(character),
    conditions: conditionPenalty(character),
    altForms: altFormSources(character),
  };
}
