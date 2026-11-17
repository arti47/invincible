// story.js — Play in Crisis Mode, as a visual novel. The game and the journal are one screen.
//
// Game mode: the tab bar and the app header step aside; a thin HUD (Health, Resolve, crisis dial,
// step or round, a menu) sits on top. The middle of the screen is ONE scene — the latest beat of
// the open journal session, drawn with art for its kind, its caption typed in, its dice laid out.
// Under it a speech balloon asks what the hero does (tap to write; writing is optional), and two to
// four big icon cards say what can happen next, picked from the current step of the Ch.9 loop or
// the fight's turn. Everything else — the story so far, the board, the less common moves, the dice
// guide, leaving — is one tap away in the menu or the backlog, never on screen at once.
//
// Result dialogs land on the stage as the scene (`ui.setBeatHost`); while one waits on a button,
// the choices step back. When a session closes, the stage shows the issue-end splash.
//
// Nothing here rolls or decides anything itself: every choice calls the same function the board's
// own button runs (`solo.soloActions`, `combat.combatActions`). No rules text is changed.

import { el, clear, dieEl } from "./core.js";
import { icon, roleColour } from "./icons.js";
import { setBeatHost, showToast, chooseModal } from "./ui.js";
import { crisisDial, skyline, heroFigure, villainMask, headquarters, radar } from "./art.js";
import * as Journal from "./journal.js";
import * as Store from "./store.js";
import * as Derived from "./derived.js";
import { Settings } from "./settings.js";
import { soloActions, renderSolo, crisisNow } from "./solo.js";
import { combatActions, currentTurn, attackBlockedReason, renderCombat } from "./combat.js";
import { usePower } from "./power-automation.js";
import { openAttributeGuide } from "./sheet.js";
import { setLearnTab } from "./learn.js";
import * as R from "./rules.js";

let storyMount = null;
let boardOpen = false;
let sheetOpen = null;             // "vn-menu" | "vn-backlog" while one is up, so a redraw keeps it
let draft = "";
let writing = false;             // the balloon is open for typing
let last = null;                 // previous status, so a change can pulse
let shownId = null;              // the beat on stage last render, so a new one animates in
let lastHealth = null;           // the hero's Health last render, so a drop shakes the screen
let watchedSession = null;       // the open session last render, so its closing shows the splash
let splash = null;               // { sessionId } while the issue-end splash is up
let typer = null;
const pending = [];              // inline result beats still waiting on a button

const motionOff = () => Settings.noMotion() || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
// The splash belongs to the moment a session closes. Leaving the story ends that moment, so a
// later visit (Home's "Continue issue") opens on the play, not on "The end… for now".
window.addEventListener("hashchange", () => {
  if (!/^#\/story/.test(location.hash)) { splash = null; watchedSession = null; }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !storyMount?.isConnected || document.querySelector(".modal-backdrop")) return;
  if (sheetOpen) closeSheets(); else if (boardOpen) closeBoard();
});

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

const choice = (label, run, { primary = false, hint = "", key = "", ico = "play" } = {}) => ({ label, run, primary, hint, key, ico });

function fightChoices(combat, mounts) {
  const up = currentTurn(combat);
  const list = [];
  const standing = (side) => combat.combatants.filter((c) => (side === "adversary" ? c.side === "adversary" : c.side !== "adversary") && c.health > 0);
  // The fight is decided when one side has nobody standing: say so, and make ending it the move.
  if (!standing("adversary").length || !standing("heroes").length) {
    const won = !standing("adversary").length;
    return [choice(won ? "The fight is won — end the scene" : "Your side is down — end the scene", () => combatActions.end(mounts.combat),
      { primary: true, key: "end-fight", ico: won ? "check" : "alert", hint: won ? "Recover Health equal to STRENGTH; the timers roll next." : "Then see to the broken: rally or stabilise." })];
  }
  if (!up) {
    list.push(choice("Next round", () => combatActions.nextRound(mounts.combat), { primary: true, key: "next-round", ico: "play", hint: "Draw new initiative cards." }));
  } else {
    const blocked = attackBlockedReason(combat, up);
    const hero = up.side === "hero";
    if (!blocked) list.push(choice(`${up.name} attacks`, () => combatActions.attack(up.id, mounts.combat),
      { primary: true, key: "attack", ico: "attack", hint: hero ? "Pick the target; defences are declared before the dice." : "Roll for them; you decide how your hero defends." }));
    const c = hero && up.refId ? Store.getCharacter?.(up.refId) || Store.activeCharacter() : null;
    if (hero && c && (c.powers || []).length) {
      list.push(choice("Use a power", async () => {
        const pick = await chooseModal("Which power?", c.powers.map((p, i) => ({ label: R.powerDisplayName(p), value: i })));
        if (pick === null || pick === undefined) return;
        usePower(c, c.powers[pick]);
      }, { key: "power", ico: "burst" }));
    }
    list.push(choice(hero ? "Hold back" : `${up.name} holds back`, () => {
      const cbt = Store.getCombat();
      const me = cbt?.combatants.find((x) => x.id === up.id);
      if (me) { me.acted = true; Store.saveCombat(cbt); Journal.record({ kind: "state", text: `${up.name} holds back this turn.` }); }
    }, { key: "pass", ico: "clock" }));
  }
  list.push(choice("End the fight", () => combatActions.end(mounts.combat), { key: "end-fight", ico: "close" }));
  return list;
}

function loopChoices(mounts) {
  const step = soloActions.step();
  const b = mounts.board;
  const S = soloActions;
  if (step === 0) return [choice("Sound the crisis alert", () => S.alert(b), { primary: true, key: "alert", ico: "alert", hint: "The threat tables roll tonight's emergency." })];
  if (step === 1) return [choice("Make an event check", () => S.eventCheck(b), { primary: true, key: "event", ico: "die", hint: "Does it escalate, hold, or open up?" }),
    choice("Ask the oracle", () => S.oracle(b), { key: "oracle", ico: "oracle", hint: "A yes/no question." })];
  if (step === 2) return [choice("Take on the crisis", () => S.engage(b), { primary: true, key: "engage", ico: "target", hint: "Starts its crisis timer." }),
    choice("Another event check", () => S.eventCheck(b), { key: "event", ico: "die" }),
    choice("Ask the oracle", () => S.oracle(b), { key: "oracle", ico: "oracle", hint: "A yes/no question." })];
  if (step === 3) {
    const list = [];
    if (S.encounterWaiting()) list.push(choice("Deal with what's out there", () => openBoard("solo-encounter"), { primary: true, key: "encounter", ico: "hazard", hint: "The encounter is waiting on its next step." }));
    if ((S.state().objectives || []).some((o) => o.status === "reached")) list.push(choice("Claim the karma", () => S.claim(b), { primary: !list.length, key: "claim", ico: "check", hint: "An objective was reached." }));
    list.push(
      choice("Move somewhere new", () => S.move(b, "zone"), { primary: !list.length, key: "zone", ico: "map", hint: "Encounter check and crisis timers." }),
      choice("Search or work at it", () => S.move(b, "search"), { key: "search", ico: "clock", hint: "Takes time: crisis timers at +1 die." }),
      choice("Try something risky", () => S.move(b, "risky"), { key: "risky", ico: "die", hint: "Pick the attribute and roll." }),
      choice("Start a fight", () => S.move(b, "brawl"), { key: "brawl", ico: "attack", hint: "Pick the enemy; the fight plays out here." }));
    return list.slice(0, 4);
  }
  if (step === 4) return [choice("Play a social scene", () => S.social(b), { primary: true, key: "social", ico: "hero", hint: "Recover Resolve equal to PRESENCE." }),
    choice("Ask the oracle", () => S.oracle(b), { key: "oracle", ico: "oracle", hint: "A yes/no question." })];
  return [choice("Head home", () => S.home(b), { primary: true, key: "home", ico: "home", hint: "Rest, recover and bank karma." }),
    choice("Stop for tonight", () => S.stop(b), { key: "stop", ico: "clock", hint: "Keep the crisis for next time." })];
}

/* ---------------------------------------------------------------- drawers: board, backlog, menu */

function openBoard(focusId = null) {
  closeSheets();
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
function toggleSheet(cls) {
  const s = storyMount?.querySelector(`.${cls}`);
  if (!s) return;
  const open = !s.classList.contains("open");
  closeSheets();
  closeBoard();
  s.classList.toggle("open", open);
  s.setAttribute("aria-hidden", open ? "false" : "true");
  sheetOpen = open ? cls : null;
  storyMount.querySelector(`[aria-controls="${s.id}"]`)?.setAttribute("aria-expanded", open ? "true" : "false");
  if (open && cls === "vn-backlog") s.querySelector(".story-stream")?.lastElementChild?.scrollIntoView?.({ block: "end" });
}
function closeSheets() {
  sheetOpen = null;
  for (const s of storyMount?.querySelectorAll(".vn-sheet.open") || []) {
    s.classList.remove("open"); s.setAttribute("aria-hidden", "true");
    storyMount.querySelector(`[aria-controls="${s.id}"]`)?.setAttribute("aria-expanded", "false");
  }
}

/* ---------------------------------------------------------------- beats (the backlog) */

function diceRow(dice) {
  return el("div", { class: "dice-row small", "aria-label": `Dice: ${dice.join(", ")}` }, ...dice.map((v, i) => dieEl(v, i)));
}

function beatEl(e) {
  const ico = { note: "pen", roll: "die", solo: "solo", lifecycle: "play", state: "hero" }[e.kind] || "burst";
  const sixes = e.detail?.sixes;
  return el("article", { class: `beat beat-${e.kind}${e.kind === "roll" ? (sixes ? " ok" : " miss") : ""}` },
    el("span", { class: "beat-ico", "aria-hidden": "true" }, icon(ico, { size: 14 })),
    el("div", { class: "beat-main" },
      el("p", { class: e.kind === "note" ? "jr-text written" : "jr-text", text: e.text }),
      e.kind === "roll" && e.detail?.dice?.length ? diceRow(e.detail.dice) : null,
      e.note ? el("p", { class: "jr-note", text: e.note }) : null));
}

/* ---------------------------------------------------------------- the scene (the stage) */

/** Which picture, and which mood, a beat is drawn with. Decorative: the caption carries the content. */
function sceneLook(e, hero) {
  const t = e?.text || "";
  const colour = roleColour(hero.identity.role);
  if (!e) return { mood: "calm", art: [skyline(), el("span", { class: "vn-figure" }, heroFigure(colour))] };
  if (e.kind === "note") return { mood: "calm", art: [skyline(), el("span", { class: "vn-figure" }, heroFigure(colour))] };
  if (e.kind === "roll") return { mood: e.detail?.sixes ? "good" : "grim", art: [skyline(), el("span", { class: "vn-burst" }, icon("burst", { size: 160 }))] };
  if (e.kind === "state") return { mood: "danger", art: [skyline(), el("span", { class: "vn-mask" }, villainMask())] };
  if (e.kind === "lifecycle") return { mood: "calm", art: [el("span", { class: "vn-hq" }, headquarters())] };
  if (/Encounter|presence|spotted/i.test(t)) return { mood: "grim", art: [el("span", { class: "vn-radar" }, radar(3))] };
  if (/Opportunity/i.test(t)) return { mood: "good", art: [skyline(), el("span", { class: "vn-figure" }, heroFigure(colour))] };
  if (/alert|Crisis event|fired|NOW/i.test(t)) return { mood: "danger", art: [skyline(), el("span", { class: "vn-mask" }, villainMask())] };
  return { mood: "night", art: [skyline()] };
}

/** Type a caption in, a few characters a frame; a tap on the stage finishes it at once. */
function typeIn(p, text) {
  if (typer) { clearInterval(typer.id); typer.done(); typer = null; }
  if (motionOff() || text.length < 4) { p.textContent = text; return; }
  p.textContent = "";
  p.classList.add("typing");
  let i = 0;
  const done = () => { p.textContent = text; p.classList.remove("typing"); };
  const id = setInterval(() => {
    i = Math.min(text.length, i + 2);
    p.textContent = text.slice(0, i);
    if (i >= text.length) { clearInterval(id); typer = null; done(); }
  }, 16);
  typer = { id, done };
}
function finishTyping() { if (typer) { clearInterval(typer.id); typer.done(); typer = null; } }

function issueNumber(sessionId) {
  const all = Journal.listSessions().slice().reverse();          // oldest first
  const i = all.findIndex((s) => s.id === sessionId);
  return i >= 0 ? i + 1 : all.length + 1;
}

function sceneEl(e, hero, { animate }) {
  const look = sceneLook(e, hero);
  const scene = el("section", { class: `vn-scene mood-${look.mood}${animate ? " enter" : ""}`, "aria-label": "This moment" },
    el("div", { class: "vn-art", "aria-hidden": "true" }, ...look.art));
  const card = el("div", { class: "vn-caption" });
  if (!e) {
    const j = Journal.load();
    const prev = j.entries.filter((x) => x.sessionId && (!x.characterId || x.characterId === hero.id)).sort((a, b) => (a.seq || 0) - (b.seq || 0)).slice(-1)[0];
    // A crisis already in flight (paused, or carried over) is what the cover shows: saying the
    // emergency is "one tap away" while one is running read as if the game had not started.
    const st = soloActions.state();
    const live = st.alertParts?.headline || st.alert || "";
    card.append(
      el("p", { class: "story-kicker", text: `Issue #${issueNumber(null)}${live ? " · in progress" : ""}` }),
      el("h2", { class: "vn-title", text: hero.identity.heroName || hero.identity.realName || "Your hero" }),
      live ? el("p", { class: "vn-text", text: `The crisis: ${live}` }) : null,
      live ? el("p", { class: "vn-text vn-hint", text: "Pick a move below to carry on." })
        : prev ? el("p", { class: "vn-text", text: `Previously… ${prev.text}` })
          : el("p", { class: "vn-text", text: "Tonight's emergency is one tap away." }));
  } else {
    const kicker = { note: "You", roll: e.detail?.sixes ? "Success" : "No luck", state: "Ouch", lifecycle: "Scene", solo: "Meanwhile…" }[e.kind] || "Meanwhile…";
    const p = el("p", { class: e.kind === "note" ? "vn-text written" : "vn-text" });
    card.append(el("p", { class: "story-kicker", text: kicker }), p);
    if (e.kind === "roll" && e.detail?.dice?.length) card.append(diceRow(e.detail.dice));
    if (e.note) card.append(el("p", { class: "vn-text written vn-note", text: e.note }));
    if (animate) typeIn(p, e.text || ""); else p.textContent = e.text || "";
  }
  scene.append(card);
  scene.addEventListener("click", finishTyping);
  return scene;
}

/** Issue #N complete: the beat count, the karma the hero now holds, and the way on. */
function splashEl(hero, sessionId) {
  const n = issueNumber(sessionId);
  const beats = Journal.load().entries.filter((x) => x.sessionId === sessionId).length;
  return el("section", { class: "vn-scene vn-splash mood-good enter", "aria-label": `Issue ${n} complete` },
    el("div", { class: "vn-art", "aria-hidden": "true" }, skyline(), el("span", { class: "vn-burst" }, icon("burst", { size: 220 }))),
    el("div", { class: "vn-caption" },
      el("p", { class: "story-kicker", text: "The end… for now" }),
      el("h2", { class: "vn-title", text: `Issue #${n} complete` }),
      el("div", { class: "vn-tally" },
        el("span", {}, el("strong", { text: String(beats) }), el("small", { text: "beats" })),
        el("span", {}, el("strong", { text: String(hero.state.karma) }), el("small", { text: "karma" })),
        el("span", {}, el("strong", { text: String(crisisNow().level) }), el("small", { text: "crisis" }))),
      el("div", { class: "vn-splash-actions" },
        el("button", { class: "btn primary big", "data-choice": "next-issue", onclick: () => { splash = null; schedule(); } }, "Next issue"),
        el("a", { class: "btn ghost", href: "#/journal" }, "Read this issue"))));
}

/* ---------------------------------------------------------------- render */

export function renderStory(mount, { keepScroll = false } = {}) {
  storyMount = mount;
  clear(mount);
  const hero = Store.activeCharacter();
  if (!hero) {
    mount.append(el("div", { class: "empty" },
      el("h2", { text: "No hero yet" }),
      el("p", { text: "The story needs someone to follow." }),
      el("a", { class: "btn primary", href: "#/home" }, "Start Issue #1")));
    return;
  }
  void keepScroll;

  const combat = combatActions.combat();
  const fighting = !!(combat?.active && combat.combatants?.length);
  const st = soloActions.state();
  const cn = crisisNow();
  const step = soloActions.step();
  const sum = Derived.summary(hero);

  // ---- the open session; a session that closed since the last render brings up the splash.
  const j = Journal.load();
  const open = Journal.openSession(j);
  if (watchedSession && !open && j.sessions.some((s) => s.id === watchedSession && s.endedAt)) splash = { sessionId: watchedSession };
  if (open) splash = null;
  watchedSession = open?.id || null;
  const mine = (e) => !e.characterId || e.characterId === hero.id;
  const list = open ? j.entries.filter((e) => e.sessionId === open.id && mine(e)).sort((a, b) => (a.seq || 0) - (b.seq || 0)) : [];
  const latest = list[list.length - 1] || null;

  // ---- HUD: the hero's tracks, the crisis dial, where you are, the menu. A change pulses.
  const status = { level: cn.level, step, timers: (st.timers || []).length, round: fighting ? combat.round : 0, health: hero.state.health, resolve: hero.state.resolve };
  const changed = (k) => last && last[k] !== status[k] ? "pulse" : "";
  const meter = (k, label, now, max) => el("span", { class: `vn-meter ${k} ${changed(k)}`, role: "img", "aria-label": `${label} ${now} of ${max}` },
    el("small", { text: label }),
    el("span", { class: "vn-bar" }, el("span", { style: `width:${max ? Math.max(0, Math.min(100, (100 * now) / max)) : 0}%` })),
    el("strong", { text: `${now}` }));
  const strip = el("div", { class: "story-status vn-hud", role: "status" },
    meter("health", "Health", hero.state.health, sum.maxHealth),
    meter("resolve", "Resolve", hero.state.resolve, sum.maxResolve),
    el("span", { class: `story-dial ${changed("level")}` }, crisisDial(cn.level, `Crisis level ${cn.level} of 10`)),
    el("span", { class: `story-stat ${changed("step")}` }, el("small", { text: fighting ? "Fight" : `Crisis ${cn.level}` }),
      el("strong", { text: fighting ? `Rd ${combat.round}` : `${step + 1}/6` })),
    el("button", { class: "icon-btn vn-menu-btn", "aria-label": "Menu", "aria-expanded": sheetOpen === "vn-menu" ? "true" : "false", "aria-controls": "vn-menu", onclick: () => toggleSheet("vn-menu") }, icon("more", { size: 20 })));
  const hit = last && hero.state.health < (lastHealth ?? hero.state.health);
  last = status;
  lastHealth = hero.state.health;

  // ---- the stage: the splash, a waiting result, or the latest beat.
  const showing = splash ? `splash:${splash.sessionId}` : latest?.id || "cover";
  const animate = showing !== shownId;
  shownId = showing;
  const stage = el("div", { class: "vn-stage" },
    splash ? splashEl(hero, splash.sessionId) : sceneEl(latest, hero, { animate }),
    el("div", { class: "story-pending" }, ...pending));

  // ---- the balloon: what does your hero do? Tap to write; never required.
  const q = open || !(st.alert || st.alertParts) ? promptFor(open ? latest : null) : "Where is your hero right now, and what are they doing?";
  const ta = el("textarea", { class: "input story-text", rows: "3", placeholder: q, "aria-label": q });
  ta.value = draft;
  ta.addEventListener("input", () => { draft = ta.value; });
  const saveNote = () => {
    const text = ta.value.trim();
    if (!text) return;
    if (!Journal.openSession()) Journal.startSession("", hero.id);
    Journal.addNote(text, hero.id);
    draft = ""; writing = false;
  };
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveNote(); } });
  const write = el("div", { class: `story-write ${writing ? "open" : ""}`, id: "vn-write" },
    el("label", { class: "story-q", text: q }), ta,
    el("div", { class: "row-actions" },
      el("button", { class: "btn tiny primary", onclick: saveNote }, icon("pen", { size: 14 }), " Write it"),
      el("button", { class: "btn tiny ghost", onclick: () => { writing = false; write.classList.remove("open"); } }, "Not now")));
  const balloon = el("button", { class: `vn-balloon ${writing ? "hidden" : ""}`, "aria-controls": "vn-write", "aria-expanded": writing ? "true" : "false",
    onclick: () => { writing = true; write.classList.add("open"); balloon.classList.add("hidden"); ta.focus(); } },
    icon("pen", { size: 16 }), el("span", { text: draft ? `“${draft.slice(0, 40)}${draft.length > 40 ? "…" : ""}”` : q }));

  // ---- choices: big icon cards; the detail is in each card's description, not on screen.
  const boardMount = el("div", { class: "story-board-solo" });
  const combatMount = el("div", { class: "story-board-combat" });
  const mounts = { board: boardMount, combat: combatMount };
  const opts = fighting ? fightChoices(combat, mounts) : loopChoices(mounts);
  const run = async (fn) => { closeSheets(); try { await fn(); } catch (err) { console.error(err); showToast(String(err.message || err), { variant: "danger" }); } schedule(); };
  const up = fighting ? currentTurn(combat) : null;
  const choices = el("nav", { class: "story-choices", "aria-label": "What happens next" },
    el("p", { class: "story-kicker", text: fighting ? `Round ${combat.round} — ${up?.name ? `${up.name} acts` : "everyone has acted"}` : "What happens next?" }),
    ...opts.map((o) => el("button", { class: `story-choice ${o.primary ? "primary" : ""}`, "data-choice": o.key, title: o.hint || o.label,
      "aria-description": o.hint || null, onclick: () => run(o.run) },
      el("span", { class: "choice-ico", "aria-hidden": "true" }, icon(o.ico, { size: 26 })),
      el("strong", { text: o.label }))));

  // ---- the menu: everything that is not the next move.
  // A menu item that opens another sheet or the board keeps the screen as it is; one that runs a
  // move closes the menu first and redraws after, like a choice.
  const menuItem = (label, ico, onclick, extra = {}) => el("button", { class: "vn-menu-item", onclick: () => (extra.stay ? onclick() : run(onclick)), ...extra, stay: null },
    el("span", { class: "choice-ico", "aria-hidden": "true" }, icon(ico, { size: 20 })), el("span", { text: label }));
  const sheetAttrs = (cls) => ({ class: `vn-sheet ${cls}${sheetOpen === cls ? " open" : ""}`, id: cls, "aria-hidden": sheetOpen === cls ? "false" : "true" });
  const menu = el("div", { ...sheetAttrs("vn-menu"), "aria-label": "Menu" },
    el("div", { class: "vn-sheet-head" }, el("h2", { text: "Menu" }),
      el("button", { class: "icon-btn", "aria-label": "Close the menu", onclick: closeSheets }, icon("close", { size: 18 }))),
    el("div", { class: "vn-menu-grid" },
      menuItem("Story so far", "journal", () => toggleSheet("vn-backlog"), { "aria-controls": "vn-backlog", stay: true }),
      menuItem(fighting ? "The fight board" : "Timers & crises", "map", () => openBoard(fighting ? null : "solo-timers"), { "aria-controls": "story-board", stay: true }),
      menuItem("Which dice do I roll?", "die", () => openAttributeGuide()),
      fighting ? null : menuItem("Something else…", "question", () => soloActions.move(boardMount), { "data-choice": "else" }),
      !fighting && step === 3 && st.alert ? menuItem("Resolve the crisis", "check", () => soloActions.resolve(boardMount), { "data-choice": "resolve" }) : null,
      !fighting && soloActions.inSession() && step !== 5 ? menuItem("Stop for tonight", "clock", () => soloActions.stop(boardMount), { "data-choice": "stop" }) : null,
      menuItem("My hero", "hero", () => { location.hash = "#/sheet"; }),
      menuItem("How do I play?", "learn", () => { setLearnTab("walkthrough"); location.hash = "#/learn"; }),
      menuItem("Leave to the title screen", "home", () => { location.hash = "#/home"; })));

  // ---- the backlog: the open session, one beat per entry — the journal as it is being written.
  const stream = el("div", { class: "story-stream", role: "log", "aria-label": "The story so far" },
    ...(list.length ? list.map(beatEl) : [el("p", { class: "muted", text: "Nothing yet — this fills in as you play." })]));
  const backlog = el("div", { ...sheetAttrs("vn-backlog"), "aria-label": "The story so far" },
    el("div", { class: "vn-sheet-head" }, el("h2", { text: open ? (Journal.listSessions().find((s) => s.id === open.id)?.label || "Tonight") : "The story so far" }),
      el("button", { class: "icon-btn", "aria-label": "Close the story so far", onclick: closeSheets }, icon("close", { size: 18 }))),
    stream);

  // ---- the board drawer: everything the dashboard held, beside the story.
  const board = el("aside", { class: `story-board ${boardOpen ? "open" : ""}`, id: "story-board", "aria-label": "The board", "aria-hidden": boardOpen ? "false" : "true" },
    el("div", { class: "story-board-head" }, el("h2", { text: fighting ? "The fight and the board" : "The board" }),
      el("button", { class: "icon-btn story-board-close", "aria-label": "Close the board", onclick: closeBoard }, icon("close", { size: 18 }))),
    fighting ? combatMount : null, boardMount);
  // The board button in the HUD is for wide screens' parity with phones; the menu also opens it.
  strip.insertBefore(el("button", { class: "btn tiny story-board-btn", "aria-expanded": boardOpen ? "true" : "false", "aria-controls": "story-board",
    onclick: () => (boardOpen ? closeBoard() : openBoard()) }, icon("map", { size: 16 }), el("span", { class: "sr-only", text: "Board" })), strip.lastElementChild);

  const root = el("div", { class: `story vn${hit && !motionOff() ? " vn-hit" : ""}` },
    el("div", { class: "story-main" }, strip, stage, splash ? null : balloon, splash ? null : write, splash ? null : choices),
    board, menu, backlog);
  mount.append(root);
  if (hit && !motionOff()) setTimeout(() => root.classList.remove("vn-hit"), 450);
  // The board renders into the drawer once it is in the document (it looks up its own panels).
  if (fighting) renderCombat(combatMount);
  renderSolo(boardMount);
  document.body.dataset.crisis = st.alert ? cn.phase.key : "";
  window.scrollTo(0, 0);
}
