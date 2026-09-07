// play.mjs — a stepwise driver so an agent (or a person) can actually PLAY a session,
// one motivated decision at a time, instead of batch-running a scripted one.
//
// tests/playthrough.mjs answers "does a session hold together mechanically" by pressing controls
// on a fixed spine and choosing at random. It cannot answer "is this a game worth playing",
// because nothing in it decides anything for a reason or writes a word of prose.
//
// This is the other half. Each invocation boots the app, restores the saved browser storage,
// performs ONE command, prints what the app now offers, and saves storage back — so a caller
// with judgement can read the fiction, decide what the hero does because of it, and write the
// journal entry that makes the session a record rather than a log.
//
//   node tests/play.mjs new                  wipe and start a fresh campaign (hero + Crisis Mode)
//   node tests/play.mjs state                where you are, what is offered, recent journal
//   node tests/play.mjs do "<label>"         press a control by its visible label
//   node tests/play.mjs choose "<text>"      pick an option in the open dialog
//   node tests/play.mjs type "<text>"        fill the open dialog's first empty field
//   node tests/play.mjs write "<prose>"      write a journal entry in your own words
//   node tests/play.mjs goto <route>         switch screen (solo, sheet, home, journal, combat)
//   node tests/play.mjs journal              print the whole journal, oldest first
//
// Storage lives in tests/.play-state.json between invocations, so a session survives across
// commands and can be picked up later exactly as a player would.

import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const STATE = path.join(ROOT, "tests", ".play-state.json");
const PORT = 8126;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

// A dialog cannot survive a page reload, so a command that opens one must also answer it in the
// SAME invocation. Steps are therefore read as a sequence of verb/argument pairs — which is the
// natural unit anyway: one beat of play is "press this, answer that, then write what happened".
const argv = process.argv.slice(2);
const NULLARY = new Set(["new", "state", "journal"]);   // these take no argument
const STEPS = [];
for (let i = 0; i < argv.length; i++) {
  const verb = argv[i];
  if (NULLARY.has(verb)) STEPS.push({ verb, arg: "" });
  else STEPS.push({ verb, arg: argv[++i] ?? "" });
}
if (!STEPS.length) STEPS.push({ verb: "state", arg: "" });
const FIRST = STEPS[0].verb;

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

const run = async () => {
  const server = await serve();
  const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const p of ["**://*.googleapis.com/**", "**://*.firebaseio.com/**", "**://www.gstatic.com/**"]) {
    await page.route(p, (r) => r.abort());
  }
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForSelector("body[data-ready]", { timeout: 15000 });

  // Restore the campaign AND the screen it was left on. Storage alone puts every command back
  // on Home, so a session could never be continued from where it actually was.
  if (FIRST !== "new" && fs.existsSync(STATE)) {
    const saved = JSON.parse(fs.readFileSync(STATE, "utf8"));
    await page.evaluate((store) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
    }, saved.storage || saved);
    await page.goto(`http://localhost:${PORT}/index.html${saved.route || "#/solo"}`);
    await page.waitForSelector("body[data-ready]", { timeout: 15000 });
    await page.waitForTimeout(320);
  }

  const said = [];

  for (const { verb, arg } of STEPS) {
    if (verb === "new") {
      said.push(await page.evaluate(async () => {
        const { Settings } = await import("/src/settings.js");
        const Store = await import("/src/store.js");
        const W = await import("/src/wizard.js");
        const Dv = await import("/src/derived.js");
        localStorage.clear();
        Settings.set("soloMode", true);
        const draft = Dv.blankCharacter();
        W.rollWholeHero(draft);
        const c = Store.saveCharacter(draft);
        Store.setActiveCharacter(c.id);
        return `New campaign. Hero: ${c.identity.heroName || c.identity.realName} — ${c.identity.archetype || "no archetype"}, ${c.identity.occupation || "no occupation"}. Crisis Mode is on.`;
      }));
      await page.evaluate(() => { location.hash = "#/solo"; });
      await page.waitForTimeout(420);
      continue;
    }

    if (verb === "do") {
      const hit = await page.evaluate((want) => {
        const vis = (b) => (b.offsetParent || b.offsetWidth) && !b.disabled;
        const all = Array.from(document.querySelectorAll("#screen button, #screen a, .modal button")).filter(vis);
        const re = new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const b = all.find((x) => re.test((x.textContent || "").trim()));
        if (!b) return null;
        const label = (b.textContent || "").trim().slice(0, 60);
        b.click();
        return label;
      }, arg);
      await page.waitForTimeout(430);
      said.push(hit ? `Pressed "${hit}".` : `NO CONTROL matching "${arg}".`);
      if (!hit) process.exitCode = 1;
      continue;
    }

    if (verb === "choose") {
      const hit = await page.evaluate((want) => {
        const m = document.querySelector(".modal-backdrop .modal");
        if (!m) return "__nomodal";
        const vis = (b) => (b.offsetParent || b.offsetWidth) && !b.disabled;
        const opts = Array.from(m.querySelectorAll(".choice, button")).filter(vis);
        const re = new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const b = opts.find((x) => re.test((x.textContent || "").trim()));
        if (!b) return null;
        const label = (b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70);
        b.click();
        return label;
      }, arg);
      await page.waitForTimeout(430);
      said.push(hit === "__nomodal" ? `NO DIALOG open when choosing "${arg}".`
        : hit ? `Chose "${hit}".` : `NO OPTION matching "${arg}" in this dialog.`);
      if (!hit || hit === "__nomodal") process.exitCode = 1;
      continue;
    }

    if (verb === "type") {
      const ok = await page.evaluate((text) => {
        const m = document.querySelector(".modal-backdrop .modal") || document;
        const vis = (e) => e.offsetParent || e.offsetWidth;
        const el = Array.from(m.querySelectorAll("input, textarea"))
          .find((e) => vis(e) && !e.disabled && !["checkbox", "radio"].includes(e.type));
        if (!el) return false;
        el.value = text;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }, arg);
      said.push(ok ? `Typed: ${arg}` : "NO FIELD to type into.");
      if (!ok) process.exitCode = 1;
      continue;
    }

    if (verb === "write") {
      said.push(await page.evaluate(async (text) => {
        const J = await import("/src/journal.js");
        const Store = await import("/src/store.js");
        J.record({ kind: "note", text, characterId: Store.activeCharacter()?.id || null });
        return `Written: ${text.slice(0, 70)}${text.length > 70 ? "…" : ""}`;
      }, arg));
      continue;
    }

    if (verb === "goto") {
      await page.evaluate((r) => { location.hash = r.startsWith("#") ? r : `#/${r}`; }, arg || "solo");
      await page.waitForTimeout(380);
      said.push(`Went to ${arg || "solo"}.`);
      continue;
    }

    if (verb === "journal") {
      const entries = await page.evaluate(async () => {
        const J = await import("/src/journal.js");
        return J.grouped({}).flatMap((g) => g.entries.map((e) => `[${e.kind}] ${e.text}`));
      });
      console.log(entries.slice().reverse().join("\n") || "(nothing written yet)");
      await browser.close(); server.close(); return;
    }

    if (verb !== "state") said.push(`Unknown step "${verb}".`);
  }

  /* ------------------------------------------------------------------ report */
  const view = await page.evaluate(async () => {
    const Store = await import("/src/store.js");
    const Derived = await import("/src/derived.js");
    const Solo = await import("/src/solo.js");
    const J = await import("/src/journal.js");
    const c = Store.activeCharacter();
    let solo = {};
    try { solo = JSON.parse(localStorage.getItem("invincible:solo") || "{}"); } catch { /* none */ }
    const vis = (b) => (b.offsetParent || b.offsetWidth) && !b.disabled;
    const modal = document.querySelector(".modal-backdrop .modal");
    const recent = J.grouped({}).flatMap((g) => g.entries.map((e) => `[${e.kind}] ${e.text}`)).slice(0, 6);
    return {
      hero: c ? `${c.identity.heroName || c.identity.realName} — H ${c.state.health}/${Derived.maxHealth(c)}, R ${c.state.resolve}/${Derived.maxResolve(c)}, karma ${c.state.karma}` : "no hero",
      step: Solo.currentStep(solo) + 1,
      crisis: solo.alertParts?.headline || solo.alert || "(no crisis running)",
      where: solo.place?.text || null,
      level: solo.crisisLevel ?? 0,
      timers: (solo.timers || []).map((t) => `${t.name} (${t.status || t.rung})`),
      objectives: (solo.objectives || []).map((o) => `${o.name} — ${o.status}`),
      dialog: modal ? {
        title: (modal.querySelector("h1,h2,h3,.modal-title")?.textContent || "").trim(),
        body: (modal.querySelector(".lede, p")?.textContent || "").trim().slice(0, 240),
        options: Array.from(modal.querySelectorAll(".choice, button")).filter(vis)
          .map((b) => (b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70)),
        field: !!Array.from(modal.querySelectorAll("input, textarea")).find(vis),
      } : null,
      controls: Array.from(document.querySelectorAll("#screen button, #screen a")).filter(vis)
        .map((b) => (b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50)).filter(Boolean),
      recent,
    };
  });

  const saved = await page.evaluate(() => ({
    storage: Object.fromEntries(Object.entries(localStorage)),
    route: location.hash || "#/solo",
  }));
  fs.writeFileSync(STATE, JSON.stringify(saved));

  if (said.length) console.log(said.join("\n") + "\n");
  console.log(`HERO      ${view.hero}`);
  console.log(`CRISIS    ${view.crisis}   (level ${view.level}, loop step ${view.step} of 6)`);
  if (view.where) console.log(`PLACE     ${view.where}`);
  if (view.timers.length) console.log(`TIMERS    ${view.timers.join(" · ")}`);
  if (view.objectives.length) console.log(`OBJECTIVE ${view.objectives.join(" · ")}`);
  if (view.recent.length) {
    console.log(`\nRECENTLY`);
    for (const r of view.recent.slice().reverse()) console.log(`  ${r}`);
  }
  if (view.dialog) {
    console.log(`\nDIALOG OPEN: ${view.dialog.title}`);
    if (view.dialog.body) console.log(`  ${view.dialog.body}`);
    if (view.dialog.field) console.log(`  (has a field — use: play.mjs type "…")`);
    console.log(`  options:`);
    for (const o of view.dialog.options) console.log(`    · ${o}`);
    console.log(`  → play.mjs choose "<text>"`);
  } else {
    console.log(`\nCONTROLS`);
    for (const c of view.controls) console.log(`  · ${c}`);
    console.log(`  → play.mjs do "<label>"   |   play.mjs write "<prose>"`);
  }
  if (errors.length) console.log(`\nCONSOLE ERRORS: ${errors.slice(0, 3).join(" | ")}`);

  await browser.close();
  server.close();
};

run().catch((e) => { console.error(e); process.exit(1); });
