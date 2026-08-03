// docs/build-guide.mjs — renders docs/solo-guide.html and docs/solo-guide.pdf.
//
// Every die in the worked session is rolled by the app's own solo engines, in a browser page that
// has loaded the real modules. Math.random is replaced with a seeded generator first, so a rebuild
// reproduces the same session byte for byte while still exercising the shipped code paths.
//
//   npm run guide

import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildHtml } from "./guide-content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8231;
const SEED = 58622;   // chosen so the worked session exercises every mechanic; no result edited
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const found = [];
  try {
    for (const dir of fs.readdirSync(root)) {
      if (!/^chromium/.test(dir)) continue;
      for (const bin of ["chrome-linux/chrome", "chrome-linux/headless_shell"]) {
        const p = path.join(root, dir, bin);
        if (fs.existsSync(p)) found.push(p);
      }
    }
  } catch { /* fall through */ }
  found.sort((a) => (a.includes("headless_shell") ? 1 : -1));
  return found[0] || "chromium";
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]);
      const file = path.join(ROOT, rel === "/" ? "index.html" : rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end("not found"); return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(fs.readFileSync(file));
    });
    server.listen(PORT, () => resolve(server));
  });
}

/** Play one complete crisis through the shipped engines and record every roll. */
async function playSession(page) {
  return page.evaluate(async (seed) => {
    // Mulberry32: seeded, so the printed session is reproducible across rebuilds.
    let a = seed >>> 0;
    Math.random = () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const Solo = await import("/src/solo.js");
    const S = await import("/data-solo.js");
    const log = [];
    const state = { crisisLevel: 0, alert: "", crises: [], timers: [], allies: [], objectives: [],
      encounter: null, mode: "alert", log: [], eventChecks: 0, awaitingSocial: false, resolved: 0 };

    // Step 2 — the first event check.
    const ev1 = Solo.rollEventCheck(state);
    log.push({ beat: "event1", value: ev1.value, text: ev1.entry.text, extra: ev1.extra, rolls: ev1.rolls,
      level: state.crisisLevel });

    // Step 3 — engage, and start the objective the hero is actually there for.
    state.timers.push({ id: "t1", name: "The reactor floods the lower decks", proximity: "distant" });
    state.objectives.push({ id: "o1", name: "Get the maintenance crew out", status: "farOff", karma: 4 });
    const objRung = S.OBJECTIVE_TIMER.ladder.find((l) => l.key === "farOff");
    log.push({ beat: "engage", timer: state.timers[0].name, proximity: "distant",
      objective: state.objectives[0].name, objRung: objRung.name, objDice: objRung.dice, objKarma: objRung.karma });

    // Step 4 — moving into an unknown deck: encounter timer, then the move.
    state.encounter = { presence: "allClear", phase: "moving" };
    const sweep = [];
    for (let zone = 0; zone < 4 && !sweep.some((x) => x.behaviour); zone++) {
      const r = Solo.rollEncounter(state);
      sweep.push({ dice: r.dice, faces: r.faces, sixes: r.sixes, presence: r.presence.name,
        evidence: r.evidence?.text || null, behaviour: r.behaviour?.name || null,
        behaviourEffect: r.behaviour?.effect || null, threat: r.threat?.name || null,
        threatExamples: r.threat?.examples || null });
    }
    log.push({ beat: "sweep", checks: sweep });
    const enc1 = { presence: { name: sweep[0].presence } };

    const tim1 = Solo.rollTimer(state, state.timers[0], 0);
    log.push({ beat: "timer1", dice: tim1.dice, faces: tim1.faces, sixes: tim1.sixes,
      from: "Distant", to: tim1.name, fired: tim1.fired });

    // A milestone: the crew is found. Objective check.
    const obj1 = Solo.rollObjective(state, state.objectives[0]);
    log.push({ beat: "obj1", dice: obj1.dice, faces: obj1.faces, sixes: obj1.sixes, ones: obj1.ones,
      net: obj1.net, from: "Far off", message: obj1.message, penalty: obj1.penalty });

    // Searching the deck costs time: encounter again, crisis timer at +1 die.
    // A timer that fires is removed, and the rules say to start another straight away.
    let replaced = null;
    if (!state.timers.length) {
      replaced = "The hull gives way at the waterline";
      state.timers.push({ id: "t2", name: replaced, proximity: "distant" });
    }
    const tim2 = Solo.rollTimer(state, state.timers[0], 1);
    log.push({ beat: "timer2", dice: tim2.dice, faces: tim2.faces, sixes: tim2.sixes,
      to: tim2.name, fired: tim2.fired, replaced, timerName: state.timers[0]?.name || replaced });

    // Second event check, after the fight.
    const ev2 = Solo.rollEventCheck(state);
    log.push({ beat: "event2", value: ev2.value, text: ev2.entry.text, extra: ev2.extra,
      rolls: ev2.rolls, level: state.crisisLevel });

    // An ally group holding the bulkhead.
    state.allies.push({ id: "a1", name: "Dock crew", status: "unified" });
    const ally1 = Solo.rollAlly(state, state.allies[0], 2, true);
    log.push({ beat: "ally1", dice: ally1.dice, faces: ally1.faces, sixes: ally1.sixes,
      ones: ally1.ones, damage: ally1.damage, to: ally1.status, text: ally1.text });

    // The oracles.
    const opp = Solo.rollOpportunity();
    log.push({ beat: "opportunity", value: opp.value, text: opp.text });
    state.crisisLevel = Math.min(10, state.crisisLevel + 1);   // the jolt costs a level
    const jolt = Solo.rollCrisisEvent(state);
    log.push({ beat: "crisisEvent", focusRoll: jolt.focusRoll, detailRoll: jolt.detailRoll,
      focus: jolt.focus, detail: jolt.detail, band: jolt.band.label });

    // Final push on the objective, now at a higher crisis level.
    const obj2 = Solo.rollObjective(state, state.objectives[0]);
    log.push({ beat: "obj2", dice: obj2.dice, faces: obj2.faces, sixes: obj2.sixes, ones: obj2.ones,
      net: obj2.net, message: obj2.message, penalty: obj2.penalty, level: state.crisisLevel });

    return { log, finalLevel: state.crisisLevel, phase: Solo.phaseFor(state.crisisLevel).name };
  }, SEED);
}

const server = await serve();
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || findChromium(),
  args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForFunction(() => document.body.dataset.ready === "true", { timeout: 20000 });

const session = await playSession(page);
const tables = await page.evaluate(async () => {
  const S = await import("/data-solo.js");
  return {
    loop: S.SOLO_SETUP.loop, build: S.SOLO_SETUP.build, alertNote: S.SOLO_SETUP.alertNote,
    socialScenes: S.SOLO_SETUP.socialScenes, recovery: S.SOLO_SETUP.recovery,
    phases: S.CRISIS_LEVEL.phases, eventCheck: S.EVENT_CHECK.entries,
    binary: S.BINARY_ENGINE.entries, bonusSix: S.BONUS_SIX_EFFECTS,
    crisisLadder: S.CRISIS_TIMER.ladder, crisisStart: S.CRISIS_TIMER.startByPhase,
    allyLadder: S.ALLY_TIMER.ladder, objectiveLadder: S.OBJECTIVE_TIMER.ladder,
    encounterLadder: S.ENCOUNTER_TIMER.ladder, behaviour: S.ENEMY_BEHAVIOUR, threat: S.ENEMY_THREAT,
    escape: S.ESCAPE_MODIFIERS, avoiding: S.AVOIDING_ENCOUNTERS, sequence: S.ENCOUNTER_SEQUENCE,
    modes: S.MOVEMENT_MODES, powerUse: S.SOLO_POWER_USE, combat: S.SOLO_COMBAT,
    locations: Object.values(S.LOCATION_ENGINES).map((e) => ({ name: e.name, note: e.note })),
    opportunity: S.OPPORTUNITY_ENGINE.entries,
    crisisBands: S.CRISIS_EVENT_ENGINE.bands.map((b) => b.label),
    crisisFocuses: S.CRISIS_EVENT_ENGINE.entries.length,
    crisisEntries: S.CRISIS_EVENT_ENGINE.entries, crisisNote: S.CRISIS_EVENT_ENGINE.note,
    complexDirectives: S.COMPLEX_ENGINE.directives, complexSubjects: S.COMPLEX_ENGINE.subjects,
  };
});

const html = buildHtml({ session, tables });
fs.writeFileSync(path.join(ROOT, "docs/solo-guide.html"), html);

await page.setContent(html, { waitUntil: "load" });
await page.emulateMedia({ media: "print" });
await page.pdf({
  path: path.join(ROOT, "docs/solo-guide.pdf"),
  format: "A4", printBackground: true,
  margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
  displayHeaderFooter: true,
  headerTemplate: '<div style="font:8pt Georgia,serif;width:100%;padding:0 16mm;color:#000;">Invincible — Solo Play Guide</div>',
  footerTemplate: '<div style="font:8pt Georgia,serif;width:100%;padding:0 16mm;text-align:right;color:#000;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
});

await browser.close();
server.close();
const kb = (fs.statSync(path.join(ROOT, "docs/solo-guide.pdf")).size / 1024).toFixed(0);
console.log(`docs/solo-guide.pdf written (${kb} KB), docs/solo-guide.html written.`);
