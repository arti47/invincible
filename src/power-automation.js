// power-automation.js — "tap to use" resolution for powers and mechanically-loaded talents.
// Deducts stress, rolls the right attribute, and reports the printed effect for the chosen level.

import { el, clamp } from "./core.js";
import { modal, showToast, announce, chooseModal } from "./ui.js";
import * as R from "./rules.js";
import { D } from "./rules.js";
import * as Derived from "./derived.js";
import * as Roller from "./roller.js";
import { updateCharacter } from "./store.js";
import { Settings } from "./settings.js";

/** Everything the engine knows how to do with a power entry at its current level. */
export function powerActions(character, entry) {
  const def = R.findPower(entry.name);
  if (!def) return [];
  const level = entry.level || 0;
  const actions = [];
  const boosts = (entry.boosts || []).map((b) => String(b).toLowerCase());

  const damage = R.powerValue(def, "damage", level);
  if (damage !== undefined && def.attack) {
    actions.push({
      key: "attack", label: `${def.attack === "slugfest" ? "Slugfest" : "Shooting"} attack (Damage ${damage})`,
      attr: def.attack === "slugfest" ? "fighting" : "agility",
      kind: def.attack, damage, range: R.powerValue(def, "range", level),
    });
  } else if (damage !== undefined) {
    actions.push({ key: "attack", label: `Shooting attack (Damage ${damage})`, attr: "agility", kind: "shooting", damage, range: R.powerValue(def, "range", level) });
  }
  if (def.roll && damage === undefined) {
    actions.push({ key: "roll", label: `Roll ${(def.rollAttr || R.powerAttribute(def)).toUpperCase()}`, attr: def.rollAttr || R.powerAttribute(def) });
  }
  const armor = R.powerValue(def, "armor", level) ?? R.powerValue(def, "barrierArmor", level);
  if (armor !== undefined) actions.push({ key: "armor", label: `Apply Armor ${armor}`, armor });
  const move = R.powerValue(def, "move", level);
  if (move) actions.push({ key: "move", label: `Move ${move[0]} zones (${move[1]} for 1 stress)`, move });
  const heal = def.healPerSix;
  if (heal) actions.push({ key: "heal", label: `Heal ${heal} Health per 6 (PRESENCE)`, attr: "presence", healPerSix: heal });
  if (def.copyBonus) actions.push({ key: "duplicate", label: `Create duplicates (copy bonus +${R.powerValue(def, "copyBonus", level)})`, cost: 1 });
  if (def.name === "QUICKNESS") actions.push({ key: "quickness", label: "Take 1 stress for an extra action", cost: 1 });
  if (!actions.length) actions.push({ key: "describe", label: "Use as printed (no roll needed)" });

  for (const b of def.boosts || []) {
    if (boosts.includes(b.name.toLowerCase())) actions.push({ key: `boost:${b.name}`, label: `Boost: ${b.name}`, boost: b });
  }
  return actions;
}

function levelText(def, level) {
  if (!def.levels) return def.summary;
  return `${def.summary}\n\n${D.POWER_LEVELS[level]}: ${def.levels[Math.min(level, def.levels.length - 1)]}`;
}

/** Open the resolution sheet for a power. Always returns a non-empty dialog (regression check). */
export async function usePower(character, entry, { onResolved } = {}) {
  const def = R.findPower(entry.name);
  if (!def) { showToast(`No rules entry for "${entry.name}".`, { variant: "warn" }); return null; }
  const level = entry.level || 0;
  const actions = powerActions(character, entry);

  const body = el("div", { class: "power-sheet" },
    el("p", { class: "muted", text: `${def.type} power · ${D.POWER_TYPES[def.type].note}` }),
    el("p", { text: levelText(def, level) }),
    (entry.boosts || []).length ? el("p", { class: "chiprow" }, ...(entry.boosts || []).map((b) => el("span", { class: "chip", text: `Boost: ${b}` }))) : null,
    (entry.limits || []).length ? el("p", { class: "chiprow" }, ...(entry.limits || []).map((l) => el("span", { class: "chip warn", text: `Limit: ${l}` }))) : null,
    el("div", { class: "action-list" }),
    el("p", { class: "cite" },
      el("a", { href: "#/rules/powers", class: "rules-link" }, "Rules: Using powers")));

  const list = body.querySelector(".action-list");
  const m = modal({ title: R.powerDisplayName({ name: def.name, level }), body, actions: [{ label: "Close", variant: "ghost" }] });

  for (const a of actions) {
    list.append(el("button", { class: "choice", onclick: async () => {
      const result = await resolveAction(character, entry, def, a);
      if (result) { m.close(); if (onResolved) onResolved(result); }
    } }, el("span", { class: "choice-label", text: a.label })));
  }
  return m.promise;
}

async function resolveAction(character, entry, def, action) {
  const level = entry.level || 0;

  if (action.key === "describe") {
    showToast(`${def.name}: used as printed — no roll needed.`);
    return { kind: "describe" };
  }

  if (action.key === "armor") {
    updateCharacter((c) => {
      c.state.scene.barriers = c.state.scene.barriers || [];
      c.state.scene.barriers.push({ name: def.name, armor: action.armor, at: Date.now() });
    }, { id: character.id });
    showToast(`${def.name}: Armor ${action.armor} active until it is breached or the scene ends.`);
    return { kind: "armor", armor: action.armor };
  }

  if (action.key === "move") {
    const far = await chooseModal("How far?", [
      { label: `${action.move[0]} zones (free)`, value: 0 },
      { label: `${action.move[1]} zones (1 stress)`, value: 1 },
    ]);
    if (far === null) return null;
    if (far) spendStress(character, 1, `${def.name} — extended move`);
    showToast(`${def.name}: moved ${far ? action.move[1] : action.move[0]} zones.`);
    return { kind: "move", stress: far };
  }

  if (action.key === "quickness" || action.key === "duplicate") {
    spendStress(character, action.cost || 1, def.name);
    showToast(`${def.name}: ${action.label}.`);
    return { kind: action.key, stress: action.cost || 1 };
  }

  if (action.boost) {
    showToast(`${def.name} — ${action.boost.name}: ${action.boost.desc}`, { timeout: 6000 });
    return { kind: "boost", boost: action.boost };
  }

  // Rolled actions.
  const manual = Settings.manualDice() ? await askManualFaces() : null;
  if (action.kind) {
    const r = Roller.makeAttack(character, action.kind, {
      power: def.name, powerLevel: level, manualFaces: manual,
      targetName: null, meta: { power: def.name },
    });
    announce(`${def.name}: ${r.sixes} successes.`);
    showRollResult(character, r, { damage: action.damage, power: def });
    return { kind: "attack", roll: r };
  }

  const attr = action.attr || R.powerAttribute(def);
  const r = Roller.roll(character, attr, `${def.name}`, { manualFaces: manual, meta: { power: def.name } });
  announce(`${def.name}: ${r.sixes} successes.`);
  if (action.healPerSix && r.sixes > 0) {
    const healed = r.sixes * action.healPerSix;
    updateCharacter((c) => {
      c.state.health = clamp(c.state.health + healed, 0, Derived.maxHealth(c));
      c.state.broken = c.state.health <= 0;
    }, { id: character.id });
    showToast(`${def.name}: healed ${healed} Health.`);
  }
  showRollResult(character, r, { power: def });
  return { kind: "roll", roll: r };
}

export function spendStress(character, amount, reason) {
  updateCharacter((c) => {
    c.state.resolve = clamp(c.state.resolve - amount, 0, Derived.maxResolve(c));
  }, { id: character.id });
  if (reason) announce(`${amount} stress taken: ${reason}.`);
}

export async function askManualFaces() {
  const input = el("input", { class: "input", type: "text", placeholder: "e.g. 6 3 1 5 6", inputmode: "numeric" });
  const m = modal({
    title: "Enter the faces you rolled",
    body: el("div", {}, el("p", { text: "Type each die face, separated by spaces." }), input),
    actions: [{ label: "Roll digitally instead", value: null, variant: "ghost" }, { label: "Use these", variant: "primary", onClick: () => input.value }],
  });
  const raw = await m.promise;
  if (!raw) return null;
  const faces = String(raw).split(/[^1-6]+/).filter(Boolean).map(Number);
  return faces.length ? faces : null;
}

/** Shared result panel used by the roller, sheet and combat screens. */
export function showRollResult(character, r, { damage = null, power = null, onPushed } = {}) {
  const diceRow = el("div", { class: "dice-row", "aria-label": `Dice: ${r.dice.join(", ")}` },
    ...r.dice.map((v) => el("span", { class: `die ${v === 6 ? "six" : v === 1 ? "one" : ""}`, text: String(v) })));
  const outcome = Roller.describeOutcome(r);
  const body = el("div", { class: "roll-result" },
    el("p", { class: "roll-pool", text: `${r.label} — pool ${r.pool}${r.mods.length ? ` (${r.mods.map((m) => `${m.label} ${m.value > 0 ? "+" : ""}${m.value}`).join(", ")})` : ""}` }),
    diceRow,
    el("p", { class: `outcome ${r.sixes ? "good" : "bad"}`, text: outcome }),
    damage !== null ? el("p", { text: `Damage on a hit: ${damage} (reduced by the target's Armor).` }) : null,
    r.sixes > 1 ? el("p", { class: "muted", text: `${r.sixes - 1} stunt${r.sixes - 1 === 1 ? "" : "s"} available.` }) : null,
    power ? el("p", { class: "cite" }, el("a", { href: "#/rules/powers", class: "rules-link" }, "Rules: Using powers")) : null);

  const pushCheck = Roller.canPush(character, r);
  const actions = [{ label: "Done", variant: "primary" }];
  if (pushCheck.ok) {
    actions.unshift({
      label: "Push the roll", variant: "warn", keepOpen: true,
      onClick: async (close) => {
        const manual = Settings.manualDice() ? await askManualFaces() : null;
        const res = Roller.pushRoll(character, r, manual);
        if (!res.ok) { showToast(res.reason, { variant: "warn" }); return; }
        if (res.stress) {
          const indomitable = R.hasTalent(character, "Indomitable") && !character.state.indomitableUsed;
          if (indomitable) {
            const use = await confirmIndomitable(res.stress);
            if (use) {
              updateCharacter((c) => { c.state.indomitableUsed = true; }, { id: character.id });
              showToast("Indomitable: all 1s ignored for this push.");
            } else spendStress(character, res.stress, "pushing the roll");
          } else spendStress(character, res.stress, "pushing the roll");
        }
        close();
        showRollResult(character, r, { damage, power, onPushed });
        if (onPushed) onPushed(r);
      },
    });
  } else if (pushCheck.reason) {
    body.append(el("p", { class: "muted", text: pushCheck.reason }));
  }
  announce(`${r.label}: ${outcome}.`);
  return modal({ title: "Roll result", body, actions });
}

async function confirmIndomitable(stress) {
  const m = modal({
    title: "Indomitable",
    body: el("p", { text: `This push would cost ${stress} stress. Indomitable lets you ignore every 1 once per session. Use it now?` }),
    actions: [{ label: `Take ${stress} stress`, value: false, variant: "ghost" }, { label: "Use Indomitable", value: true, variant: "primary" }],
  });
  return m.promise;
}

/** Talents that do something mechanical when tapped. */
export function talentActions(character, talentName) {
  const def = R.findTalent(talentName);
  if (!def) return [];
  const t = def.effect?.type;
  const out = [];
  if (t === "roll") out.push({ label: `Roll ${def.effect.attr.toUpperCase()}`, attr: def.effect.attr });
  if (def.name === "Leader") out.push({ label: "Rousing speech (1 stress, PRESENCE)", attr: "presence", cost: 1, group: true });
  if (def.name === "Inspiration") out.push({ label: "Transfer up to 5 stress to an ally's Resolve", transfer: true });
  if (def.name === "Loner") out.push({ label: "Recover Resolve without a social scene", loner: true });
  if (def.name === "Menacing") out.push({ label: "Intimidate with STRENGTH +2", attr: "strength", bonus: 2 });
  if (def.name === "Analysis" || def.name === "Investigator" || def.name === "Unconventional Wisdom") {
    // already covered by the roll action above
  }
  return out;
}

export async function useTalent(character, talentName) {
  const def = R.findTalent(talentName);
  if (!def) return null;
  const actions = talentActions(character, talentName);
  const body = el("div", {}, el("p", { text: def.desc }), el("div", { class: "action-list" }));
  const list = body.querySelector(".action-list");
  const m = modal({ title: def.name, body, actions: [{ label: "Close", variant: "ghost" }] });
  if (!actions.length) {
    list.append(el("p", { class: "muted", text: "This talent applies automatically — the dice engine already includes it where it matters." }));
  }
  for (const a of actions) {
    list.append(el("button", { class: "choice", onclick: async () => {
      m.close();
      if (a.transfer) {
        const amount = Number(await promptNumber("How much stress do you take to restore an ally's Resolve? (max 5)", 1)) || 0;
        if (amount > 0) { spendStress(character, Math.min(5, amount), "Inspiration"); showToast(`Ally restores ${Math.min(5, amount)} Resolve.`); }
        return;
      }
      if (a.loner) {
        updateCharacter((c) => {
          c.state.resolve = clamp(c.state.resolve + Derived.effectiveAttributes(c).presence, 0, Derived.maxResolve(c));
        }, { id: character.id });
        showToast("Loner: Resolve restored equal to your PRESENCE rating.");
        return;
      }
      if (a.cost) spendStress(character, a.cost, def.name);
      const manual = Settings.manualDice() ? await askManualFaces() : null;
      const r = Roller.roll(character, a.attr, def.name, { manualFaces: manual, situational: a.bonus ? [{ label: def.name, value: a.bonus }] : [] });
      showRollResult(character, r);
    } }, el("span", { class: "choice-label", text: a.label })));
  }
  return m.promise;
}

async function promptNumber(message, value = 1) {
  const input = el("input", { class: "input", type: "number", min: "0", max: "5", value: String(value) });
  const m = modal({ title: "How much?", body: el("div", {}, el("p", { text: message }), input),
    actions: [{ label: "Cancel", value: null, variant: "ghost" }, { label: "OK", variant: "primary", onClick: () => input.value }] });
  return m.promise;
}
