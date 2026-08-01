// learn.js — the Learn screen: a first-time-player tutorial and a Crisis Mode solo tutorial.
// Every demo runs on a disposable copy of TUTORIAL_HERO. Nothing here touches the player's
// characters, and no demo roll is written to the shared roll log.

import { el, clear, d6, d66, roll2d6, pool, countSixes, countOnes, tableLookup } from "./core.js";
import { showToast, announce, helpPanel } from "./ui.js";
import * as R from "./rules.js";
import { D } from "./rules.js";
import * as Derived from "./derived.js";
import * as S from "../data-solo.js";
import { Settings } from "./settings.js";
import { TUTORIAL_HERO, TUTORIAL_INDEX } from "../data-tutorial.js";

/* ---------------------------------------------------------------- the example hero */

/** A real, legal character built from the tutorial spec — never saved. */
export function exampleHero() {
  const c = Derived.blankCharacter({ id: "tutorial_example" });
  c.identity = { ...c.identity, ...TUTORIAL_HERO, pregen: false };
  c.attributes = { ...TUTORIAL_HERO.attributes };
  c.powers = TUTORIAL_HERO.powers.map((p) => ({ ...p }));
  c.talents = TUTORIAL_HERO.talents.map((t) => ({ ...t }));
  c.state.health = Derived.maxHealth(c);
  c.state.resolve = Derived.maxResolve(c);
  return c;
}

let activeTab = "basics";

/** Lets another screen deep-link a specific tutorial — the Solo tab points at the solo walkthrough. */
export function setLearnTab(key) {
  if (TUTORIAL_INDEX.some((t) => t.key === key)) activeTab = key;
}

/* ---------------------------------------------------------------- render */

export function renderLearn(mount) {
  clear(mount);
  const hero = exampleHero();

  mount.append(el("section", { class: "card" },
    el("h2", { text: "Learn" }),
    el("p", { class: "muted small", text: "Step-by-step tutorials with worked examples. The demo buttons roll real dice on an example hero — your own characters are never touched." }),
    el("div", { class: "chiprow" }, ...TUTORIAL_INDEX.map((t) => el("button", {
      class: `chip selectable ${activeTab === t.key ? "selected" : ""}`,
      onclick: () => { activeTab = t.key; renderLearn(mount); },
    }, t.name))),
    el("p", { class: "muted small", text: TUTORIAL_INDEX.find((t) => t.key === activeTab).desc })));

  mount.append(heroCard(hero));

  const tut = TUTORIAL_INDEX.find((t) => t.key === activeTab);
  tut.chapters.forEach((ch, i) => mount.append(chapterCard(ch, i === 0, hero, mount)));

  if (activeTab === "solo") {
    mount.append(el("section", { class: "card" },
      el("h3", { text: "Ready to play" }),
      el("p", { class: "small", text: "Turn Crisis Mode on and the Solo tab appears in the bottom bar." }),
      el("div", { class: "row-actions" },
        el("button", { class: "btn primary", onclick: () => enableSolo(true) }, "Turn on Crisis Mode"),
        el("a", { class: "btn", href: "#/solo", onclick: () => enableSolo(false) }, "Open the Solo tab"))));
  } else {
    mount.append(el("section", { class: "card" },
      el("h3", { text: "Ready to play" }),
      el("div", { class: "row-actions" },
        el("a", { class: "btn primary", href: "#/create" }, "Create your hero"),
        el("a", { class: "btn", href: "#/rules" }, "Rules library"))));
  }
}

function enableSolo(toast = true) {
  Settings.set("soloMode", true);
  document.dispatchEvent(new CustomEvent("nav-refresh"));
  if (toast) showToast("Crisis Mode on — the Solo tab is in the bottom bar.", { variant: "good", timeout: 6000 });
}

function heroCard(hero) {
  const s = Derived.summary(hero);
  return el("section", { class: "card" },
    el("h3", { text: `Example hero — ${TUTORIAL_HERO.heroName}` }),
    helpPanel([
      "Every worked example below uses this hero, so the numbers always line up.",
      TUTORIAL_HERO.note,
      "She is not in your roster and nothing you do here changes her.",
    ]),
    el("p", { class: "stat-line", text: D.ATTRIBUTES.map((a) => `${a.short} ${hero.attributes[a.key]}`).join(" · ") }),
    el("p", { class: "stat-line", text: `Health ${s.maxHealth} · Resolve ${s.maxResolve} · Slugfest ${s.slugfest} · Armor ${s.armor.value} · ${R.findRank(hero.identity.rank).name}` }),
    el("p", { class: "stat-line", text: `Powers: ${hero.powers.map((p) => R.powerDisplayName(p)).join(", ")} · Talents: ${hero.talents.map((t) => t.name).join(", ")}` }));
}

function chapterCard(ch, open, hero, mount) {
  const card = el("section", { class: "card" },
    el("h3", { text: ch.title }),
    el("p", { class: "muted", text: ch.intro }));
  const list = el("ol", { class: "tutorial-steps" });
  for (const step of ch.steps) {
    const li = el("li", {}, el("p", { text: step.text }));
    if (step.example) li.append(el("p", { class: "tut-example" }, el("strong", { text: "Example: " }), step.example));
    if (step.app) li.append(el("p", { class: "tut-app" }, el("strong", { text: "In the app: " }), step.app));
    if (step.demo) {
      const out = el("div", { class: "tut-demo-out", "aria-live": "polite" });
      li.append(el("button", { class: "btn tiny primary", onclick: () => runDemo(step.demo, out, hero) }, "Try it"), out);
    }
    list.append(li);
  }
  card.append(list);
  return card;
}

/* ---------------------------------------------------------------- demos */

const dice = (faces) => el("div", { class: "dice-row" },
  ...faces.map((v) => el("span", { class: `die ${v === 6 ? "six" : v === 1 ? "one" : ""}`, text: String(v) })));

function say(out, ...nodes) { clear(out); out.append(...nodes.filter(Boolean)); }

function runDemo(kind, out, hero) {
  const DEMOS = {
    pool: () => {
      const faces = pool(hero.attributes.fighting);
      const six = countSixes(faces);
      say(out, dice(faces), el("p", { class: six ? "good" : "bad",
        text: six ? `${six} six${six === 1 ? "" : "es"} — success${six > 1 ? `, with ${six - 1} stunt(s)` : ""}.` : "No 6s — the attempt fails, but the story still moves." }));
      announce(`Rolled ${six} successes.`);
    },
    push: () => {
      const first = pool(hero.attributes.fighting);
      const kept = first.filter((v) => v === 6 || v === 1);
      const rerolled = pool(first.length - kept.length);
      const after = [...kept, ...rerolled];
      const cost = countOnes(after);
      say(out,
        el("p", { class: "small", text: `First roll — ${countSixes(first)} six(es):` }), dice(first),
        el("p", { class: "small", text: `Keep the 6s and the 1s, re-roll the other ${first.length - kept.length}:` }), dice(after),
        el("p", { class: countSixes(after) ? "good" : "bad", text: `${countSixes(after)} six(es) now.` }),
        el("p", { class: cost ? "warn" : "muted", text: cost ? `${cost} one(s) showing → ${cost} Resolve spent.` : "No 1s — the push was free." }));
    },
    attack: () => {
      const faces = pool(hero.attributes.fighting);
      const six = countSixes(faces);
      const dmg = Derived.slugfestDamage(hero);
      say(out, dice(faces),
        el("p", { class: six ? "good" : "bad", text: six ? `Hit for ${dmg} damage, before the target's armor.` : "Miss." }),
        six > 1 ? el("p", { class: "small", text: `${six - 1} stunt(s): ${D.SLUGFEST_STUNTS.slice(0, 3).map((s) => s.name).join(", ")}…` }) : null);
    },
    damage: () => {
      const armor = Derived.armorRating(hero).value;
      const raw = 9 + d6();
      const after = Math.max(0, raw - armor);
      const hp = Derived.maxHealth(hero);
      const left = hp - after;
      if (left > 0) {
        say(out, el("p", { text: `${raw} damage − ${armor} armor = ${after}. Health ${hp} → ${left}. Still standing.` }));
        return;
      }
      const excess = after - hp;
      const die = d6();
      const entry = R.critEntry(die + excess, Settings.familyFriendly());
      say(out,
        el("p", { text: `${raw} damage − ${armor} armor = ${after}, against ${hp} Health → broken, with ${excess} to spare.` }),
        el("p", { class: "small", text: `Critical injury: D6 (${die}) + ${excess} excess = ${die + excess}.` }),
        el("p", { class: "bad" }, el("strong", { text: `${entry.roll}. ${entry.name} ` }), entry.desc),
        el("p", { class: "muted small", text: `Healing time: ${entry.healing}` }));
    },
    eventCheck: () => {
      const v = roll2d6();
      const entry = tableLookup(S.EVENT_CHECK.entries, v);
      say(out, el("p", { class: "lede", text: `2D6 → ${v}` }), el("p", { text: entry.text }));
    },
    binary: () => {
      const a = d6(), b = d6(), v = Math.min(a, b);
      const entry = tableLookup(S.BINARY_ENGINE.entries, v);
      say(out, dice([a, b]), el("p", { class: "small", text: "\"No\" was likely, so keep the lowest." }),
        el("p", { class: "lede", text: entry.text }));
    },
    complex: () => {
      const dr = d66(), sr = d66();
      say(out, el("p", { class: "lede big", text: `${S.COMPLEX_ENGINE.directives[dr]} ${S.COMPLEX_ENGINE.subjects[sr]}` }),
        el("p", { class: "muted small", text: `Directive ${dr} · Subject ${sr}` }));
    },
    crisisTimer: () => {
      const ladder = S.CRISIS_TIMER.ladder;
      const rung = ladder[0];
      const faces = pool(rung.dice);
      const six = countSixes(faces);
      const next = ladder[Math.min(ladder.length - 1, six)];
      say(out, el("p", { class: "small", text: `Starting at ${rung.name} — ${rung.dice} threat dice.` }), dice(faces),
        el("p", { class: six ? "warn" : "good", text: `${six} six(es) → now ${next.name}.` }),
        next.key === "now" ? el("p", { class: "bad", text: "It happens. Crisis level +1, and this timer is done." }) : null);
    },
    objective: () => {
      const rung = S.OBJECTIVE_TIMER.ladder[1];
      const faces = pool(rung.dice);
      const six = countSixes(faces), ones = countOnes(faces), net = six - ones;
      const idx = 1 + (net > 0 ? net : net < 0 ? -1 : 0);
      const to = S.OBJECTIVE_TIMER.ladder[Math.max(0, Math.min(S.OBJECTIVE_TIMER.ladder.length - 1, idx))];
      say(out, el("p", { class: "small", text: `${rung.name} — ${rung.dice} progress dice.` }), dice(faces),
        el("p", { text: `${six} six(es) − ${ones} one(s) = ${net}.` }),
        el("p", { class: net > 0 ? "good" : net < 0 ? "bad" : "muted",
          text: net > 0 ? `Advances to ${to.name}.` : net < 0 ? `Pushed back to ${to.name}.` : "No progress this time." }));
    },
    enableSolo: () => {
      enableSolo();
      say(out, el("p", { class: "good", text: "Crisis Mode is on. The Solo tab is now in the bottom bar." }));
    },
  };
  (DEMOS[kind] || (() => say(out, el("p", { class: "muted", text: "No demo for this step." }))))();
}
