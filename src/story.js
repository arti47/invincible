// story.js — Play in Crisis Mode. The game and the journal are one screen.
//
// The open journal session IS the story: every roll, oracle answer, timer tick and scene the
// engines record lands here as a beat, oldest first. Under the latest beat the app asks one
// question to write to (optional — skipping never blocks play) and offers two to four choices for
// what the hero does next, picked from what the current step of the Ch.9 loop allows. Result
// dialogs land inline as beats rather than covering the story (`ui.setBeatHost`). A fight plays
// out here too, turn by turn. The full board — timers, crises, encounter steps, oracles, the
// fight board — opens as a drawer beside the story, so nothing it held is lost.
//
// Nothing here rolls or decides anything itself: every choice calls the same function the board's
// own button runs (`solo.soloActions`, `combat.combatActions`).

import { el, clear, dieEl } from "./core.js";
import { icon } from "./icons.js";
import { setBeatHost, showToast, chooseModal } from "./ui.js";
import { crisisDial } from "./art.js";
import * as Journal from "./journal.js";
import * as Store from "./store.js";
import { soloActions, renderSolo, crisisNow } from "./solo.js";
import { combatActions, currentTurn, attackBlockedReason, renderCombat } from "./combat.js";
import { usePower } from "./power-automation.js";
import { setLearnTab } from "./learn.js";
import * as R from "./rules.js";

let storyMount = null;
let boardOpen = false;
let draft = "";
let last = null;                 // previous status, so a change can pulse
const pending = [];              // inline result beats still waiting on a button

/* ---------------------------------------------------------------- inline beats */

setBeatHost({
  active: () => !!storyMount?.isConnected && document.body.dataset.route === "story",
  add(card) {
    pending.push(card);
    const host = storyMount?.querySelector(".story-pending");
    if (host) { host.append(card); card.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }
  },
  resolved(card) {
    const i = pending.indexOf(card);
    if (i >= 0) pending.splice(i, 1);
    // A resolved result stays on screen until the story redraws; the journal already holds it.
    schedule();
  },
});

/* ---------------------------------------------------------------- redraws */

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    if (storyMount?.isConnected && document.body.dataset.route === "story") renderStory(storyMount, { keepScroll: true });
  }, 0);
}
document.addEventListener("journal-changed", schedule);
document.addEventListener("solo-changed", schedule);

/* ---------------------------------------------------------------- what to ask, after each beat */

/** One question to write to, read off the latest beat. App copy only — no rules text is changed. */
function promptFor(entry) {
  if (!entry) return "Who is your hero, and where are they when this begins?";
  const t = entry.text || "";
  if (entry.kind === "note") return "And then?";
  if (entry.kind === "roll") {
    const ok = (entry.detail?.sixes || 0) > 0;
    return ok ? "It worked. What does that look like?" : "It didn't work. What goes wrong?";
  }
  if (/alert/i.test(t)) return "Where is your hero when the call comes in?";
  if (/^Crisis event|crisis event/i.test(t)) return "What does your hero see happen?";
  if (/^Event check/i.test(t)) return "How does the situation change?";
  if (/Opportunity/i.test(t)) return "What opening does your hero spot?";
  if (/Encounter|presence/i.test(t)) return "Who — or what — is out there?";
  if (/Objective|objective/.test(t)) return "What did your hero learn, reach or lose?";
  if (/[Aa]ll(y|ies)/.test(t)) return "How are the people with you holding up?";
  if (/timer|Timer|→/.test(t)) return "The clock moved. What does your hero notice?";
  if (entry.kind === "lifecycle") return "How does this end for your hero, for now?";
  if (entry.kind === "state") return "How does your hero take it?";
  return "What does your hero do or notice?";
}

/* ---------------------------------------------------------------- choices */

const choice = (label, run, { primary = false, hint = "", key = "" } = {}) => ({ label, run, primary, hint, key });

function fightChoices(combat, mounts) {
  const up = currentTurn(combat);
  const list = [];
  const standing = (side) => combat.combatants.filter((c) => (side === "adversary" ? c.side === "adversary" : c.side !== "adversary") && c.health > 0);
  // The fight is decided when one side has nobody standing: say so, and make ending it the move.
  if (!standing("adversary").length || !standing("heroes").length) {
    const won = !standing("adversary").length;
    return [choice(won ? "The fight is won — end the scene" : "Your side is down — end the scene", () => combatActions.end(mounts.combat),
      { primary: true, key: "end-fight", hint: won ? "Recover Health equal to STRENGTH; the timers roll next." : "Then see to the broken: rally or stabilise." })];
  }
  if (!up) {
    list.push(choice("Next round — draw new cards", () => combatActions.nextRound(mounts.combat), { primary: true, key: "next-round" }));
  } else {
    const blocked = attackBlockedReason(combat, up);
    const hero = up.side === "hero";
    if (!blocked) list.push(choice(hero ? `${up.name} attacks` : `${up.name} attacks`, () => combatActions.attack(up.id, mounts.combat),
      { primary: true, key: "attack", hint: hero ? "Pick the target; defences are declared before the dice." : "Roll for them; you decide how your hero defends." }));
    const c = hero && up.refId ? Store.getCharacter?.(up.refId) || Store.activeCharacter() : null;
    if (hero && c && (c.powers || []).length) {
      list.push(choice("Use a power", async () => {
        const pick = await chooseModal("Which power?", c.powers.map((p, i) => ({ label: R.powerDisplayName(p), value: i })));
        if (pick === null || pick === undefined) return;
        usePower(c, c.powers[pick]);
      }, { key: "power" }));
    }
    list.push(choice(hero ? "Hold back this turn" : `${up.name} holds back`, () => {
      const cbt = Store.getCombat();
      const me = cbt?.combatants.find((x) => x.id === up.id);
      if (me) { me.acted = true; Store.saveCombat(cbt); Journal.record({ kind: "state", text: `${up.name} holds back this turn.` }); }
    }, { key: "pass" }));
  }
  list.push(choice("End the fight", () => combatActions.end(mounts.combat), { key: "end-fight" }));
  return list;
}

function loopChoices(mounts) {
  const step = soloActions.step();
  const b = mounts.board;
  const S = soloActions;
  if (step === 0) return [choice("Sound the crisis alert", () => S.alert(b), { primary: true, key: "alert", hint: "The threat tables roll tonight's emergency." })];
  if (step === 1) return [choice("Make an event check", () => S.eventCheck(b), { primary: true, key: "event", hint: "Does it escalate, hold, or open up?" }),
    choice("Ask the oracle a yes/no question", () => S.oracle(b), { key: "oracle" })];
  if (step === 2) return [choice("Take on the crisis", () => S.engage(b), { primary: true, key: "engage", hint: "Starts its crisis timer." }),
    choice("Make another event check", () => S.eventCheck(b), { key: "event" }),
    choice("Ask the oracle a yes/no question", () => S.oracle(b), { key: "oracle" })];
  if (step === 3) {
    const list = [];
    if (S.encounterWaiting()) list.push(choice("Deal with what you ran into", () => openBoard("solo-encounter"), { primary: true, key: "encounter", hint: "The encounter is waiting on its next step." }));
    if ((S.state().objectives || []).some((o) => o.status === "reached")) list.push(choice("Claim the objective's karma", () => S.claim(b), { primary: !list.length, key: "claim" }));
    list.push(
      choice("Move to a new place", () => S.move(b, "zone"), { primary: !list.length, key: "zone", hint: "Encounter check and crisis timers." }),
      choice("Search, wait or work at something", () => S.move(b, "search"), { key: "search", hint: "Takes time: crisis timers at +1 die." }),
      choice("Try something risky", () => S.move(b, "risky"), { key: "risky", hint: "Pick the attribute and roll." }),
      choice("Start a fight", () => S.move(b, "brawl"), { key: "brawl", hint: "Pick the enemy; the fight plays out here." }));
    return list.slice(0, 4);
  }
  if (step === 4) return [choice("Play a social scene", () => S.social(b), { primary: true, key: "social", hint: "Recover Resolve equal to PRESENCE." }),
    choice("Ask the oracle a yes/no question", () => S.oracle(b), { key: "oracle" })];
  return [choice("Head home — rest and bank karma", () => S.home(b), { primary: true, key: "home" }),
    choice("Stop for tonight", () => S.stop(b), { key: "stop" })];
}

/* ---------------------------------------------------------------- the board drawer */

function openBoard(focusId = null) {
  boardOpen = true;
  const d = storyMount?.querySelector(".story-board");
  if (!d) return;
  d.classList.add("open");
  d.setAttribute("aria-hidden", "false");
  if (focusId) d.querySelector(`#${focusId}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
}
function closeBoard() {
  boardOpen = false;
  const d = storyMount?.querySelector(".story-board");
  if (d) { d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); }
}

/* ---------------------------------------------------------------- beats */

function beatEl(item) {
  if (item.burst) {
    const rolls = item.entries.map((e) => el("div", { class: "beat-roll" },
      el("span", { class: "jr-text", text: e.text }),
      e.detail?.dice?.length ? el("span", { class: "dice-row small", "aria-label": `Dice: ${e.detail.dice.join(", ")}` }, ...e.detail.dice.map((v, i) => dieEl(v, i))) : null));
    return el("article", { class: "beat beat-roll-burst" },
      el("span", { class: "beat-ico", "aria-hidden": "true" }, icon("die", { size: 14 })),
      el("div", { class: "beat-main" }, el("p", { class: "jr-text beat-kicker", text: Journal.burstSummary(item) }), ...rolls));
  }
  const e = item;
  const ico = { note: "pen", roll: "die", solo: "solo", lifecycle: "play", state: "hero" }[e.kind] || "burst";
  const sixes = e.detail?.sixes;
  return el("article", { class: `beat beat-${e.kind}${e.kind === "roll" ? (sixes ? " ok" : " miss") : ""}` },
    el("span", { class: "beat-ico", "aria-hidden": "true" }, icon(ico, { size: 14 })),
    el("div", { class: "beat-main" },
      el("p", { class: e.kind === "note" ? "jr-text written" : "jr-text", text: e.text }),
      e.kind === "roll" && e.detail?.dice?.length
        ? el("div", { class: "dice-row small", "aria-label": `Dice: ${e.detail.dice.join(", ")}` }, ...e.detail.dice.map((v, i) => dieEl(v, i))) : null,
      e.note ? el("p", { class: "jr-note", text: e.note }) : null));
}

/* ---------------------------------------------------------------- render */

export function renderStory(mount, { keepScroll = false } = {}) {
  storyMount = mount;
  const y = keepScroll ? window.scrollY : 0;
  clear(mount);
  const hero = Store.activeCharacter();
  if (!hero) {
    mount.append(el("div", { class: "empty" },
      el("h2", { text: "No hero yet" }),
      el("p", { text: "The story needs someone to follow. Build a hero — the app can roll a whole one for you." }),
      el("a", { class: "btn primary", href: "#/create" }, "Create a hero")));
    return;
  }

  const combat = combatActions.combat();
  const fighting = !!(combat?.active && combat.combatants?.length);
  const st = soloActions.state();
  const cn = crisisNow();
  const step = soloActions.step();

  // ---- status strip: the crisis at a glance; a change pulses.
  const status = { level: cn.level, step, timers: (st.timers || []).length, round: fighting ? combat.round : 0 };
  const changed = (k) => last && last[k] !== status[k] ? "pulse" : "";
  const strip = el("div", { class: "story-status", role: "status" },
    el("span", { class: `story-dial ${changed("level")}` }, crisisDial(cn.level, `Crisis level ${cn.level} of 10`)),
    el("span", { class: `story-stat ${changed("level")}` }, el("small", { text: `Crisis · ${cn.phase.name.split(" ")[0]}` }), el("strong", { text: String(cn.level) })),
    el("span", { class: `story-stat ${changed("step")}` }, el("small", { text: fighting ? "Fight" : "Step" }), el("strong", { text: fighting ? `Round ${combat.round}` : `${step + 1} of 6` })),
    el("span", { class: `story-stat ${changed("timers")}` }, el("small", { text: "Timers" }), el("strong", { text: String(status.timers) })),
    el("button", { class: "btn tiny story-board-btn", "aria-expanded": boardOpen ? "true" : "false", "aria-controls": "story-board",
      onclick: () => (boardOpen ? closeBoard() : openBoard()) }, icon("map", { size: 16 }), " Board"));
  last = status;

  // ---- the stream: the open session, oldest first.
  const j = Journal.load();
  const open = Journal.openSession(j);
  const mine = (e) => !e.characterId || e.characterId === hero.id;
  let list = open ? j.entries.filter((e) => e.sessionId === open.id && mine(e)) : [];
  list = list.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const stream = el("div", { class: "story-stream", role: "log", "aria-live": "polite", "aria-label": "The story so far" });
  if (!open) {
    const prev = j.entries.filter((e) => e.sessionId && mine(e)).sort((a, b) => (a.seq || 0) - (b.seq || 0)).slice(-3);
    stream.append(el("header", { class: "story-cover" },
      el("p", { class: "story-kicker", text: prev.length ? "Previously" : "Issue #1" }),
      el("h2", { text: hero.identity.heroName || hero.identity.realName || "Your hero" }),
      prev.length ? el("div", { class: "story-prev" }, ...prev.map((e) => el("p", { class: "jr-text", text: e.text })))
        : el("p", { class: "muted", text: "Every roll, answer and scene lands here as it happens, and you write between them. This page is your journal." })));
  } else {
    stream.append(el("header", { class: "story-cover small" },
      el("p", { class: "story-kicker", text: Journal.listSessions().find((s) => s.id === open.id)?.label || "Tonight" })));
    // Every beat stands on its own here — in a fight each blow is a moment, not a batch.
    for (const e of list) stream.append(beatEl(e));
  }

  // ---- inline results still waiting on a button.
  const pend = el("div", { class: "story-pending" }, ...pending);

  // ---- write: one question, always optional.
  const latest = list[list.length - 1];
  const q = promptFor(open ? latest : null);
  const ta = el("textarea", { class: "input story-text", rows: "2", placeholder: q, "aria-label": q, value: draft });
  ta.value = draft;
  ta.addEventListener("input", () => { draft = ta.value; });
  const saveNote = () => {
    const text = ta.value.trim();
    if (!text) return;
    if (!Journal.openSession()) Journal.startSession("", hero.id);
    Journal.addNote(text, hero.id);
    draft = "";
  };
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveNote(); } });
  const write = el("div", { class: "story-write" },
    el("label", { class: "story-q", text: q }), ta,
    el("div", { class: "row-actions" }, el("button", { class: "btn tiny", onclick: saveNote }, icon("pen", { size: 14 }), " Write it"),
      el("span", { class: "muted small", text: "Optional — or just pick what happens next." })));

  // ---- choices.
  const boardMount = el("div", { class: "story-board-solo" });
  const combatMount = el("div", { class: "story-board-combat" });
  const mounts = { board: boardMount, combat: combatMount };
  const opts = fighting ? fightChoices(combat, mounts) : loopChoices(mounts);
  const choices = el("nav", { class: "story-choices", "aria-label": "What happens next" },
    el("p", { class: "story-kicker", text: fighting ? `Round ${combat.round} — ${currentTurn(combat)?.name ? `${currentTurn(combat).name} acts` : "everyone has acted"}` : "What happens next?" }),
    ...opts.map((o) => el("button", { class: `story-choice ${o.primary ? "primary" : ""}`, "data-choice": o.key,
      onclick: async () => { try { await o.run(); } catch (err) { console.error(err); showToast(String(err.message || err), { variant: "danger" }); } schedule(); } },
      el("strong", { text: o.label }), o.hint ? el("span", { class: "small", text: o.hint }) : null)),
    el("div", { class: "story-more" },
      fighting ? null : el("button", { class: "btn tiny ghost", "data-choice": "else", onclick: () => soloActions.move(boardMount) }, "Something else…"),
      el("button", { class: "btn tiny ghost", onclick: () => openBoard(fighting ? null : "solo-timers") }, "Timers & crises"),
      !fighting && step === 3 && st.alert ? el("button", { class: "btn tiny ghost", "data-choice": "resolve", onclick: () => soloActions.resolve(boardMount) }, "Resolve the crisis") : null,
      !fighting && soloActions.inSession() && step !== 5 ? el("button", { class: "btn tiny ghost", "data-choice": "stop", onclick: () => soloActions.stop(boardMount) }, "Stop for tonight") : null,
      el("a", { class: "btn tiny ghost", href: "#/learn", onclick: () => setLearnTab("walkthrough") }, "How do I play?")));

  // ---- the board drawer: everything the dashboard held, beside the story.
  const board = el("aside", { class: `story-board ${boardOpen ? "open" : ""}`, id: "story-board", "aria-label": "The board", "aria-hidden": boardOpen ? "false" : "true" },
    el("div", { class: "story-board-head" }, el("h2", { text: fighting ? "The fight and the board" : "The board" }),
      el("button", { class: "icon-btn story-board-close", "aria-label": "Close the board", onclick: closeBoard }, icon("close", { size: 18 }))),
    fighting ? combatMount : null, boardMount);
  mount.append(el("div", { class: "story" },
    el("div", { class: "story-main" }, strip, stream, pend, write, choices), board));
  // The board renders into the drawer once it is in the document (it looks up its own panels).
  if (fighting) renderCombat(combatMount);
  renderSolo(boardMount);
  document.body.dataset.crisis = st.alert ? cn.phase.key : "";
  if (keepScroll) window.scrollTo(0, y);
}
