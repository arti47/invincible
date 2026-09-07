// playthrough.mjs — play one complete solo session against the real app, and say where it stalls.
//
// Every other spec asks a structural question. This one asks the only question that matters to a
// person holding the app on a Saturday night: can you sit down, start a session, play it through,
// and finish — pressing only the controls the app actually offers?
//
// It drives the REAL UI, not the modules: it finds visible controls by their label, clicks them,
// answers whatever dialog appears, and writes down what happened. Reading state through the
// modules would prove the engine works while saying nothing about whether the game is playable.
//
// A STALL is the finding class this exists for: a beat where the app offered no way forward.
// Those are invisible to reachability (the control exists somewhere) and to coverage (the rule is
// implemented) — they only show up when someone tries to actually play.
//
//   node tests/playthrough.mjs            # seeded, reproducible
//   node tests/playthrough.mjs --seed 7   # a different session
//   node tests/playthrough.mjs --verbose  # every control considered, not just those pressed

import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PORT = 8124;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

const args = process.argv.slice(2);
const SEED = Number(args[args.indexOf("--seed") + 1]) || 1;
const VERBOSE = args.includes("--verbose");

/**
 * The harness's own deterministic PRNG, deliberately SEPARATE from the page's seeded Math.random.
 *
 * The playtester agent caught this: with every chooser answered by taking the first option, a
 * different seed changed only the dice and the flavour text, never which branch the session took.
 * All seeds walked the identical path — the same move three times — so no timer was ever started,
 * karma never left 0, and combat was never reached. "Run several seeds" was unbuyable advice.
 *
 * Keeping this stream separate from the app's means a dialog choice never shifts the app's dice,
 * so a given seed still reproduces exactly.
 */
let rngState = 0;
const seedRng = (n) => { rngState = (n >>> 0) || 1; };
const rnd = () => {
  rngState ^= rngState << 13; rngState ^= rngState >>> 17; rngState ^= rngState << 5;
  return ((rngState >>> 0) % 1e6) / 1e6;
};
const pickIndex = (n) => (n <= 1 ? 0 : Math.floor(rnd() * n) % n);

const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || findChromium();
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    for (const dir of fs.readdirSync(root)) {
      if (!/^chromium/.test(dir)) continue;
      const p = path.join(root, dir, "chrome-linux/chrome");
      if (fs.existsSync(p)) return p;
    }
  } catch { /* fall through */ }
  return "chromium";
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);
      const file = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end("nf"); return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(fs.readFileSync(file));
    });
    server.listen(PORT, () => resolve(server));
  });
}

/* ---------------------------------------------------------------- transcript */

const transcript = [];
const stalls = [];
const problems = [];
let beat = 0;

const say = (kind, text, detail) => {
  transcript.push({ kind, text, detail });
  const mark = { beat: "\n▶", app: "  ·", press: "  →", roll: "  ⚄", stall: "  ✗", note: "  ",
    state: "  ─" }[kind] || "  ";
  if (kind === "beat") beat++;
  console.log(`${mark} ${text}${detail ? `  ${detail}` : ""}`);
};

/* ---------------------------------------------------------------- driving the real UI */

async function visibleButtons(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll("#screen button, #screen a"))
    .filter((b) => (b.offsetParent || b.offsetWidth) && !b.disabled)
    .map((b) => (b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60))
    .filter(Boolean));
}

async function modalOpen(page) {
  return page.evaluate(() => !!document.querySelector(".modal-backdrop .modal"));
}

/**
 * Answer whatever dialog is open. Prefers the highlighted action, because that is what the app
 * says is the sensible default — the same thing a player would press. Chained dialogs are
 * followed until the screen is clear again, which is what actually happens in play.
 */
async function answerDialogs(page, { prefer = null, max = 8 } = {}) {
  const answered = [];
  for (let i = 0; i < max; i++) {
    if (!(await modalOpen(page))) break;
    // How many real options this dialog offers, so the harness can choose among them.
    const shape = await page.evaluate(() => {
      const m = document.querySelector(".modal-backdrop .modal");
      if (!m) return null;
      const vis = (b) => (b.offsetParent || b.offsetWidth) && !b.disabled;
      return { choices: Array.from(m.querySelectorAll(".choice")).filter(vis).length };
    });
    if (!shape) break;

    // A player TYPES. Several flows are prompt-driven — naming an objective, naming an ally
    // group — and clicking OK on an empty field silently discards them (`if (!name) return`).
    // Filling every empty field first is what makes those parts of the loop reachable at all.
    const filled = await page.evaluate(() => {
      const m = document.querySelector(".modal-backdrop .modal");
      if (!m) return 0;
      const vis = (e) => e.offsetParent || e.offsetWidth;
      let n = 0;
      for (const el of m.querySelectorAll("input, textarea")) {
        if (!vis(el) || el.disabled || el.type === "checkbox" || el.type === "radio") continue;
        if (String(el.value || "").trim()) continue;
        el.value = el.type === "number"
          ? (el.getAttribute("value") || el.min || "2")
          : (el.placeholder || "A thing worth doing");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        n++;
      }
      return n;
    });
    if (filled) say("note", `(typed into ${filled} empty field${filled === 1 ? "" : "s"})`);
    // A chooser list is the narrative decision — "what did your hero just do" — and is where the
    // session's path is actually decided, so it varies by seed. Plain buttons are confirmations;
    // those still take the highlighted action, which is what a player would press.
    const wantIndex = shape.choices ? pickIndex(shape.choices) : 0;

    const picked = await page.evaluate(({ want, idx }) => {
      const m = document.querySelector(".modal-backdrop .modal");
      if (!m) return null;
      const title = (m.querySelector("h1,h2,h3,.modal-title")?.textContent || "").trim();
      const vis = (b) => (b.offsetParent || b.offsetWidth) && !b.disabled;
      const btns = Array.from(m.querySelectorAll("button")).filter(vis);
      const label = (b) => (b.textContent || "").trim();
      const choices = Array.from(m.querySelectorAll(".choice")).filter(vis);
      let target = null;
      if (want) target = btns.find((b) => new RegExp(want, "i").test(label(b)));
      if (!target && choices.length) target = choices[idx] || choices[0];
      if (!target) target = btns.find((b) => /primary|danger|warn/.test(b.className));
      if (!target) target = btns.find((b) => !/cancel|not yet|no |close|back/i.test(label(b)));
      if (!target) target = btns[btns.length - 1];
      if (!target) return null;
      const chosen = label(target).slice(0, 50);
      target.click();
      return { title, chosen, options: btns.length + choices.length };
    }, { want: prefer, idx: wantIndex });
    if (!picked) break;
    answered.push(picked);
    say("app", `dialog: ${picked.title || "(untitled)"}`, `— chose "${picked.chosen}" of ${picked.options}`);
    await page.waitForTimeout(160);
  }
  return answered;
}

/** Press a control by label. Returns false when the app never offered it — that is a stall. */
async function press(page, pattern, { why = "", prefer = null, optional = false, exact = false } = {}) {
  const re = new RegExp(exact ? `^${pattern}$` : pattern, "i");
  const before = await visibleButtons(page);
  const hit = before.find((t) => re.test(t));
  if (!hit) {
    if (optional) { if (VERBOSE) say("note", `(no "${pattern}" here — skipped)`); return false; }
    stalls.push({ wanted: String(pattern), why, offered: before });
    say("stall", `nothing offered for "${pattern}"${why ? ` — ${why}` : ""}`,
      `\n      app offered: ${before.slice(0, 10).join(" | ") || "(nothing)"}`);
    return false;
  }
  say("press", `"${hit}"`);
  await page.evaluate((label) => {
    const b = Array.from(document.querySelectorAll("#screen button, #screen a"))
      .filter((x) => (x.offsetParent || x.offsetWidth) && !x.disabled)
      .find((x) => (x.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60) === label);
    if (b) b.click();
  }, hit);
  await page.waitForTimeout(220);
  await answerDialogs(page, { prefer });
  await page.waitForTimeout(120);
  return true;
}

async function goto(page, route) {
  await page.evaluate((r) => { location.hash = `#/${r}`; }, route);
  await page.waitForTimeout(300);
}

/** What the app itself says is happening — the state a player would read off the screen. */
async function readState(page) {
  return page.evaluate(async () => {
    const Store = await import("/src/store.js");
    const Derived = await import("/src/derived.js");
    const Journal = await import("/src/journal.js");
    const c = Store.activeCharacter();
    let solo = {};
    try { solo = JSON.parse(localStorage.getItem("invincible:solo") || "{}"); } catch { /* none */ }
    return {
      hero: c ? (c.identity.heroName || c.identity.realName || "unnamed") : null,
      health: c ? `${c.state.health}/${Derived.maxHealth(c)}` : null,
      resolve: c ? `${c.state.resolve}/${Derived.maxResolve(c)}` : null,
      karma: c ? c.state.karma : null,
      crisisLevel: solo.crisisLevel ?? null,
      alert: solo.alertParts?.headline || solo.alert || null,
      timers: (solo.timers || []).length,
      objectives: (solo.objectives || []).length,
      resolved: solo.resolved || 0,
      logLines: (solo.log || []).length,
      journalEntries: Journal.stats().entries,
      sessions: Journal.stats().sessions,
    };
  });
}

async function report(page, label) {
  const s = await readState(page);
  // Objectives were invisible in this line, which hid the fact that none was ever being created.
  say("state", label, `H ${s.health} · R ${s.resolve} · karma ${s.karma} · crisis ${s.crisisLevel} · ${s.timers} timer(s) · ${s.objectives} objective(s)`);
  return s;
}

/* ---------------------------------------------------------------- the session */

const run = async () => {
  const server = await serve();
  const browser = await chromium.launch({ executablePath: BROWSER, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const p of ["**://*.googleapis.com/**", "**://*.firebaseio.com/**", "**://www.gstatic.com/**"]) {
    await page.route(p, (r) => r.abort());
  }

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForSelector("body[data-ready]", { timeout: 15000 });

  // Seed Math.random so a session is reproducible and a regression is a real change, not variance.
  seedRng(SEED * 2654435761);
  await page.addInitScript((seed) => {
    let s = seed >>> 0 || 1;
    Math.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
  }, SEED);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("body[data-ready]", { timeout: 15000 });

  console.log(`\n=== A COMPLETE SOLO SESSION — seed ${SEED} ===`);

  /* --- 1. Sitting down cold ------------------------------------------------ */
  say("beat", "SITTING DOWN — nothing saved, first time opening the app");
  await goto(page, "home");
  const coldOffers = await visibleButtons(page);
  say("app", "Home offers:", coldOffers.slice(0, 6).join(" | "));
  if (!coldOffers.some((t) => /create|play|tutorial|build/i.test(t))) {
    problems.push("A cold Home offers no way to begin.");
  }

  /* --- 2. Getting a hero --------------------------------------------------- */
  say("beat", "MAKING A HERO");
  await goto(page, "create");
  if (!(await press(page, "Build one for me", { why: "a newcomer needs a hero without reading 69 powers" }))) {
    await press(page, "Create|Play a published", { why: "any route to a playable hero" });
  }
  await answerDialogs(page);
  await press(page, "Create hero|Finish|Save", { optional: true });
  await answerDialogs(page);
  let st = await report(page, "hero ready");
  if (!st.hero) problems.push("No hero exists after taking the quick-build path.");

  /* --- 3. Turning on solo play --------------------------------------------- */
  say("beat", "SWITCHING ON CRISIS MODE (playing without a GM)");
  await page.evaluate(async () => {
    const { Settings } = await import("/src/settings.js");
    Settings.set("soloMode", true);
    document.dispatchEvent(new CustomEvent("nav-refresh"));
  });
  await page.waitForTimeout(200);
  await goto(page, "home");
  const homeNow = await visibleButtons(page);
  say("app", "Home now offers:", homeNow.slice(0, 5).join(" | "));
  if (!homeNow.some((t) => /tonight|session|solo|continue/i.test(t))) {
    problems.push("With Crisis Mode on, Home does not offer to start a session.");
  }

  /* --- 4. Starting the session --------------------------------------------- */
  say("beat", "STARTING THE SESSION");
  await goto(page, "solo");
  await press(page, "Generate crisis alert|New crisis alert",
    { why: "step 1 of the loop: the emergency the hero answers" });
  st = await report(page, "alert rolled");
  if (!st.alert) problems.push("Generating an alert left no crisis on the board.");
  say("app", "tonight's emergency:", st.alert || "(none)");

  /* --- 5. Event check and engaging ---------------------------------------- */
  say("beat", "EVENT CHECK, THEN ENGAGING THE CRISIS");
  await press(page, "Event check", { why: "step 2: does anything escalate?" });

  // Two controls match /engage/: the next-step card's "Engage a crisis", which only SCROLLS to
  // the Crises panel, and that panel's own "Engage", which actually starts the timer. Pressing
  // the first and stopping was why no session ever had a timer running — and with no timer, the
  // narrated moves below check nothing, so the whole engine went unexercised.
  await press(page, "Engage a crisis", { why: "step 3: the next-step card points at the crises", optional: true });
  await press(page, "Engage", { why: "step 3: actually turn a crisis into a running timer", exact: true, optional: true });
  if (!(await readState(page)).timers) {
    await press(page, "New timer|Start a timer|Add a timer", { why: "step 3 by any route", optional: true });
  }
  st = await report(page, "after engaging");
  if (!st.timers) {
    problems.push("After engaging a crisis, no timer is running — the clock that replaces the GM never starts.");
  }

  // An objective is where solo karma comes from (§3.20 — objective timers replace the session
  // questions), so a session that never sets one never exercises advancement at all.
  say("beat", "SETTING AN OBJECTIVE (this is where solo karma comes from)");
  await press(page, "Set an objective", { why: "solo karma is paid by reached objectives", optional: true });
  st = await report(page, "objective set");
  if (!st.objectives) {
    problems.push("No objective could be set, so this session can never earn karma (§3.20).");
  }

  /* --- 6. Playing the middle ---------------------------------------------- */
  say("beat", "PLAYING — the part that has to sustain itself");
  for (let round = 1; round <= 3; round++) {
    say("note", `beat ${round} of the crisis`);
    // The control's LABEL is "Say what your hero just did" (step 4) or "Something happened — roll
    // it" (elsewhere); "What did your hero just do?" is the dialog's title, not the button.
    // Matching only the title made this fall through to a loose Check|Roll fallback, which hit
    // the attribute guide — a reference panel — instead of the control that advances play.
    const did = await press(page, "Say what your hero just did|Something happened|Time passes|What did your hero just do",
      { why: "the player must be able to narrate and have the app work out the checks", optional: true });
    if (!did) {
      await press(page, "Time passes — check every timer|Advance time",
        { why: "any control that moves the clock forward", optional: true });
    }
    await answerDialogs(page);
  }
  st = await report(page, "mid-session");

  // Push the objective along: a milestone is the only thing that advances it (never a clock).
  say("beat", "ADVANCING THE OBJECTIVE");
  for (let i = 0; i < 4; i++) {
    const moved = await press(page, "Progress", { why: "an objective advances on a milestone", optional: true });
    if (!moved) break;
    await answerDialogs(page);
  }
  st = await report(page, "objective pushed");

  /* --- 7. A social scene --------------------------------------------------- */
  say("beat", "A SOCIAL SCENE (the only way Resolve comes back)");
  await press(page, "Social scene", { why: "loop step 5" });
  st = await report(page, "after the social scene");

  /* --- 8. Resolving ------------------------------------------------------- */
  say("beat", "RESOLVING THE CRISIS");
  await press(page, "Resolve crisis", { why: "the crisis has to be finishable" });
  st = await report(page, "after resolving");
  if (!st.resolved) problems.push("Resolving a crisis did not register as resolved.");

  /* --- 9. Ending well ----------------------------------------------------- */
  say("beat", "ENDING THE SESSION");
  // The ending has more than one legitimate name: Head home is the in-fiction rest that pays
  // objective karma, Stop for tonight parks a live crisis, and End the session closes a sitting
  // whose crisis is already resolved. A player needs ONE of them; the harness accepts any.
  const before = await readState(page);
  const ended = await press(page, "Head home", { why: "the in-fiction end: rest, recover, bank karma", optional: true })
    || await press(page, "End the session", { why: "closing a sitting whose crisis is resolved", optional: true })
    || await press(page, "Stop for tonight", { why: "an ending must exist at every point in a session" });
  if (!ended) problems.push("No way to end the session was offered at any point.");
  st = await report(page, "session closed");
  if (before.objectives && st.karma === 0 && before.resolved) {
    say("note", "(no karma banked — expected unless an objective actually reached the top of its ladder)");
  }

  /* --- 10. Coming back ---------------------------------------------------- */
  say("beat", "COMING BACK NEXT WEEK");
  await goto(page, "home");
  const back = await page.evaluate(() => document.querySelector("#screen").textContent);
  const foothold = /last time|still out there|crisis level|continue/i.test(back);
  say("app", foothold ? "Home picks up where the session left off." : "Home says nothing about last time.");
  if (!foothold) problems.push("Returning after a session, Home gives no foothold to resume from.");

  /* --- verdict ------------------------------------------------------------ */
  const journal = await page.evaluate(async () => {
    const J = await import("/src/journal.js");
    return { entries: J.stats().entries, sessions: J.stats().sessions };
  });

  console.log(`\n=== VERDICT ===`);
  console.log(`Beats played: ${beat}`);
  console.log(`Journal: ${journal.entries} entries across ${journal.sessions} session(s) — the record a player keeps.`);
  console.log(`Console errors: ${errors.length}${errors.length ? ` — ${errors.slice(0, 2).join(" | ")}` : ""}`);
  console.log(`Stalls (a beat with nothing offered): ${stalls.length}`);
  for (const s of stalls) console.log(`  ✗ wanted "${s.wanted}" — ${s.why}\n      offered: ${s.offered.slice(0, 8).join(" | ")}`);
  console.log(`Problems: ${problems.length}`);
  for (const p of problems) console.log(`  ✗ ${p}`);

  const outFile = path.join(ROOT, "tests", `.playthrough-seed${SEED}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ seed: SEED, transcript, stalls, problems, errors, journal }, null, 2));
  console.log(`\nFull transcript: ${path.relative(ROOT, outFile)}`);

  // What this run does NOT cover, so "it played" is a bounded claim.
  console.log(`\nNot covered: combat resolved blow by blow (the encounter sequence is its own flow),`);
  console.log(`multi-crisis campaigns, karma spending between sessions, group play, and whether the`);
  console.log(`fiction the oracles produced was any GOOD — only that play never had nowhere to go.`);

  await browser.close();
  server.close();
  process.exit(stalls.length || problems.length || errors.length ? 1 : 0);
};

run().catch((e) => { console.error(e); process.exit(1); });
