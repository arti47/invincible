// sheet.js — the live character sheet, persistent resource header and all in-play tracking.

import { el, clear, clamp, uid } from "./core.js";
import { modal, showToast, confirmModal, promptModal, chooseModal, announce, helpPanel } from "./ui.js";
import * as R from "./rules.js";
import { D } from "./rules.js";
import * as Derived from "./derived.js";
import * as Store from "./store.js";
import * as Roller from "./roller.js";
import { usePower, useTalent, showRollResult, askManualFaces, spendStress } from "./power-automation.js";
import { Settings } from "./settings.js";
import * as Journal from "./journal.js";
import { stageCard } from "./combat.js";

/* ---------------------------------------------------------------- persistent header */

export function renderResourceHeader(mount) {
  const c = Store.activeCharacter();
  clear(mount);
  if (!c) { mount.hidden = true; return; }
  mount.hidden = false;
  const s = Derived.summary(c);
  const pill = (label, value, max, kind) => el("button", {
    class: `res-pill ${kind}`, "aria-label": `${label} ${value} of ${max}`,
    onclick: () => openVitalEditor(kind),
  }, el("span", { class: "res-label", text: label }), el("span", { class: "res-value", "aria-live": "polite", text: `${value}/${max}` }));

  mount.append(
    el("div", { class: "res-bar" },
      pill("Health", c.state.health, s.maxHealth, "health"),
      pill("Resolve", c.state.resolve, s.maxResolve, "resolve"),
      el("span", { class: "res-pill flat", title: "Karma" }, el("span", { class: "res-label", text: "Karma" }), el("span", { class: "res-value", text: String(c.state.karma) })),
      el("span", { class: "res-pill flat", title: "Reputation" }, el("span", { class: "res-label", text: "Rep" }), el("span", { class: "res-value", text: String(s.reputation) })),
      el("span", { class: "res-pill flat", title: "Resources" }, el("span", { class: "res-label", text: "Res" }), el("span", { class: "res-value", text: String(s.resources) })),
      s.armor.value ? el("span", { class: "res-pill flat", title: s.armor.sources.map((x) => x.name).join(", ") }, el("span", { class: "res-label", text: "Armor" }), el("span", { class: "res-value", text: String(s.armor.value) })) : null,
      c.state.broken ? el("span", { class: "res-pill danger", text: "BROKEN" }) : null,
      c.state.resolve === 0 ? el("span", { class: "res-pill warn", text: "STRESSED OUT" }) : null,
      c.state.dying?.active ? el("span", { class: "res-pill danger blink", text: "DYING" }) : null,
      // Jot without leaving whatever screen you are on.
      el("button", { class: "res-pill", "aria-label": "Write a journal entry", title: "Write a journal entry",
        onclick: () => quickJournal(c) }, el("span", { class: "res-label", text: "Journal" }), el("span", { class: "res-value", text: "✎" }))));
}

/** Write straight into the journal from anywhere in the app. */
async function quickJournal(c) {
  const text = await promptModal("What happened? Write it however you like.",
    { title: "Journal entry", multiline: true });
  if (text && text.trim()) {
    Journal.addNote(text.trim(), c?.id || null);
    showToast("Written to the journal.", { variant: "good" });
  }
}

function openVitalEditor(kind) {
  const c = Store.activeCharacter();
  if (!c) return;
  const max = kind === "health" ? Derived.maxHealth(c) : Derived.maxResolve(c);
  const value = c.state[kind];
  const input = el("input", { class: "input", type: "number", min: "0", max: String(max), value: String(value) });
  const body = el("div", {},
    el("p", { text: `${kind === "health" ? "Health" : "Resolve"}: ${value} of ${max}.` }),
    input,
    el("div", { class: "chiprow" },
      ...[-3, -2, -1, 1, 2, 3].map((delta) => el("button", { class: "chip", onclick: () => { input.value = String(clamp(Number(input.value) + delta, 0, max)); } }, delta > 0 ? `+${delta}` : String(delta)))),
    kind === "resolve" ? el("p", { class: "muted small", text: "At 0 Resolve you are stressed out: you act normally but cannot push rolls or take stress for power effects." })
      : el("p", { class: "muted small", text: "At 0 Health you are broken and roll a critical injury." }));
  const m = modal({
    title: kind === "health" ? "Health" : "Resolve", body,
    actions: [{ label: "Cancel", value: null, variant: "ghost" },
      { label: "Apply", variant: "primary", onClick: () => Number(input.value) }],
  });
  m.promise.then((v) => {
    if (v === null || v === undefined || Number.isNaN(v)) return;
    const before = c.state[kind];
    if (kind === "health" && v < before) {
      applyDamageFlow(before - v);
      return;
    }
    Store.setVital(kind, v);
    announce(`${kind} ${v} of ${max}`);
  });
}

/** Damage entry routes through the engine so crits and the dying procedure fire correctly. */
export function applyDamageFlow(amount, { ignoreArmor = false, doubled = false } = {}) {
  const c = Store.activeCharacter();
  if (!c) return;
  let outcome = null;
  Store.updateCharacter((ch) => {
    outcome = Roller.applyDamage(ch, amount, { ignoreArmor, doubled });
  }, { id: c.id });
  if (!outcome) return;
  Journal.record({ kind: "state", characterId: c.id,
    text: outcome.crit
      ? `${outcome.damageTaken} damage — broken. Critical injury: ${outcome.crit.entry.name}`
      : `${outcome.damageTaken} damage taken${outcome.absorbed ? ` (${outcome.absorbed} absorbed)` : ""}` });
  if (outcome.crit) {
    const entry = outcome.crit.entry;
    showToast(`Broken! Critical injury: ${entry.name}`, { variant: "danger", timeout: 6000 });
    openCritDialog(outcome.crit);
  } else {
    showToast(`${outcome.damageTaken} damage taken${outcome.absorbed ? ` (${outcome.absorbed} absorbed by armor)` : ""}.`);
  }
  announce(`Damage applied: ${outcome.damageTaken}.`);
}

function openCritDialog(crit) {
  const entry = crit.entry;
  const body = el("div", {},
    el("p", { class: "crit-name", text: `${entry.roll}. ${entry.name}` }),
    el("p", { text: entry.desc }),
    el("p", { class: "muted", text: `Healing time: ${entry.healing}` }),
    entry.dying ? el("p", { class: "bad", text: `You die within ${entry.dying.toLowerCase()} unless someone stabilises you: advanced medical gear and a REASON roll — one attempt only.` }) : null,
    entry.noRally ? el("p", { class: "warn", text: "You cannot rally with this injury." }) : el("p", { class: "muted", text: "You may rally on your turn: a full action and a PRESENCE roll, regaining 1 Health per 6." }),
    el("p", { class: "cite" }, el("a", { href: "#/rules/crits", class: "rules-link" }, "Rules: Critical injuries")));
  modal({ title: "Critical injury", body, actions: [{ label: "OK", variant: "primary" }] });
}

/* ---------------------------------------------------------------- the sheet */

export function renderSheet(mount) {
  const c = Store.activeCharacter();
  clear(mount);
  if (!c) {
    mount.append(el("div", { class: "empty" },
      el("h2", { text: "No hero yet" }),
      el("p", { text: "Create a hero, or start from a published character." }),
      el("a", { class: "btn primary", href: "#/create" }, "Create a hero")));
    return;
  }
  const s = Derived.summary(c);

  mount.append(
    stageCard(),
    identityCard(c, s),
    vitalsCard(c, s),
    attributesCard(c, s),
    powersCard(c),
    talentsCard(c),
    drawbacksCard(c),
    conditionsCard(c),
    inventoryCard(c, s),
    notesCard(c),
    advancementCard(c));
}

function identityCard(c, s) {
  const rank = R.findRank(c.identity.rank);
  return el("section", { class: "card" },
    el("div", { class: "identity-head" },
      el("div", {},
        el("h2", { text: c.identity.heroName || "Unnamed hero" }),
        el("p", { class: "muted", text: [c.identity.realName, c.identity.role, rank?.name].filter(Boolean).join(" · ") })),
      c.identity.pregen ? el("span", { class: "chip warn", text: "Published stat block" }) : null),
    el("div", { class: "kv-grid" },
      kv("Archetype", c.identity.archetype || "—"),
      kv("Occupation", c.identity.occupation || "—"),
      kv("Power source", (c.identity.powerSources || []).join(", ") || "—"),
      kv("Drive", c.identity.drive || "—"),
      kv("Flaw", c.identity.flaw || "—"),
      kv("Personality", (c.identity.personality || []).join(", ") || "—"),
      kv("Lift limit", s.lift),
      kv("Identity", c.identity.identitySecret ? "Secret" : "Public")),
    (c.identity.keyRelationships || []).length
      ? el("div", { class: "relationships" }, el("h4", { text: "Key relationships" }),
        ...c.identity.keyRelationships.map((k, i) => el("p", {},
          el("strong", { text: k.name || "Unnamed" }), " — ", k.text,
          el("button", { class: "btn tiny ghost", onclick: async () => {
            const name = await promptModal("Who is this?", { title: "Key relationship", value: k.name || "" });
            if (name !== null) Store.updateCharacter((ch) => { ch.identity.keyRelationships[i].name = name; });
          } }, "Name"))))
      : null,
    // Only the scene-entry action belongs here. Karma is spent between sessions, so its control
    // sits in the advancement card at the foot of the sheet, where the sequence of play puts it.
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => rollReputation(c) }, "Reputation roll")));
}

/** End of the sheet, end of the session: karma is only spendable between sessions (§3.3). */
function advancementCard(c) {
  return el("section", { class: "card" },
    el("h3", { text: "Between sessions" }),
    el("p", { class: "muted small", text: `Karma ${c.state.karma}. Earned at the end of a session and spent only between sessions, in a safe location.` }),
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => openKarma(c) }, "Karma & advancement")));
}

const kv = (k, v) => el("div", { class: "kv" }, el("span", { class: "k", text: k }), el("span", { class: "v", text: String(v) }));

function vitalsCard(c, s) {
  const critList = (c.state.crits || []).filter((x) => !x.healed);
  return el("section", { class: "card" },
    el("h3", { text: "Vitals" }),
    helpPanel(["Health is physical punishment, Resolve is mental strain. At 0 Health you are broken and roll a critical injury; at 0 Resolve you are stressed out and cannot push rolls.", "Take damage routes through the dice engine so armor, critical injuries and the dying procedure fire correctly — prefer it over editing the number directly.", "Rest & recover applies the book's recovery table: Health returns after an action scene, Resolve in a social scene."]),
    el("div", { class: "vitals" },
      vitalStepper("Health", c.state.health, s.maxHealth, "health"),
      vitalStepper("Resolve", c.state.resolve, s.maxResolve, "resolve")),
    el("div", { class: "row-actions" },
      el("button", { class: "btn danger", onclick: () => promptDamage() }, "Take damage"),
      el("button", { class: "btn", onclick: () => promptStress() }, "Take stress"),
      c.state.broken ? el("button", { class: "btn primary", onclick: () => doRally(c) }, "Rally") : null,
      c.state.dying?.active ? el("button", { class: "btn danger", onclick: () => doStabilise(c) }, "Stabilise") : null,
      el("button", { class: "btn ghost", onclick: () => openRecovery(c) }, "Rest & recover")),
    critList.length ? el("div", { class: "crits" }, el("h4", { text: "Critical injuries" }),
      ...critList.map((x) => el("div", { class: "crit-row" },
        el("span", { text: `${x.name} — heals in ${x.healing}` }),
        el("button", { class: "btn tiny ghost", onclick: () => {
          Store.updateCharacter((ch) => { const t = ch.state.crits.find((y) => y.id === x.id); if (t) t.healed = true; });
          showToast(`${x.name} healed.`);
        } }, "Healed")))) : null,
    s.crit.movementFullAction ? el("p", { class: "warn small", text: "Ground movement is a full action while your leg is crushed." }) : null,
    s.altForms.length ? el("div", { class: "altform" },
      el("h4", { text: "Alternate form" }),
      ...s.altForms.map((f) => el("button", {
        class: `btn ${c.state.altForm?.active && c.state.altForm.source === f.name ? "warn" : "ghost"}`,
        onclick: () => toggleAltForm(f),
      }, c.state.altForm?.active && c.state.altForm.source === f.name ? `Revert from ${f.name}` : `Activate ${f.name}`))) : null);
}

function vitalStepper(label, value, max, kind) {
  return el("div", { class: `vital ${kind}` },
    el("span", { class: "vital-label", text: label }),
    el("div", { class: "stepper" },
      el("button", { class: "icon-btn", "aria-label": `Lose 1 ${label}`, onclick: () => {
        if (kind === "health") applyDamageFlow(1, { ignoreArmor: true });
        else Store.setVital(kind, value - 1);
      } }, "−"),
      el("button", { class: "vital-value", "aria-live": "polite", onclick: () => openVitalEditor(kind) }, `${value}/${max}`),
      el("button", { class: "icon-btn", "aria-label": `Regain 1 ${label}`, onclick: () => Store.setVital(kind, value + 1) }, "+")));
}

async function promptDamage() {
  const input = el("input", { class: "input", type: "number", min: "1", value: "1" });
  const ignore = el("input", { type: "checkbox" });
  const dbl = el("input", { type: "checkbox" });
  const m = modal({ title: "Take damage",
    body: el("div", {}, el("p", { text: "Armor is applied automatically." }), input,
      el("label", { class: "check" }, ignore, " Ignore armor (piercing / vulnerable)"),
      el("label", { class: "check" }, dbl, " Double damage stunt")),
    actions: [{ label: "Cancel", value: null, variant: "ghost" }, { label: "Apply", variant: "danger", onClick: () => Number(input.value) }] });
  const v = await m.promise;
  if (v) applyDamageFlow(v, { ignoreArmor: ignore.checked, doubled: dbl.checked });
}

async function promptStress() {
  const v = Number(await promptModal("How much stress?", { title: "Take stress", value: "1" }));
  if (v > 0) { const c = Store.activeCharacter(); spendStress(c, v, "manual"); showToast(`${v} stress taken.`); }
}

function doRally(c) {
  const check = Roller.canRally(c);
  if (!check.ok) { showToast(check.reason, { variant: "warn" }); return; }
  Store.updateCharacter((ch) => {
    const res = Roller.rally(ch);
    if (res.ok) setTimeout(() => showRollResult(ch, res.roll), 0);
  }, { id: c.id });
}

function doStabilise(c) {
  Store.updateCharacter((ch) => {
    const res = Roller.stabilise(ch, ch);
    if (!res.ok) { showToast(res.reason, { variant: "warn" }); return; }
    setTimeout(() => {
      showRollResult(ch, res.roll);
      showToast(res.success ? "Stabilised." : "The attempt failed — and only one attempt is allowed.", { variant: res.success ? "good" : "danger", timeout: 6000 });
    }, 0);
  }, { id: c.id });
}

function toggleAltForm(f) {
  Store.updateCharacter((ch) => {
    const active = ch.state.altForm?.active && ch.state.altForm.source === f.name;
    ch.state.altForm = { active: !active, mode: f.mode, source: f.name };
    if (!active) ch.state.resolve = Math.max(0, ch.state.resolve - 1); // transforming costs 1 stress
    const mh = Derived.maxHealth(ch), mr = Derived.maxResolve(ch);
    ch.state.health = Math.min(ch.state.health, mh);
    ch.state.resolve = Math.min(ch.state.resolve, mr);
  });
  showToast("Form changed (1 stress). Reduced scores apply while out of form.");
}

function attributesCard(c, s) {
  const grid = el("div", { class: "attr-grid" });
  for (const a of D.ATTRIBUTES) {
    const pool = Derived.attributePool(c, a.key);
    const mod = Derived.attributeModifier(c, a.key);
    grid.append(el("button", { class: "attr-card", onclick: () => rollAttribute(c, a.key) },
      el("span", { class: "attr-abbr", text: a.short }),
      el("span", { class: "attr-score", text: String(s.attributes[a.key]) }),
      el("span", { class: "attr-desc", text: D.SCORE_DESCRIPTIONS[s.attributes[a.key]] }),
      mod ? el("span", { class: "attr-mod warn", text: `${mod > 0 ? "+" : ""}${mod} → ${pool} dice` }) : el("span", { class: "attr-mod", text: `${pool} dice` })));
  }
  return el("section", { class: "card" },
    el("h3", { text: "Attributes" }),
    helpPanel(["Your six attributes are your dice pools. Tap one to roll it — pool size equals the score, and a single 6 succeeds.", "Critical injuries and active conditions are already subtracted from the number of dice shown; a pool never drops below 1.", "Attack opens the four attack types, each rolling the attribute the rules require."]),
    el("p", { class: "muted small", text: "Tap to roll. Critical injuries and conditions are applied automatically." }),
    grid,
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => openAttackDialog(c) }, "Attack"),
      el("button", { class: "btn ghost", onclick: () => openBanter(c) }, "Action banter")));
}

export async function rollAttribute(c, attr, opts = {}) {
  const manual = Settings.manualDice() ? await askManualFaces() : null;
  const r = Roller.roll(c, attr, `${attr.toUpperCase()} roll`, { ...opts, manualFaces: manual });
  showRollResult(c, r);
  return r;
}

async function openAttackDialog(c) {
  const kind = await chooseModal("What kind of attack?", [
    { label: "Slugfest (FIGHTING)", hint: "Same zone, full action", value: "slugfest" },
    { label: "Shooting (AGILITY)", hint: "At range, full action", value: "shooting" },
    { label: "Charge (STRENGTH)", hint: "Full + quick action, cannot be blocked", value: "charge" },
    { label: "Grapple (FIGHTING)", hint: "Blockable, no weapon", value: "grapple" },
  ]);
  if (!kind) return;
  const weapons = (c.inventory.items || []).filter((i) => i.damage || i.bonus);
  let weapon = null;
  if (weapons.length) {
    const pick = await chooseModal("Weapon?", [{ label: "Unarmed / powers", value: null },
      ...weapons.map((w) => ({ label: w.name, hint: `Bonus +${w.bonus || 0}, Damage ${w.damage || "—"}`, value: w.name }))]);
    weapon = weapons.find((w) => w.name === pick) || null;
  }
  const huge = await confirmModal("Is the target a huge creature?", { title: "Target", confirmLabel: "Huge creature", cancelLabel: "Normal target" });

  // The defence is declared BEFORE the attacker rolls (§3.2) — so it is asked for here, not after.
  const kindDef = Roller.ATTACK_KINDS[kind];
  const defKind = kindDef.blockable ? "block" : kindDef.dodgeable ? "dodge" : null;
  let defence = null;
  if (defKind && !huge) {
    const declared = await confirmModal(
      defKind === "block"
        ? "Declared before you roll: does the target spend a quick action to block? Each defender 6 cancels one of yours, and extra 6s become a counterattack."
        : "Declared before you roll: does the target spend a quick action to dodge? Each defender 6 cancels one of yours, and extra 6s let them move a zone each.",
      { title: defKind === "block" ? "Block?" : "Dodge?", confirmLabel: defKind === "block" ? "They block" : "They dodge", cancelLabel: "No defence" });
    if (declared) {
      const n = Number(await promptModal(defKind === "block" ? "Defender's FIGHTING score?" : "Defender's AGILITY score?",
        { title: "Defender", value: "3" }));
      if (n > 0) defence = { kind: defKind, dice: n };
    }
  }

  const manual = Settings.manualDice() ? await askManualFaces() : null;
  const r = Roller.makeAttack(c, kind, { weapon, huge, manualFaces: manual });
  let resolved = null;
  if (defence) {
    const dr = Roller.rollRaw(defence.dice, defence.kind === "block" ? "Block (FIGHTING)" : "Dodge (AGILITY)", { pushable: false });
    resolved = { ...defence, roll: dr, ...(defence.kind === "block" ? Roller.resolveBlock(r, dr) : Roller.resolveDodge(r, dr)) };
  }
  showAttackResult(c, r, { huge, defence: resolved });
}

export function showAttackResult(c, r, { huge = false, defence = null } = {}) {
  const stunts = r.meta.stunts || [];
  const effective = defence ? defence.remainingSixes : r.sixes;
  const available = Math.max(0, effective - 1);
  const body = el("div", {},
    el("div", { class: "dice-row" }, ...r.dice.map((v) => el("span", { class: `die ${v === 6 ? "six" : v === 1 ? "one" : ""}`, text: String(v) }))),
    defence ? el("div", {},
      el("p", { class: "muted small", text: `${defence.kind === "block" ? "Block" : "Dodge"}: ${defence.roll.sixes} six${defence.roll.sixes === 1 ? "" : "es"} cancelling yours.` }),
      el("div", { class: "dice-row" }, ...defence.roll.dice.map((v) => el("span", { class: `die ${v === 6 ? "six" : v === 1 ? "one" : ""}`, text: String(v) })))) : null,
    el("p", { class: `outcome ${effective ? "good" : "bad"}`, text: effective ? `Hit — ${r.meta.damage} damage (${r.meta.damageSource})` : defence ? `Stopped — the ${defence.kind} cancelled it` : "Miss" }),
    effective ? el("p", { class: "muted", text: `${available} stunt${available === 1 ? "" : "s"} available. Knockback, Bang Heads and Slam deal half your base STRENGTH (${Roller.stuntDamage(c)}), not Slugfest Damage.` }) : null,
    defence?.note ? el("p", { class: "warn", text: defence.note }) : null,
    huge ? el("p", { class: "warn small", text: "Huge creature: Knockback, Stun, Slam, Suppressed and Deadly Hit are unavailable, and it cannot be grappled." }) : null,
    el("div", { class: "stunt-list" }, ...stunts.map((s) => el("details", {}, el("summary", { text: s.name }), el("p", { text: s.desc })))),
    el("p", { class: "cite" }, el("a", { href: "#/rules/stunts", class: "rules-link" }, "Rules: Stunts")));
  const pushCheck = Roller.canPush(c, r);
  const actions = [{ label: "Done", variant: "primary" }];
  if (pushCheck.ok) actions.unshift({ label: "Push", variant: "warn", keepOpen: true, onClick: async (close) => {
    const manual = Settings.manualDice() ? await askManualFaces() : null;
    const res = Roller.pushRoll(c, r, manual);
    if (!res.ok) { showToast(res.reason, { variant: "warn" }); return; }
    if (res.stress) spendStress(c, res.stress, "pushing the attack");
    close();
    // The push re-rolls the attack; the declared defence stands and is re-resolved against it.
    const again = defence
      ? { ...defence, ...(defence.kind === "block" ? Roller.resolveBlock(r, defence.roll) : Roller.resolveDodge(r, defence.roll)) }
      : null;
    showAttackResult(Store.activeCharacter(), r, { huge, defence: again });
  } });
  announce(effective ? `Hit for ${r.meta.damage}.` : "Miss.");
  return modal({ title: r.label, body, actions });
}

async function openBanter(c) {
  const p = Number(await promptModal("The target's PRESENCE score?", { title: "Action banter", value: "3" }));
  if (!p) return;
  const res = Roller.banter(c, p);
  if (!res.ok) { showToast(res.reason, { variant: "warn" }); return; }
  modal({ title: "Action banter",
    body: el("div", {},
      el("div", { class: "dice-row" }, ...res.roll.dice.map((v) => el("span", { class: `die ${v === 6 ? "six" : v === 1 ? "one" : ""}`, text: String(v) }))),
      el("p", { text: `You rolled ${res.roll.sixes} successes against ${res.opposing.sixes}.` }),
      el("p", { class: res.stress ? "good" : "bad", text: res.stress ? `The target takes ${res.stress} stress.` : "No effect this round." }),
      el("p", { class: "muted small", text: "One banter per target per round; it never works on huge creatures." })),
    actions: [{ label: "Done", variant: "primary" }] });
}

function rollReputation(c) {
  const res = Roller.rollReputation(c);
  modal({ title: "Reputation",
    body: el("div", {},
      res.roll ? el("div", { class: "dice-row" }, ...res.roll.dice.map((v) => el("span", { class: `die ${v === 6 ? "six" : ""}`, text: String(v) }))) : null,
      el("p", { class: res.recognised ? "good" : "muted", text: res.note }),
      el("p", { class: "muted small", text: "This is not an attribute roll and cannot be pushed." })),
    actions: [{ label: "Done", variant: "primary" }] });
}

/* ---------------------------------------------------------------- powers, talents, drawbacks */

function powersCard(c) {
  const list = el("div", { class: "power-list" });
  for (const p of c.powers || []) {
    const def = R.findPower(p.name);
    list.append(el("button", { class: "power-row", onclick: () => usePower(c, p) },
      el("div", {},
        el("strong", { text: R.powerDisplayName(p) }),
        def ? el("p", { class: "muted small", text: def.summary.slice(0, 140) + (def.summary.length > 140 ? "…" : "") }) : el("p", { class: "warn small", text: p.note || "Not in the rules library." }),
        (p.boosts || []).length ? el("p", { class: "small", text: `Boosts: ${p.boosts.join(", ")}` }) : null,
        (p.limits || []).length ? el("p", { class: "small warn", text: `Limits: ${p.limits.join(", ")}` }) : null),
      el("span", { class: "tap-hint", text: "Use ▸" })));
  }
  if (!(c.powers || []).length) list.append(el("p", { class: "muted", text: "No powers recorded." }));
  return el("section", { class: "card" }, el("h3", { text: `Powers (${(c.powers || []).length})` }), list);
}

function talentsCard(c) {
  const list = el("div", { class: "chiprow" });
  for (const t of c.talents || []) {
    const def = R.findTalent(t.name);
    list.append(el("button", { class: "chip selectable", title: def?.desc || "", onclick: () => useTalent(c, t.name) },
      t.name + (t.rank > 1 ? ` ×${t.rank}` : "")));
  }
  if (!(c.talents || []).length) list.append(el("span", { class: "muted", text: "No talents." }));
  return el("section", { class: "card" }, el("h3", { text: "Talents" }),
    el("p", { class: "muted small", text: "Tap a talent to use it. Passive talents are already applied to your dice pools." }), list);
}

function drawbacksCard(c) {
  if (!(c.drawbacks || []).length) return el("span", {});
  return el("section", { class: "card" }, el("h3", { text: "Drawbacks" }),
    ...c.drawbacks.map((d) => {
      const def = R.findDrawback(d.name);
      return el("details", { class: "drawback" }, el("summary", { text: d.name }),
        el("p", { text: def?.desc || d.detail || "" }),
        d.detail && def ? el("p", { class: "muted small", text: d.detail }) : null,
        el("button", { class: "btn tiny ghost", onclick: async () => {
          const detail = await promptModal("Define the specifics for this drawback.", { title: d.name, value: d.detail || "" });
          if (detail !== null) Store.updateCharacter((ch) => { const t = ch.drawbacks.find((x) => x.name === d.name); if (t) t.detail = detail; });
        } }, "Define"));
    }));
}

function conditionsCard(c) {
  const grid = el("div", { class: "chiprow" });
  for (const cond of D.CONDITIONS) {
    if (cond.key === "broken" || cond.key === "stressedOut") continue;
    const on = !!c.state.conditions[cond.key];
    grid.append(el("button", { class: `chip selectable ${on ? "selected warn" : ""}`, title: cond.desc, onclick: () => {
      Store.updateCharacter((ch) => { ch.state.conditions[cond.key] = !on; });
      showToast(on ? `${cond.name} cleared.` : `${cond.name}: ${cond.desc}`, { timeout: 5000 });
    } }, cond.name));
  }
  const pen = Derived.conditionPenalty(c);
  return el("section", { class: "card" },
    el("h3", { text: "Conditions" }),
    helpPanel(["Temporary states from powers, stunts and hazards. Tap to toggle one on or off.", "Anything with a dice penalty is applied automatically to every affected roll — you do not subtract it yourself.", "Afflicted is the heaviest: −3 dice (−4 if Potent) to all attribute rolls, including the PRESENCE roll to shake it off."]),
    grid,
    pen.notes.length ? el("p", { class: "warn small", text: pen.notes.join(" · ") }) : el("p", { class: "muted small", text: "No conditions active." }),
    c.state.conditions.afflicted ? el("button", { class: "btn", onclick: () => shakeOffAffliction(c) }, "Shake off (PRESENCE, no action)") : null);
}

async function shakeOffAffliction(c) {
  const manual = Settings.manualDice() ? await askManualFaces() : null;
  const r = Roller.roll(c, "presence", "Shake off Affliction", { manualFaces: manual, passive: false });
  if (r.sixes > 0) {
    Store.updateCharacter((ch) => { ch.state.conditions.afflicted = false; ch.state.conditions.afflictedPotent = false; });
    showToast("Affliction shaken off.", { variant: "good" });
  } else showToast("Still afflicted — one attempt per round, on your own turn.", { variant: "warn" });
  showRollResult(c, r);
}

/* ---------------------------------------------------------------- inventory & purchases */

function inventoryCard(c, s) {
  const list = el("div", { class: "inv-list" });
  for (const item of c.inventory.items || []) {
    list.append(el("div", { class: `inv-row ${item.equipped ? "equipped" : ""}` },
      el("div", {},
        el("strong", { text: `${item.name}${item.qty > 1 ? ` ×${item.qty}` : ""}` }),
        el("p", { class: "muted small", text: [
          item.bonus ? `Bonus +${item.bonus}` : null,
          item.damage ? `Damage ${item.damage}` : null,
          item.range ? `Range ${Array.isArray(item.range) ? item.range.join("/") : item.range}` : null,
          item.armor ? `Armor ${item.armor}` : null,
          (item.features || []).join(", ") || null,
          item.note || null,
        ].filter(Boolean).join(" · ") })),
      el("div", { class: "chosen-actions" },
        (item.armor || item.damage) ? el("button", { class: "btn tiny", onclick: () => {
          Store.updateCharacter((ch) => { const t = ch.inventory.items.find((x) => x.id === item.id); if (t) t.equipped = !t.equipped; });
        } }, item.equipped ? "Unequip" : "Equip") : null,
        el("button", { class: "btn tiny danger", onclick: () => {
          Store.updateCharacter((ch) => { ch.inventory.items = ch.inventory.items.filter((x) => x.id !== item.id); });
        } }, "Drop"))));
  }
  if (!(c.inventory.items || []).length) list.append(el("p", { class: "muted", text: "Nothing carried. Heroes don't track encumbrance in this game — the GM disallows the absurd." }));

  return el("section", { class: "card" },
    el("h3", { text: "Gear" }),
    helpPanel(["What you are carrying. This game has no encumbrance — the GM simply disallows the absurd.", "Buying compares your Resources against an item's Cost: higher buys it outright, equal needs a roll of at least one 6, lower needs a loan.", "Restricted items need the Streetwise talent no matter how wealthy you are."]),
    el("p", { class: "stat-line", text: `Resources ${s.resources} — ${D.STANDARD_OF_LIVING[s.resources]}` }),
    list,
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => openGearCatalogue(c) }, "Buy / add gear"),
      el("button", { class: "btn ghost", onclick: () => openPriceList() }, "Price list")));
}

async function openGearCatalogue(c) {
  const items = R.allGear();
  const search = el("input", { class: "input", type: "search", placeholder: "Search gear, weapons, vehicles…" });
  const list = el("div", { class: "gear-list" });
  const body = el("div", {}, search, list);
  const m = modal({ title: "Gear", body, size: "wide", actions: [{ label: "Close", variant: "ghost" }] });
  const draw = () => {
    clear(list);
    const q = search.value.trim().toLowerCase();
    for (const item of items) {
      if (q && !item.name.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) continue;
      list.append(el("button", { class: "gear-row", onclick: () => { m.close(); attemptPurchase(c, item); } },
        el("div", {}, el("strong", { text: item.name }),
          el("p", { class: "muted small", text: [item.category, item.cost ? `Cost ${item.cost}` : null, item.restricted ? "Restricted" : null,
            item.damage ? `Damage ${item.damage}` : null, item.armor ? `Armor ${item.armor}` : null,
            item.durability !== undefined ? `Durability ${item.durability}` : null,
            (item.features || []).join(", ") || null, item.note || null].filter(Boolean).join(" · ") }),
          null),
        el("span", { class: "tap-hint", text: "Buy ▸" })));
    }
  };
  search.addEventListener("input", draw);
  draw();
}

async function attemptPurchase(c, item) {
  if (!item.cost) { addItem(c, item); showToast(`${item.name} added.`); return; }
  const res = Derived.resources(c);
  const check = R.purchaseCheck({ resources: res, cost: item.cost, restricted: !!item.restricted, streetwise: R.hasTalent(c, "Streetwise") });
  const body = el("div", {},
    el("p", { text: `${item.name} — Cost ${item.cost}. Your Resources: ${res}.` }),
    el("p", { class: check.allowed ? "muted" : "warn", text: check.reason }),
    el("p", { class: "cite" }, el("a", { href: "#/rules/resources", class: "rules-link" }, "Rules: Resources and purchases")));
  const actions = [{ label: "Cancel", value: null, variant: "ghost" }];
  if (check.allowed) actions.push({ label: check.mode === "automatic" ? "Take it" : "Roll Resources", variant: "primary", value: "buy" });
  else if (check.mode === "unaffordable") actions.push({ label: "Try a loan (+1)", variant: "warn", value: "loan1" }, { label: "Loan (+2)", variant: "warn", value: "loan2" });
  const choice = await modal({ title: "Purchase", body, actions }).promise;
  if (!choice) return;
  const loan = choice === "loan1" ? 1 : choice === "loan2" ? 2 : 0;
  const result = Roller.purchase(c, item, { loan });
  if (!result.ok) { showToast(result.reason, { variant: "warn" }); return; }
  if (result.success) { addItem(c, item); showToast(`${item.name} acquired.`, { variant: "good" }); if (loan) applyLoan(c, loan); return; }
  const tryBarter = await confirmModal("The purchase failed. Make one PRESENCE roll to barter?", { title: "Barter?", confirmLabel: "Barter" });
  if (!tryBarter) return;
  const b = Roller.barter(c, item);
  if (b.success) { addItem(c, item); showToast(`${item.name} acquired after haggling.`, { variant: "good" }); if (loan) applyLoan(c, loan); }
  else showToast("Both rolls failed — you cannot try to buy that item again for a few days.", { variant: "danger" });
}

function applyLoan(c, loan) {
  Store.updateCharacter((ch) => {
    ch.identity.resourcesBase = Math.max(1, (ch.identity.resourcesBase ?? Derived.resources(ch)) - 1);
    ch.state.restFlags.loan = { steps: loan, at: Date.now() };
  }, { id: c.id });
  showToast(`Loan taken: Resources drop 1 step for ${loan === 1 ? "a few weeks" : "a few months"}.`, { variant: "warn", timeout: 6000 });
}

function addItem(c, item) {
  Store.updateCharacter((ch) => {
    ch.inventory.items.push({
      id: uid("item"), name: item.name, qty: 1, equipped: false,
      bonus: item.bonus || 0, damage: item.damage || 0, range: item.range || null,
      armor: item.armor || 0, features: item.features || [], note: item.note || "", cost: item.cost || 0,
    });
  }, { id: c.id });
}

function openPriceList() {
  modal({ title: "Price list",
    body: el("div", {}, ...Object.entries(D.PRICE_LADDER).map(([cost, items]) =>
      el("p", {}, el("strong", { text: `Cost ${cost}: ` }), items))),
    actions: [{ label: "Close", variant: "ghost" }] });
}

/* ---------------------------------------------------------------- notes */

function notesCard(c) {
  const ta = el("textarea", { class: "input", rows: 5, placeholder: "Notes, contacts, leads…" });
  ta.value = c.notes || "";
  ta.addEventListener("change", () => Store.updateCharacter((ch) => { ch.notes = ta.value; }));
  return el("section", { class: "card" }, el("h3", { text: "Notes" }), ta);
}

/* ---------------------------------------------------------------- rest & recovery */

export function openRecovery(c) {
  const s = Derived.summary(c);
  const body = el("div", {},
    el("p", { class: "muted", text: "Health returns after an action scene; Resolve returns in a social scene." }),
    el("table", { class: "data-table" },
      el("tr", {}, el("th", { text: "Time" }), el("th", { text: "Health" }), el("th", { text: "Resolve" })),
      ...D.RECOVERY.map((r) => el("tr", {}, el("td", { text: r.span }), el("td", { text: r.health }), el("td", { text: r.resolve })))),
    // Ordered by time span, exactly like the table above it: round → minutes → hours.
    el("p", { class: "stage-label", text: "An action round" }),
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => {
        const r = Roller.roll(c, "presence", "Recover Resolve");
        Store.updateCharacter((ch) => { ch.state.resolve = Math.min(Derived.maxResolve(ch), ch.state.resolve + r.sixes); });
        showToast(r.sixes ? `Full action: ${r.sixes} Resolve recovered.` : "No 6s — no Resolve recovered.");
      } }, "Full action: PRESENCE roll, 1 Resolve per 6")),
    el("p", { class: "stage-label", text: "A few minutes" }),
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => {
        Store.updateCharacter((ch) => { ch.state.health = Math.min(Derived.maxHealth(ch), ch.state.health + Derived.effectiveAttributes(ch).strength); ch.state.broken = ch.state.health <= 0; });
        showToast(`Health restored equal to your STRENGTH (${s.attributes.strength}).`);
      } }, "After the action scene: Health = STRENGTH"),
      el("button", { class: "btn", onclick: () => {
        Store.updateCharacter((ch) => { ch.state.resolve = Math.min(Derived.maxResolve(ch), ch.state.resolve + Derived.effectiveAttributes(ch).presence); });
        showToast(`Social scene: Resolve restored equal to your PRESENCE (${s.attributes.presence}).`);
      } }, "Social scene: Resolve = PRESENCE")),
    el("p", { class: "stage-label", text: "A few hours" }),
    el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => {
        Store.updateCharacter((ch) => { ch.state.health = Derived.maxHealth(ch); ch.state.broken = false; });
        showToast("All Health restored after a few hours' rest.");
      } }, "Rest: all Health"),
      el("button", { class: "btn", onclick: () => {
        Store.updateCharacter((ch) => { ch.state.resolve = Derived.maxResolve(ch); });
        showToast("All Resolve restored after a long social scene.");
      } }, "Social scene with a break: all Resolve")),
    el("p", { class: "muted small", text: "Recovering all your Health does not remove critical injuries — those heal on their own schedule." }),
    el("p", { class: "cite" }, el("a", { href: "#/rules/recovery", class: "rules-link" }, "Rules: Recovery")));
  return modal({ title: "Rest & recovery", body, actions: [{ label: "Close", variant: "ghost" }] });
}

/* ---------------------------------------------------------------- karma */

export function openKarma(c) {
  const body = el("div", { class: "karma-panel" });
  const draw = () => {
    clear(body);
    const ch = Store.activeCharacter();
    body.append(
      el("p", { class: "stat-line", text: `Karma: ${ch.state.karma}${ch.state.session.spendUnlocked ? " · spending unlocked" : " · spending locked until the session ends"}` }),
      el("h4", { class: "section", text: "Spend karma" }),
      el("div", { class: "chiprow column" },
        spendButton("Attribute step (up to rank max)", D.KARMA.costs.attributeStep, "attribute"),
        spendButton("Attribute step above rank max", D.KARMA.costs.attributeStepAboveRank, "attribute"),
        spendButton("Power level", D.KARMA.costs.powerLevel, "power"),
        spendButton("Power boost", D.KARMA.costs.powerBoost, "boost"),
        spendButton("New power (needs an in-game explanation)", D.KARMA.costs.newPower, "power"),
        spendButton("New talent", D.KARMA.costs.talent, "talent"),
        spendButton("Remove a drawback", D.KARMA.costs.removeDrawback, "drawback")),
      el("p", { class: "muted small", text: `Training discount applied: ${Math.round(Store.trainingDiscount() * 100)}%` }),
      el("h4", { class: "section", text: "Advancement log" }),
      el("ul", { class: "muted small" }, ...(ch.advancementLog || []).slice(-10).reverse().map((a) => el("li", { text: `${new Date(a.at).toLocaleDateString()} — ${a.label} (${a.cost} karma)` }))),
      el("p", { class: "cite" }, el("a", { href: "#/rules/karma", class: "rules-link" }, "Rules: Karma")));
  };

  function spendButton(label, cost, kind) {
    const trained = Store.trainingDiscount() > 0;
    const final = Store.discountedCost(cost, { personal: true, trained });
    return el("button", { class: "chip wide", onclick: async () => {
      const detail = await promptModal(`What are you improving? (${final} karma)`, { title: label });
      if (detail === null) return;
      let msg = null;
      Store.updateCharacter((ch) => {
        const res = Store.karmaSpend(ch, { kind, label: `${label}: ${detail}`, cost: final });
        if (!res.ok) msg = res.reason;
      });
      if (msg) showToast(msg, { variant: "warn" });
      else { showToast(`${final} karma spent.`, { variant: "good" }); draw(); }
    } }, `${label} — ${final} karma`);
  }

  draw();
  return modal({ title: "Karma & advancement", body, size: "wide", actions: [{ label: "Close", variant: "ghost" }] });
}
