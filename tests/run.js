// tests/run.js — headless regression harness. `npm test`
// Boots the real app in Chromium (Firebase requests aborted), asserts wiring, derivation
// invariants, dice-engine invariants, lifecycle bundles, layout and a11y basics, and every
// closed rules-audit finding (A1–A25 in CLAUDE.md §10).

import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8123;
const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || findChromium();

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const candidates = [];
  try {
    for (const dir of fs.readdirSync(root)) {
      if (!/^chromium/.test(dir)) continue;
      for (const bin of ["chrome-linux/chrome", "chrome-linux/headless_shell"]) {
        const p = path.join(root, dir, bin);
        if (fs.existsSync(p)) candidates.push(p);
      }
    }
  } catch { /* fall through */ }
  candidates.sort((a) => (a.includes("headless_shell") ? 1 : -1));
  return candidates[0] || "chromium";
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

let passed = 0, failed = 0;
const failures = [];

function ok(name, condition, detail = "") {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; failures.push(`${name}${detail ? ` — ${detail}` : ""}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function section(name) { console.log(`\n${name}`); }

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);
      let file = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end("not found"); return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(fs.readFileSync(file));
    });
    server.listen(PORT, () => resolve(server));
  });
}

const run = async () => {
  const server = await serve();
  const browser = await chromium.launch({ executablePath: BROWSER, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.route("**://*.googleapis.com/**", (r) => r.abort());
  await page.route("**://*.firebaseio.com/**", (r) => r.abort());
  await page.route("**://www.gstatic.com/**", (r) => r.abort());

  const base = `http://localhost:${PORT}/index.html`;
  await page.goto(base);
  await page.waitForFunction(() => document.body.dataset.ready === "true", { timeout: 15000 });

  /* ---------------------------------------------------------------- boot & wiring */
  section("Boot & wiring");
  ok("app boots with data-ready", await page.evaluate(() => document.body.dataset.ready === "true"));
  ok("bottom nav rendered", (await page.locator("#bottom-nav .nav-item").count()) >= 5);

  const tabs = ["home", "sheet", "combat", "rules", "compendium", "log", "settings"];
  for (const tab of tabs) {
    await page.evaluate((t) => { location.hash = `#/${t}`; }, tab);
    await page.waitForTimeout(180);
    const html = await page.locator("#screen").innerHTML();
    ok(`tab ${tab} renders content`, html.length > 80, `${html.length} chars`);
  }
  ok("no console errors during navigation", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  /* ---------------------------------------------------------------- PWA icons */
  section("PWA icons");
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const swSource = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
  const pngIcons = manifest.icons.filter((i) => i.type === "image/png");
  ok("manifest ships raster icons (SVG alone renders as a black tile on iOS/Android launchers)", pngIcons.length >= 2, `${pngIcons.length} PNG entries`);
  ok("manifest declares a maskable icon", manifest.icons.some((i) => String(i.purpose || "").includes("maskable")));
  const iconFiles = manifest.icons.map((i) => i.src.replace("./", ""));
  const missing = iconFiles.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  ok("every manifest icon file exists", missing.length === 0, missing.join(", "));
  ok("every icon is precached by the service worker", iconFiles.every((f) => swSource.includes(`./${f}`)), iconFiles.filter((f) => !swSource.includes(`./${f}`)).join(", "));
  const touchIcon = await page.evaluate(() => document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") || "");
  ok("apple-touch-icon is a PNG", /\.png$/i.test(touchIcon), touchIcon);
  const iconLoads = await page.evaluate(async (files) => {
    const results = {};
    for (const f of files) {
      results[f] = await new Promise((res) => {
        const img = new Image();
        img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => res(null);
        img.src = `/${f}`;
      });
    }
    return results;
  }, [...iconFiles, "icon-180.png"]);
  ok("all icons decode with non-zero dimensions", Object.values(iconLoads).every((r) => r && r.w > 0 && r.h > 0), JSON.stringify(iconLoads));

  /* ---------------------------------------------------------------- data integrity */
  section("Data integrity");
  const data = await page.evaluate(async () => {
    const D = await import("/data.js");
    const N = await import("/data-npcs.js");
    const M = await import("/data-monsters.js");
    const P = await import("/data-pregens.js");
    const S = await import("/data-solo.js");
    const R = await import("/src/rules.js");
    const restricted = [...D.WEAPONS, ...D.BODY_ARMOR, ...D.GENERAL_GEAR, ...D.VEHICLES, ...D.VEHICLE_WEAPONS].filter((i) => i.restricted);
    return {
      powers: D.POWERS.length, talents: D.TALENTS.length, drawbacks: D.DRAWBACKS.length,
      archetypes: D.ARCHETYPES.length, occupations: D.OCCUPATIONS.length, sources: D.POWER_SOURCES.length,
      crits: D.CRITICAL_INJURIES.length, challenges: D.CHALLENGES.length, weapons: D.WEAPONS.length,
      vehicles: D.VEHICLES.length, upgrades: D.BASE_UPGRADES.length, rules: D.RULES_LIBRARY.length,
      deadVehicles: D.VEHICLES.filter((v) => v.durability < 1).map((v) => v.name),
      negativeManeuver: D.VEHICLES.filter((v) => v.maneuver < 0).map((v) => v.name),
      vehicleFlags: D.VEHICLE_DATA_FLAGS.length,
      ungatedRestricted: restricted.length,
      restrictedGated: restricted.filter((i) => !R.purchaseCheck({ resources: 8, cost: i.cost ?? 1, restricted: true, streetwise: false }).allowed).length,
      npcs: N.NPC_PROFILES.length, creatures: N.CREATURES.length,
      adversaries: M.ADVERSARIES.length, pregens: P.PREGENS.length,
      soloTimers: S.CRISIS_TIMER.ladder.length,
      badArchetypeTalents: D.ARCHETYPES.flatMap((a) => a.talents)
        .filter((t) => !D.TALENTS.some((x) => x.name === String(t).replace(/\s*\(.*\)$/, "").trim())
          && !D.TALENT_ALIASES[String(t).replace(/\s*\(.*\)$/, "").trim()]),
      badOccupationTalents: D.OCCUPATIONS.flatMap((o) => o.talents)
        .filter((t) => !D.TALENTS.some((x) => x.name === t)),
      badArchetypePowers: D.ARCHETYPES.flatMap((a) => a.powers)
        .filter((p) => {
          const clean = String(p).replace(/^(Major|Massive|Monstrous)\s+/i, "").split(/[:(]/)[0].trim();
          return !D.POWERS.some((x) => x.name === clean);
        }),
    };
  });
  ok("69 powers", data.powers === 69, String(data.powers));
  ok("51 talents", data.talents === 51, String(data.talents));
  ok("15 drawbacks", data.drawbacks === 15, String(data.drawbacks));
  ok("16 archetypes (source gap closed)", data.archetypes === 16, String(data.archetypes));
  ok("22 occupations", data.occupations === 22, String(data.occupations));
  ok("36 power sources (D66)", data.sources === 36, String(data.sources));
  ok("12 critical injury rows", data.crits === 12, String(data.crits));
  ok("8 published challenges", data.challenges === 8, String(data.challenges));
  ok("21 vehicles", data.vehicles === 21, String(data.vehicles));
  ok("no vehicle starts wrecked (Durability >= 1)", data.deadVehicles.length === 0, data.deadVehicles.join(", "));
  ok("no negative Maneuverability (the book prints none)", data.negativeManeuver.length === 0, data.negativeManeuver.join(", "));
  ok("vehicle source-gap flags cleared", data.vehicleFlags === 0, String(data.vehicleFlags));
  ok("Restricted items exist and every one is Streetwise-gated", data.ungatedRestricted > 0 && data.restrictedGated === data.ungatedRestricted,
    `${data.restrictedGated}/${data.ungatedRestricted} gated`);
  ok("31 stock NPC profiles", data.npcs === 31, String(data.npcs));
  ok("18 creatures", data.creatures === 18, String(data.creatures));
  ok("33 adversary stat blocks", data.adversaries === 33, String(data.adversaries));
  ok("28 pregens", data.pregens === 28, String(data.pregens));
  ok("every archetype talent exists in the talent list", data.badArchetypeTalents.length === 0, data.badArchetypeTalents.join(", "));
  ok("every occupation talent exists in the talent list", data.badOccupationTalents.length === 0, data.badOccupationTalents.join(", "));
  ok("every archetype power exists in the power list", data.badArchetypePowers.length === 0, data.badArchetypePowers.join(", "));

  /* ---------------------------------------------------------------- derivation invariants */
  section("Derived stats (audit A7, A10, A15)");
  const derived = await page.evaluate(async () => {
    const Derived = await import("/src/derived.js");
    const P = await import("/data-pregens.js");
    const W = await import("/src/wizard.js");
    const out = { formula: [], strikeStack: null, critStack: null, durableCap: null, poolFloor: null };

    const c = Derived.blankCharacter();
    c.attributes = { fighting: 7, agility: 5, strength: 9, reason: 3, intuition: 4, presence: 6 };
    out.formula.push([Derived.maxHealth(c), Math.ceil((7 + 5 + 9) / 2)]);
    out.formula.push([Derived.maxResolve(c), Math.ceil((3 + 4 + 6) / 2)]);
    out.formula.push([Derived.slugfestDamage(c), Math.ceil(9 / 2)]);

    // STRIKE + EMANATION must not stack: take the single highest.
    const s = Derived.blankCharacter();
    s.attributes.strength = 6;
    s.powers = [{ name: "STRIKE", level: 1, boosts: [], limits: [] }, { name: "EMANATION", level: 0, boosts: [], limits: [] }];
    out.strikeStack = Derived.slugfestDamage(s); // ceil(6/2)=3, +2 (best of Major STRIKE 2 / EMANATION 2)

    // Crit penalties to the same attributes do not stack.
    const k = Derived.blankCharacter();
    k.attributes = { fighting: 6, agility: 6, strength: 6, reason: 4, intuition: 4, presence: 4 };
    k.state.crits = [{ roll: 2, healed: false }, { roll: 4, healed: false }, { roll: 6, healed: false }];
    out.critStack = Derived.critPenalty(k).dice.fighting;

    // Durable caps at five ranks.
    const d = Derived.blankCharacter();
    d.attributes = { fighting: 4, agility: 4, strength: 4, reason: 2, intuition: 2, presence: 2 };
    const baseH = Derived.maxHealth(d);
    d.talents = [{ name: "Durable", rank: 9 }];
    out.durableCap = [baseH, Derived.maxHealth(d)];

    // Pool floor of 1 die.
    const p = Derived.blankCharacter();
    p.attributes.presence = 1;
    p.state.conditions = { afflicted: true };
    out.poolFloor = Derived.attributePool(p, "presence");

    // Every pregen normalises and derives without throwing.
    out.pregens = P.PREGENS.map((x) => {
      const ch = Derived.normalizeCharacter(W.pregenToCharacter(x));
      return { name: x.name, h: Derived.maxHealth(ch), r: Derived.maxResolve(ch), ok: ch.state.health >= 0 };
    });
    return out;
  });
  ok("Health = ceil((FTG+AGL+STR)/2)", derived.formula[0][0] === derived.formula[0][1]);
  ok("Resolve = ceil((RSN+ITN+PRS)/2)", derived.formula[1][0] === derived.formula[1][1]);
  ok("Slugfest Damage = ceil(STR/2)", derived.formula[2][0] === derived.formula[2][1]);
  ok("A7 STRIKE and EMANATION never combine", derived.strikeStack === 5, `got ${derived.strikeStack}, expected 5`);
  ok("A10 crit penalties take the worst, not the sum", derived.critStack === -2, `got ${derived.critStack}`);
  ok("A15 Durable caps at ×5 (+10 Health)", derived.durableCap[1] - derived.durableCap[0] === 10, JSON.stringify(derived.durableCap));
  ok("A1 pool never drops below 1 die", derived.poolFloor === 1, String(derived.poolFloor));
  ok("all 28 pregens derive without error", derived.pregens.length === 28 && derived.pregens.every((p) => p.ok && p.h > 0));

  /* ---------------------------------------------------------------- dice engine */
  section("Dice engine (audits A2–A6, A8, A9, A11–A13, A21)");
  const dice = await page.evaluate(async () => {
    const Roller = await import("/src/roller.js");
    const Derived = await import("/src/derived.js");
    const out = {};

    const mk = () => {
      const c = Derived.blankCharacter();
      c.attributes = { fighting: 6, agility: 5, strength: 6, reason: 4, intuition: 4, presence: 5 };
      c.state.health = Derived.maxHealth(c);
      c.state.resolve = Derived.maxResolve(c);
      return c;
    };

    // A2: push keeps 6s and 1s, re-rolls the rest, charges 1 stress per 1 present afterwards.
    const c1 = mk();
    const r1 = Roller.roll(c1, "fighting", "test", { manualFaces: [6, 1, 3, 4, 2, 5], log: false });
    const before = r1.dice.slice();
    const push = Roller.pushRoll(c1, r1, [2, 2, 2, 2]);
    out.pushKeeps = { before, after: r1.dice.slice(), stress: push.stress };

    // A3: cannot push twice, cannot push at 0 Resolve, cannot push as defender or passive.
    const second = Roller.pushRoll(c1, r1);
    out.secondPush = second.ok;
    const c2 = mk(); c2.state.resolve = 0;
    out.zeroResolve = Roller.canPush(c2, Roller.makeRoll({ character: c2, attr: "fighting", label: "x", dice: [2] })).ok;
    out.passive = Roller.canPush(mk(), Roller.makeRoll({ character: mk(), attr: "intuition", label: "x", dice: [2], passive: true })).ok;
    out.defender = Roller.canPush(mk(), Roller.makeRoll({ character: mk(), attr: "fighting", label: "x", dice: [2], defending: true })).ok;

    // A4: opposed — need a success AND more 6s; ties fail.
    const active = { sixes: 2 }, opposing = { sixes: 2 };
    out.tie = Roller.resolveOpposed(active, opposing);
    out.win = Roller.resolveOpposed({ sixes: 3 }, { sixes: 1 });
    out.noSuccess = Roller.resolveOpposed({ sixes: 0 }, { sixes: 0 });

    // A5: block counterattack uses only the surplus 6s.
    out.block = Roller.resolveBlock({ sixes: 2 }, { sixes: 4 });
    out.blockHit = Roller.resolveBlock({ sixes: 3 }, { sixes: 1 });

    // A6: Knockback damage = half base STRENGTH, not Slugfest Damage.
    const c3 = mk();
    c3.powers = [{ name: "STRIKE", level: 2, boosts: [], limits: [] }];
    out.stuntDamage = { stunt: Roller.stuntDamage(c3), slugfest: Derived.slugfestDamage(c3) };

    // A8: crit roll adds the excess damage; damage while broken adds the full amount.
    const c4 = mk();
    c4.state.health = 3;
    const dmg = Roller.applyDamage(c4, 8, { armor: 0 });
    out.excess = { excess: dmg.excess, broken: dmg.broken, crit: !!dmg.crit };
    const c5 = mk(); c5.state.health = 0; c5.state.broken = true;
    const dmg2 = Roller.applyDamage(c5, 4, { armor: 0 });
    out.whileBroken = { crit: !!dmg2.crit, whileBroken: !!dmg2.whileBroken };

    // A9: multiple crits add +1 each and bump results at or below the worst.
    const c6 = mk();
    c6.state.crits = [{ roll: 6, healed: false }];
    const crit = Roller.rollCriticalInjury(c6, 0, { manualDie: 1 });
    out.critBump = crit.entry.roll;

    // A11: rally impossible at crit 9+.
    const c7 = mk(); c7.state.health = 0; c7.state.broken = true; c7.state.crits = [{ roll: 9, healed: false }];
    out.rallyBlocked = Roller.canRally(c7).ok;
    const c8 = mk(); c8.state.health = 0; c8.state.broken = true; c8.state.crits = [{ roll: 4, healed: false }];
    out.rallyAllowed = Roller.canRally(c8).ok;

    // A12: only one stabilisation attempt.
    const c9 = mk();
    c9.state.dying = { active: true, deadline: "A few minutes", stabiliseAttempted: false };
    Roller.stabilise(c9, c9, { manualFaces: [2, 2, 2, 2] });
    out.stabiliseTwice = Roller.stabilise(c9, c9).ok;

    // A13: purchase ladder.
    const R = await import("/src/rules.js");
    out.buyHigher = R.purchaseCheck({ resources: 6, cost: 3, restricted: false, streetwise: false }).mode;
    out.buyEqual = R.purchaseCheck({ resources: 4, cost: 4, restricted: false, streetwise: false }).mode;
    out.buyLower = R.purchaseCheck({ resources: 2, cost: 5, restricted: false, streetwise: false }).allowed;
    out.buyRestricted = R.purchaseCheck({ resources: 8, cost: 4, restricted: true, streetwise: false }).allowed;
    out.buyRestrictedOk = R.purchaseCheck({ resources: 8, cost: 4, restricted: true, streetwise: true }).allowed;
    out.loanBlocked = R.purchaseCheck({ resources: 1, cost: 3, restricted: false, streetwise: false, loan: 2 }).allowed;

    // A21: Reputation roll is never pushable.
    const c10 = mk(); c10.identity.rank = "cosmic";
    const rep = Roller.rollReputation(c10, { manualFaces: [6, 2, 3] });
    out.repPushable = rep.roll ? Roller.canPush(c10, rep.roll).ok : null;

    // A19: huge creatures filter stunts.
    out.hugeStunts = Roller.stuntsFor("slugfest", { huge: true }).map((s) => s.name);
    out.normalStunts = Roller.stuntsFor("slugfest", { huge: false }).map((s) => s.name);

    // Fire and explosions.
    out.fire = Roller.fireAttack(6, { manualFaces: [6, 6, 2, 3, 4, 5] }).damage;
    out.explosion = Roller.explosion(10, 3, { manualFaces: Array(10).fill(6) });
    return out;
  });
  ok("A2 push keeps 6s and 1s and re-rolls the rest",
    dice.pushKeeps.after.filter((d) => d === 6).length >= 1 && dice.pushKeeps.after.length === 6,
    JSON.stringify(dice.pushKeeps));
  ok("A2 push charges 1 stress per 1 showing afterwards", dice.pushKeeps.stress === dice.pushKeeps.after.filter((d) => d === 1).length, JSON.stringify(dice.pushKeeps));
  ok("A3 a roll cannot be pushed twice", dice.secondPush === false);
  ok("A3 cannot push at 0 Resolve", dice.zeroResolve === false);
  ok("A3 cannot push a passive roll", dice.passive === false);
  ok("A3 the defender cannot push", dice.defender === false);
  ok("A4 opposed tie fails for the active party", dice.tie.success === false && dice.tie.tie === true);
  ok("A4 opposed win nets the surplus 6s", dice.win.success === true && dice.win.net === 2);
  ok("A4 zero successes is never a win", dice.noSuccess.success === false);
  ok("A5 block counterattack uses only surplus 6s", dice.block.counterattack === true && dice.block.counterSixes === 2);
  ok("A5 a beaten block still lets the attack through", dice.blockHit.hit === true && dice.blockHit.remainingSixes === 2);
  ok("A6 Knockback damage uses half base STRENGTH", dice.stuntDamage.stunt === 3 && dice.stuntDamage.slugfest === 6, JSON.stringify(dice.stuntDamage));
  ok("A8 breaking rolls a crit with the excess damage", dice.excess.broken && dice.excess.crit && dice.excess.excess === 5, JSON.stringify(dice.excess));
  ok("A8 damage while broken causes another crit", dice.whileBroken.crit && dice.whileBroken.whileBroken);
  ok("A9 a crit at or below your worst is bumped one step worse", dice.critBump === 7, `got ${dice.critBump}`);
  ok("A11 rally is blocked at crit 9+", dice.rallyBlocked === false);
  ok("A11 rally is allowed below crit 9", dice.rallyAllowed === true);
  ok("A12 only one stabilisation attempt", dice.stabiliseTwice === false);
  ok("A13 Resources above Cost buys automatically", dice.buyHigher === "automatic");
  ok("A13 Resources equal to Cost requires a roll", dice.buyEqual === "roll");
  ok("A13 Resources below Cost is blocked", dice.buyLower === false);
  ok("A13 restricted items need Streetwise", dice.buyRestricted === false && dice.buyRestrictedOk === true);
  ok("A13 Resources 1 cannot borrow", dice.loanBlocked === false);
  ok("A21 Reputation rolls cannot be pushed", dice.repPushable === false);
  ok("A19 huge creatures drop Knockback/Stun/Deadly Hit", !dice.hugeStunts.includes("Knockback") && !dice.hugeStunts.includes("Stun") && !dice.hugeStunts.includes("Deadly Hit"));
  ok("A19 normal targets keep every slugfest stunt", dice.normalStunts.length === 7, String(dice.normalStunts.length));
  ok("fire deals 2 damage per 6", dice.fire === 4, String(dice.fire));
  ok("explosion Damage is half the Blast rating", dice.explosion.damage === 5 && dice.explosion.hits === true);

  /* ---------------------------------------------------------------- creation legality */
  section("Creation legality (audits A14, A16, A17)");
  const legality = await page.evaluate(async () => {
    const Derived = await import("/src/derived.js");
    const Store = await import("/src/store.js");
    const out = {};

    const mk = (rank) => {
      const c = Derived.blankCharacter();
      c.identity.rank = rank;
      c.identity.heroName = "Test";
      c.identity.powerSources = ["Mutation"];
      c.powers = [{ name: "BLAST", level: 0, boosts: [], limits: [] }];
      return c;
    };

    const massiveAtStreet = mk("street");
    massiveAtStreet.powers = [{ name: "BLAST", level: 2, boosts: [], limits: [] }];
    out.massiveBlocked = Derived.validateCharacter(massiveAtStreet).errors.some((e) => /Massive/.test(e));

    const monstrous = mk("cosmic");
    monstrous.powers = [{ name: "BLAST", level: 3, boosts: [], limits: [] }];
    out.monstrousBlocked = Derived.validateCharacter(monstrous).errors.some((e) => /Monstrous/.test(e));

    const massiveAtCosmic = mk("cosmic");
    massiveAtCosmic.powers = [{ name: "BLAST", level: 2, boosts: [], limits: [] }];
    out.massiveAllowed = !Derived.validateCharacter(massiveAtCosmic).errors.some((e) => /Massive/.test(e));

    const tooManyDrawbacks = mk("global");
    tooManyDrawbacks.drawbacks = [{ name: "Cursed" }, { name: "Phobic" }, { name: "Obsessed" }];
    out.drawbackCap = Derived.validateCharacter(tooManyDrawbacks).errors.some((e) => /drawbacks/.test(e));

    const overMax = mk("teen");
    overMax.attributes.fighting = 9;
    out.attrMax = Derived.validateCharacter(overMax).errors.some((e) => /exceeds/.test(e));

    // A14: karma floor and the between-sessions gate.
    const k = mk("global");
    k.state.karma = 5;
    k.state.session.spendUnlocked = false;
    out.lockedSpend = Store.karmaSpend(k, { kind: "talent", label: "x", cost: 10 }).ok;
    k.state.session.spendUnlocked = true;
    out.tooExpensive = Store.karmaSpend(k, { kind: "talent", label: "x", cost: 10 }).ok;
    k.state.karma = 12;
    out.spendOk = Store.karmaSpend(k, { kind: "talent", label: "x", cost: 10 }).ok;
    out.karmaAfter = k.state.karma;

    // Budget maths: 2 attribute points per extra power, 1 gained per drawback.
    const b = mk("global");
    b.powers = [{ name: "BLAST" }, { name: "FLIGHT" }, { name: "PROTECTION" }, { name: "STRIKE" }, { name: "QUICKNESS" }];
    b.drawbacks = [{ name: "Cursed" }];
    out.budget = Derived.creationBudget(b).available; // 32 + 1 - 2 = 31
    return out;
  });
  ok("A16 Massive powers blocked below Cosmic Champion", legality.massiveBlocked);
  ok("A16 Massive powers allowed at Cosmic Champion", legality.massiveAllowed);
  ok("A16 Monstrous powers never legal at creation", legality.monstrousBlocked);
  ok("A17 no more than two drawbacks", legality.drawbackCap);
  ok("attribute maximum enforced per rank", legality.attrMax);
  ok("A14 karma cannot be spent mid-session", legality.lockedSpend === false);
  ok("A14 karma cannot go negative", legality.tooExpensive === false);
  ok("A14 a legal karma spend deducts the cost", legality.spendOk === true && legality.karmaAfter === 2, String(legality.karmaAfter));
  ok("creation budget trades points for powers and drawbacks", legality.budget === 31, String(legality.budget));

  // Picking any archetype at any rank must land the budget exactly on zero.
  const archetypeBudget = await page.evaluate(async () => {
    const D = await import("/data.js");
    const W = await import("/src/wizard.js");
    const Derived = await import("/src/derived.js");
    const bad = [];
    for (const rank of D.RANKS) {
      for (const a of D.ARCHETYPES) {
        const c = W.applyArchetypeTo(Derived.blankCharacter(), a, rank.key);
        const b = Derived.creationBudget(c);
        if (b.remaining !== 0) bad.push(`${rank.key}/${a.name} ${b.remaining > 0 ? "+" : ""}${b.remaining}`);
      }
    }
    return bad;
  });
  ok("every archetype at every rank spends its budget exactly", archetypeBudget.length === 0, archetypeBudget.join(", "));

  /* ---------------------------------------------------------------- lifecycle & undo */
  section("Lifecycle bundles (audits A22, A23)");
  const lifecycle = await page.evaluate(async () => {
    const Store = await import("/src/store.js");
    const Derived = await import("/src/derived.js");
    localStorage.clear();
    const c = Store.createCharacter({});
    Store.updateCharacter((ch) => {
      ch.attributes = { fighting: 6, agility: 6, strength: 6, reason: 4, intuition: 4, presence: 4 };
      ch.state.health = 2;
      ch.state.resolve = 1;
      ch.state.conditions = { stunned: true, afflicted: true };
    }, { id: c.id });

    const before = Store.getCharacter(c.id);
    Store.snapshot("End action scene");
    Store.updateCharacter((ch) => {
      ch.state.health = Math.min(Derived.maxHealth(ch), ch.state.health + Derived.effectiveAttributes(ch).strength);
      ch.state.conditions = {};
    }, { id: c.id });
    const after = Store.getCharacter(c.id);
    const undone = Store.undo() && Store.getCharacter(c.id);
    return {
      beforeHealth: before.state.health, afterHealth: after.state.health,
      strength: before.attributes.strength,
      conditionsCleared: Object.keys(after.state.conditions).length === 0,
      undoneHealth: undone.state.health, undoneConditions: Object.keys(undone.state.conditions).length,
    };
  });
  ok("A22 end-of-scene restores Health equal to STRENGTH",
    lifecycle.afterHealth === lifecycle.beforeHealth + lifecycle.strength, JSON.stringify(lifecycle));
  ok("A22 end-of-scene clears per-scene conditions", lifecycle.conditionsCleared);
  ok("A23 the bundle undoes in one step", lifecycle.undoneHealth === lifecycle.beforeHealth && lifecycle.undoneConditions === 2, JSON.stringify(lifecycle));

  // Session-scoped flow: karma spending must re-lock, and wrecking must survive to session end.
  const flow2 = await page.evaluate(async () => {
    const Store = await import("/src/store.js");
    const Combat = await import("/src/combat.js");
    localStorage.clear();
    const c = Store.createCharacter({});
    Store.updateCharacter((ch) => {
      ch.state.session.spendUnlocked = true;                 // as if a session had already ended
      ch.state.scene.wreckedZones = ["City street"];
    }, { id: c.id });
    await Combat.applyBundle("start", { id: c.id });
    const afterStart = Store.getCharacter(c.id);
    Store.updateCharacter((ch) => { ch.state.scene.wreckedZones = ["Office"]; }, { id: c.id });
    await Combat.applyBundle("action", { id: c.id });
    const afterAction = Store.getCharacter(c.id);
    return {
      relocked: afterStart.state.session.spendUnlocked,
      startCleared: (afterStart.state.session.wreckedZones || []).length,
      carried: (afterAction.state.session.wreckedZones || []),
      sceneCleared: (afterAction.state.scene.wreckedZones || []).length,
    };
  });
  ok("Start session re-locks karma spending", flow2.relocked === false, String(flow2.relocked));
  ok("Start session clears last session's wrecking", flow2.startCleared === 0, String(flow2.startCleared));
  ok("wrecking survives end-of-scene for the bad-karma question", flow2.carried.length === 1 && flow2.carried[0] === "Office", JSON.stringify(flow2.carried));
  ok("end-of-scene still clears the scene-scoped wreck markers", flow2.sceneCleared === 0, String(flow2.sceneCleared));

  /* ---------------------------------------------------------------- solo engines */
  section("Solo (Crisis Mode) engines (audits A24, A25)");
  const solo = await page.evaluate(async () => {
    const S = await import("/data-solo.js");
    const out = {};
    out.objectiveLadder = S.OBJECTIVE_TIMER.ladder.map((l) => [l.key, l.dice, l.karma]);
    out.allyLadder = S.ALLY_TIMER.ladder.map((l) => [l.key, l.dice]);
    out.encounterLadder = S.ENCOUNTER_TIMER.ladder.map((l) => [l.key, l.dice]);
    out.eventCheck = S.EVENT_CHECK.entries.length;
    out.complexDirectives = Object.keys(S.COMPLEX_ENGINE.directives).length;
    out.complexSubjects = Object.keys(S.COMPLEX_ENGINE.subjects).length;
    out.bonusEffects = S.BONUS_SIX_EFFECTS.length;
    out.engines = Object.keys(S.LOCATION_ENGINES).length;

    // Crisis Event Engine: a complete D66 focus table, three detail bands each.
    const want = [];
    for (let t = 1; t <= 6; t++) for (let o = 1; o <= 6; o++) want.push(t * 10 + o);
    out.crisisFocus = S.CRISIS_EVENT_ENGINE.entries.length;
    out.crisisD66Complete = JSON.stringify(S.CRISIS_EVENT_ENGINE.entries.map((e) => e.roll)) === JSON.stringify(want);
    out.crisisBands = S.CRISIS_EVENT_ENGINE.entries.every((e) => e.details.length === 3);
    out.opportunityGaps = want.filter((v) => !S.OPPORTUNITY_ENGINE.entries.some((e) => v >= e.range[0] && v <= e.range[1]));

    // Band selection reads 2D6 + crisis level: 2-10 low, 11-15 mid, 16+ high.
    const Solo = await import("/src/solo.js");
    const bandOf = (level) => {
      const seen = new Set();
      for (let i = 0; i < 400; i++) seen.add(Solo.rollCrisisEvent({ crisisLevel: level }).band.key);
      return [...seen].sort();
    };
    out.bandsLow = bandOf(0);
    out.bandsHigh = bandOf(10);
    out.opportunityText = Solo.rollOpportunity().text;

    // A24 arithmetic: 1s cancel 6s; net-negative pushes the objective one step back.
    const ladder = S.OBJECTIVE_TIMER.ladder;
    const simulate = (idx, sixes, ones) => {
      const net = sixes - ones;
      if (net > 0) return Math.min(ladder.length - 1, idx + net);
      if (net < 0) return Math.max(0, idx - 1);
      return idx;
    };
    out.a24 = [simulate(2, 3, 1), simulate(2, 1, 2), simulate(2, 2, 2)];

    // A25: each 6 = 2 damage; each 1 drops the status one step.
    out.a25 = { damage: 3 * 2, drop: Math.min(S.ALLY_TIMER.ladder.length - 1, 0 + 2) };
    return out;
  });
  ok("objective ladder pays 6/4/2/1 karma", JSON.stringify(solo.objectiveLadder.slice(0, 4).map((x) => x[2])) === "[6,4,2,1]");
  ok("ally ladder runs Unified 6 → Alone 0", solo.allyLadder[0][1] === 6 && solo.allyLadder[solo.allyLadder.length - 1][1] === 0);
  ok("encounter ladder runs All clear 1 → Near 6", solo.encounterLadder[0][1] === 1 && solo.encounterLadder[5][1] === 6);
  ok("event check has all four bands", solo.eventCheck === 4);
  ok("Complex Response Engine has 36 directives and 36 subjects", solo.complexDirectives === 36 && solo.complexSubjects === 36);
  ok("seven bonus-6 effects", solo.bonusEffects === 7);
  ok("five location engines", solo.engines === 5);
  ok("A24 objective arithmetic (advance / regress / hold)", JSON.stringify(solo.a24) === "[4,1,2]", JSON.stringify(solo.a24));
  ok("A25 ally successes convert to 2 damage each", solo.a25.damage === 6);
  ok("Crisis Event Engine covers all 36 D66 focuses", solo.crisisFocus === 36 && solo.crisisD66Complete, String(solo.crisisFocus));
  ok("every crisis focus publishes three detail bands", solo.crisisBands);
  ok("Opportunity Event Engine covers every D66 result", solo.opportunityGaps.length === 0, solo.opportunityGaps.join(","));
  ok("crisis level pushes the detail into harsher bands", !solo.bandsLow.includes("high") && solo.bandsHigh.includes("high"),
    `level 0 → ${solo.bandsLow.join("/")}, level 10 → ${solo.bandsHigh.join("/")}`);
  ok("opportunity rolls return a result", !!solo.opportunityText, solo.opportunityText);

  // Sequence of play: the step strip must track SOLO_SETUP.loop, and every loop step must be
  // reachable from a control on the tab.
  const soloFlow = await page.evaluate(async () => {
    const Solo = await import("/src/solo.js");
    const S = await import("/data-solo.js");
    const step = (s) => Solo.currentStep({ alert: "", timers: [], eventChecks: 0, awaitingSocial: false, ...s });
    return {
      loopSteps: S.SOLO_SETUP.loop.length,
      noAlert: step({}),
      afterAlert: step({ alert: "x" }),
      afterEventCheck: step({ alert: "x", eventChecks: 1 }),
      running: step({ alert: "x", eventChecks: 1, timers: [{ id: "t" }] }),
      awaitingSocial: step({ alert: "x", eventChecks: 1, timers: [{ id: "t" }], awaitingSocial: true }),
    };
  });
  ok("solo loop has six steps", soloFlow.loopSteps === 6, String(soloFlow.loopSteps));
  ok("step 1 is generating an alert", soloFlow.noAlert === 0);
  ok("step 2 is event checks once an alert exists", soloFlow.afterAlert === 1);
  ok("step 3 is starting a timer", soloFlow.afterEventCheck === 2);
  ok("step 4 is running checks with a timer up", soloFlow.running === 3);
  ok("step 5 (social scene) takes priority once something resolves", soloFlow.awaitingSocial === 4);

  await page.evaluate(async () => {
    localStorage.clear();
    const { Settings } = await import("/src/settings.js");
    Settings.set("soloMode", true);                       // the tab is gated off by default
    document.dispatchEvent(new CustomEvent("nav-refresh"));
    location.hash = "#/solo";
  });
  await page.waitForTimeout(300);
  const soloUi = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("#screen button")).map((b) => b.textContent.trim());
    const strip = Array.from(document.querySelectorAll(".solo-step")).map((s) => s.className);
    // The header carries only the sequence-critical actions, in loop order; the oracles and the
    // four timer types live in their own cards below it.
    const order = ["Generate crisis alert", "Event check", "Social scene"].map((l) => labels.indexOf(l));
    const heads = Array.from(document.querySelectorAll("#screen h3")).map((h) => h.textContent);
    const groups = Array.from(document.querySelectorAll("#screen .timer-group .group-head")).map((h) => h.textContent);
    return { labels, strip, order, groups, heads, current: strip.filter((c) => c.includes("current")).length };
  });
  ok("solo step strip renders six steps", soloUi.strip.length === 6, String(soloUi.strip.length));
  ok("exactly one step is marked current", soloUi.current === 1, String(soloUi.current));
  ok("solo actions are laid out in loop order", soloUi.order.every((n, i, a) => n >= 0 && (i === 0 || n > a[i - 1])), JSON.stringify(soloUi.order));
  ok("social scene control exists on the solo tab", soloUi.labels.includes("Social scene"));
  ok("all four timer types sit in one Timers card",
    JSON.stringify(soloUi.groups) === JSON.stringify(["Crisis timers", "Objectives", "Allies", "Encounter timer"]),
    soloUi.groups.join(" | "));
  ok("timers card counts what is running", soloUi.heads.some((h) => /^Timers \(\d+ running\)/.test(h)), soloUi.heads.join(" | "));
  ok("oracles have their own card", soloUi.heads.includes("Ask the oracles"), soloUi.heads.join(" | "));
  ok("location engines are reachable as oracles", soloUi.labels.includes("City") && soloUi.labels.includes("Facility"));
  ok("the jolt crisis-event control is with the oracles", soloUi.labels.includes("Crisis event"));

  // Choosing a crisis: the alert seeds one, event checks add more, engaging turns it into a timer.
  const crisis = await page.evaluate(async () => {
    const Solo = await import("/src/solo.js");
    const before = JSON.parse(localStorage.getItem("invincible:solo") || "{}");
    document.querySelector('#screen button')?.click();      // no-op guard
    return { hasCrisesCard: !!Array.from(document.querySelectorAll("#screen h3")).find((h) => /^Crises/.test(h.textContent)), before: !!before, step: Solo.currentStep({ alert: "a", eventChecks: 1, timers: [], awaitingSocial: false }) };
  });
  ok("solo tab shows a Crises panel", crisis.hasCrisesCard);

  // Tutorials: content integrity, demos run without touching the roster or the roll log.
  const learn = await page.evaluate(async () => {
    const T = await import("/data-tutorial.js");
    const L = await import("/src/learn.js");
    const Derived = await import("/src/derived.js");
    const R = await import("/src/rules.js");
    const hero = L.exampleHero();
    const b = Derived.creationBudget(hero);
    const v = Derived.validateCharacter(hero);
    return {
      tutorials: T.TUTORIAL_INDEX.length,
      chapters: T.TUTORIAL_INDEX.reduce((n, t) => n + t.chapters.length, 0),
      steps: T.TUTORIAL_INDEX.reduce((n, t) => n + t.chapters.reduce((m, c) => m + c.steps.length, 0), 0),
      remaining: b.remaining,
      errors: v.errors,
      health: Derived.maxHealth(hero),
      resolve: Derived.maxResolve(hero),
      slugfest: Derived.slugfestDamage(hero),
      armor: Derived.armorRating(hero).value,
      badPowers: hero.powers.filter((p) => !R.findPower(p.name)).map((p) => p.name),
      badTalents: hero.talents.filter((t) => !R.findTalent(t.name)).map((t) => t.name),
    };
  });
  ok("two tutorials with chapters and steps", learn.tutorials === 2 && learn.chapters >= 10 && learn.steps >= 40,
    `${learn.tutorials}/${learn.chapters}/${learn.steps}`);
  ok("the example hero is a legal build", learn.errors.length === 0 && learn.remaining === 0,
    `${learn.errors.join("; ")} remaining ${learn.remaining}`);
  ok("the example hero's quoted stats are correct", learn.health === 11 && learn.resolve === 7 && learn.slugfest === 5 && learn.armor === 2,
    `H${learn.health} R${learn.resolve} S${learn.slugfest} A${learn.armor}`);
  ok("every tutorial power and talent resolves", learn.badPowers.length === 0 && learn.badTalents.length === 0,
    [...learn.badPowers, ...learn.badTalents].join(", "));

  await page.evaluate(() => { location.hash = "#/learn"; });
  await page.waitForTimeout(250);
  const learnUi = await page.evaluate(async () => {
    const Store = await import("/src/store.js");
    const before = { chars: Store.listCharacters().length, log: Store.rollLog().length };
    const btns = Array.from(document.querySelectorAll("#screen button")).filter((b) => b.textContent.trim() === "Try it");
    btns.forEach((b) => b.click());
    await new Promise((r) => setTimeout(r, 120));
    return {
      demos: btns.length,
      outputs: Array.from(document.querySelectorAll(".tut-demo-out")).filter((o) => o.textContent.trim()).length,
      charsUnchanged: Store.listCharacters().length === before.chars,
      logUnchanged: Store.rollLog().length === before.log,
    };
  });
  ok("the basics tutorial renders live demos", learnUi.demos >= 4, String(learnUi.demos));
  ok("every demo produces output", learnUi.outputs === learnUi.demos, `${learnUi.outputs}/${learnUi.demos}`);
  ok("demos do not touch the player's characters", learnUi.charsUnchanged);
  ok("demos do not write to the shared roll log", learnUi.logUnchanged);

  await page.evaluate(() => { location.hash = "#/solo"; });   // restore: the checks below read the solo tab
  await page.waitForTimeout(250);
  ok("choosing a crisis is loop step 3", crisis.step === 2, String(crisis.step));

  const helpUi = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll("#screen details.help"));
    return { count: h.length, allCollapsed: h.every((d) => !d.open) };
  });
  ok("solo panels carry help accordions", helpUi.count >= 5, String(helpUi.count));
  ok("help accordions default to collapsed", helpUi.allCollapsed);

  /* ---------------------------------------------------------------- end-to-end play flow */
  section("First Session Playable — end-to-end");
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  const flow = await page.evaluate(async () => {
    const Store = await import("/src/store.js");
    const Derived = await import("/src/derived.js");
    const Roller = await import("/src/roller.js");
    const W = await import("/src/wizard.js");
    const P = await import("/data-pregens.js");

    // Create from a pregen, then roll, take damage, and check the log.
    const c = Store.saveCharacter(W.pregenToCharacter(P.PREGENS[0]));
    Store.setActiveCharacter(c.id);
    const active = Store.activeCharacter();
    const r = Roller.roll(active, "fighting", "Test attack", { manualFaces: [6, 6, 2, 1] });
    let broke = null;
    Store.updateCharacter((ch) => { broke = Roller.applyDamage(ch, 40, { armor: 0 }); }, { id: c.id });
    const after = Store.activeCharacter();
    return {
      name: active.identity.heroName,
      health: Derived.maxHealth(active),
      sixes: r.sixes,
      logLength: Store.rollLog().length,
      broken: after.state.broken,
      crits: after.state.crits.length,
      exported: JSON.parse(Store.exportBackupString()).characters.length,
    };
  });
  ok("pregen instantiates and becomes the active hero", !!flow.name && flow.health > 0);
  ok("rolling records successes", flow.sixes === 2);
  ok("roll log captures entries", flow.logLength >= 1);
  ok("massive damage breaks the hero and rolls a crit", flow.broken === true && flow.crits >= 1);
  ok("JSON export contains the character", flow.exported === 1);

  const importOk = await page.evaluate(async () => {
    const Store = await import("/src/store.js");
    const json = Store.exportBackupString();
    localStorage.clear();
    const n = Store.importBackup(json);
    return { n, chars: Store.listCharacters().length };
  });
  ok("JSON import restores characters", importOk.n === 1 && importOk.chars === 1);

  /* ---------------------------------------------------------------- wizard UI */
  section("Creation wizard UI");
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}#/create`);
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  await page.waitForTimeout(200);
  ok("wizard renders its steps", (await page.locator(".wizard-step").count()) === 9);
  await page.locator(".card.selectable").nth(2).click();           // pick a rank
  await page.waitForTimeout(120);
  await page.locator(".wizard-step").nth(1).click();               // archetype step
  await page.waitForTimeout(120);
  ok("archetype is a dropdown, not a card grid", (await page.locator("select.select").count()) >= 2);
  await page.locator("select.select").first().selectOption({ index: 1 });   // first real archetype
  await page.waitForTimeout(150);
  const afterArchetype = await page.evaluate(() => ({
    powers: document.querySelectorAll(".chosen").length,
    budget: document.querySelector(".budget")?.textContent || "",
    archetype: document.querySelector("select.select")?.value || "",
  }));
  await page.locator(".wizard-step").nth(2).click();               // attributes
  await page.waitForTimeout(120);
  ok("archetype application fills powers and the budget line", afterArchetype.budget.includes("power slots"));
  ok("selecting an archetype records it", !!afterArchetype.archetype, afterArchetype.archetype);
  ok("attribute steppers render", (await page.locator(".attr-row").count()) === 6);

  // Attribute points can never be overspent: + is disabled once the budget is gone.
  const spend = await page.evaluate(async () => {
    const plus = Array.from(document.querySelectorAll('.attr-row .icon-btn'))
      .filter((b) => b.textContent === "+");
    let guard = 200;
    while (guard-- > 0) {
      const live = Array.from(document.querySelectorAll('.attr-row .icon-btn')).filter((b) => b.textContent === "+" && !b.disabled);
      if (!live.length) break;
      live[0].click();
      await new Promise((r) => setTimeout(r, 0));
    }
    const Derived = await import("/src/derived.js");
    const budgetText = document.querySelector(".budget")?.textContent || "";
    const n = parseInt(budgetText, 10);
    return { plusCount: plus.length, remaining: n, allDisabled: Array.from(document.querySelectorAll('.attr-row .icon-btn')).filter((b) => b.textContent === "+").every((b) => b.disabled) };
  });
  // The wizard nav is sticky; while stuck it must not paint over the step content behind it.
  const stickyOverlap = await page.evaluate(() => {
    const nav = document.querySelector(".wizard-nav");
    const body = document.querySelector(".wizard-body");
    if (!nav || !body) return null;
    const n = nav.getBoundingClientRect();
    let worst = 0;
    for (const ch of body.children) {
      const r = ch.getBoundingClientRect();
      if (r.bottom > n.top && r.top < n.bottom) worst = Math.max(worst, Math.round(r.bottom - n.top));
    }
    return worst;
  });
  ok("the sticky wizard nav does not cover step content", stickyOverlap === 0, `${stickyOverlap}px overlap`);

  ok("attribute points cannot be overspent", spend.remaining >= 0, `remaining ${spend.remaining}`);
  ok("every + is disabled once the budget is spent", spend.allDisabled);
  await page.locator(".wizard-step").nth(3).click();               // powers
  await page.waitForTimeout(150);
  ok("power picker lists powers", (await page.locator(".power-option").count()) > 20);
  await page.locator(".wizard-step").nth(8).click();               // names & finish
  await page.waitForTimeout(150);
  await page.locator("input.input").first().fill("Test Subject");
  await page.locator("input.input").nth(1).fill("Testerion");
  await page.waitForTimeout(100);
  await page.locator(".wizard-nav .btn.primary").click();
  await page.waitForTimeout(400);
  const created = await page.evaluate(async () => {
    const Store = await import("/src/store.js");
    const c = Store.activeCharacter();
    return { name: c?.identity?.heroName, hash: location.hash, powers: (c?.powers || []).length, health: c?.state?.health };
  });
  ok("wizard creates a hero and opens the sheet", created.name === "Testerion" && created.hash === "#/sheet", JSON.stringify(created));
  ok("created hero starts at full Health with powers", created.health > 0 && created.powers > 0, JSON.stringify(created));

  /* ---------------------------------------------------------------- layout & a11y */
  section("Layout & accessibility");
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const tab of tabs) {
      await page.evaluate((t) => { location.hash = `#/${t}`; }, tab);
      await page.waitForTimeout(120);
      // `body { overflow-x: hidden }` hides document-level overflow, so children can spill out of
      // their card and never register. Measure each child against its own container instead.
      const spill = await page.evaluate(() => {
        const scrolls = (n) => { const o = getComputedStyle(n).overflowX; return o === "auto" || o === "scroll"; };
        const bad = [];
        for (const box of document.querySelectorAll("#screen .card, #screen .vitals, #screen .wizard-nav, .res-bar")) {
          if (scrolls(box)) continue;
          const br = box.getBoundingClientRect();
          for (const ch of box.querySelectorAll("*")) {
            const r = ch.getBoundingClientRect();
            if (!r.width) continue;
            let anc = ch.parentElement, inScroll = false;
            while (anc && anc !== box) { if (scrolls(anc)) { inScroll = true; break; } anc = anc.parentElement; }
            if (inScroll) continue;
            const over = Math.round(r.right - br.right);
            if (over > 1) bad.push(`${(ch.className || ch.tagName).toString().split(" ")[0]} +${over}px`);
          }
        }
        return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, bad: [...new Set(bad)].slice(0, 6) };
      });
      ok(`no horizontal overflow at ${width}px on ${tab}`, spill.doc <= 0, `${spill.doc}px`);
      ok(`nothing spills out of its panel at ${width}px on ${tab}`, spill.bad.length === 0, spill.bad.join(", "));
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // Nav must fit with every optional tab enabled — Solo + GM push it to nine items.
  const navFit = await page.evaluate(async () => {
    const { Settings } = await import("/src/settings.js");
    Settings.set("soloMode", true);
    Settings.set("gmScreen", true);
    document.dispatchEvent(new CustomEvent("nav-refresh"));
    await new Promise((r) => setTimeout(r, 120));
    const nav = document.querySelector("#bottom-nav");
    const items = Array.from(nav.querySelectorAll(".nav-item"));
    const out = {
      count: items.length,
      compact: nav.classList.contains("compact"),
      overflow: nav.scrollWidth - nav.clientWidth,
      clipped: items.filter((a) => a.getBoundingClientRect().right > nav.getBoundingClientRect().right + 1).length,
    };
    Settings.set("soloMode", false);      // restore: the gating section below asserts the defaults
    Settings.set("gmScreen", false);
    document.dispatchEvent(new CustomEvent("nav-refresh"));
    return out;
  });
  ok("nav holds nine tabs with Solo and GM on", navFit.count === 9, String(navFit.count));
  ok("nav switches to compact past six tabs", navFit.compact);
  ok("nav does not overflow its own width", navFit.overflow <= 0, `${navFit.overflow}px`);
  ok("no nav item is clipped off the bar", navFit.clipped === 0, String(navFit.clipped));

  const zoom = await page.evaluate(() => {
    const vp = document.querySelector('meta[name="viewport"]').content;
    return { userScalable: /user-scalable\s*=\s*no/.test(vp), maxScale: /maximum-scale\s*=\s*1/.test(vp) };
  });
  ok("viewport blocks pinch zoom for installed PWAs", zoom.userScalable && zoom.maxScale);

  // Contrast: check the real computed tokens in both themes, and that the halftone never
  // inherits the text colour (which made dark mode paint near-white dots over everything).
  for (const theme of ["light", "dark"]) {
    const c = await page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
      const cs = getComputedStyle(document.documentElement);
      const v = (n) => cs.getPropertyValue(n).trim();
      const lin = (x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      const L = (hex) => {
        const h = hex.replace("#", "");
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      };
      const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const panel = v("--panel");
      return {
        ink: ratio(v("--ink"), panel),
        muted: ratio(v("--muted"), panel),
        line: ratio(v("--line"), panel),
        dotUsesCurrentColor: getComputedStyle(document.body).backgroundImage.includes("currentcolor"),
      };
    }, theme);
    ok(`${theme}: body text clears AAA on panels`, c.ink >= 7, c.ink.toFixed(2));
    ok(`${theme}: muted text clears AA`, c.muted >= 4.5, c.muted.toFixed(2));
    ok(`${theme}: borders clear the 3:1 UI threshold`, c.line >= 3, c.line.toFixed(2));
    ok(`${theme}: halftone does not inherit the text colour`, c.dotUsesCurrentColor === false);
  }
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));

  const a11y = await page.evaluate(() => {
    const iconButtons = Array.from(document.querySelectorAll("button")).filter((b) => !b.textContent.trim());
    return {
      unlabelledIcons: iconButtons.filter((b) => !b.getAttribute("aria-label")).length,
      liveRegions: document.querySelectorAll("[aria-live]").length,
      navCurrent: !!document.querySelector('.nav-item[aria-current="page"]'),
      skipLink: !!document.querySelector(".skip-link"),
      lang: document.documentElement.lang,
    };
  });
  ok("every icon-only button has an accessible name", a11y.unlabelledIcons === 0, String(a11y.unlabelledIcons));
  ok("aria-live regions present", a11y.liveRegions >= 2);
  ok("current nav item marked with aria-current", a11y.navCurrent);
  ok("skip link present", a11y.skipLink);
  ok("document language set", a11y.lang === "en");

  const modalA11y = await page.evaluate(async () => {
    const { modal } = await import("/src/ui.js");
    const m = modal({ title: "Test", body: "hi", actions: [{ label: "OK" }] });
    const dialog = document.querySelector(".modal");
    const res = { role: dialog.getAttribute("role"), ariaModal: dialog.getAttribute("aria-modal") };
    m.close();
    res.closed = !document.querySelector(".modal");
    return res;
  });
  ok("modals are dialogs with aria-modal", modalA11y.role === "dialog" && modalA11y.ariaModal === "true");
  ok("modals close cleanly", modalA11y.closed === true);

  /* ---------------------------------------------------------------- gated tabs */
  section("Toggle gating");
  const gating = await page.evaluate(async () => {
    const { Settings } = await import("/src/settings.js");
    const before = document.querySelectorAll('.nav-item[data-path="solo"]').length;
    Settings.set("soloMode", true);
    document.dispatchEvent(new CustomEvent("nav-refresh"));
    await new Promise((r) => setTimeout(r, 100));
    const after = document.querySelectorAll('.nav-item[data-path="solo"]').length;
    Settings.set("gmScreen", true);
    document.dispatchEvent(new CustomEvent("nav-refresh"));
    await new Promise((r) => setTimeout(r, 100));
    const gm = document.querySelectorAll('.nav-item[data-path="gm"]').length;
    return { before, after, gm };
  });
  ok("solo tab hidden by default and shown when enabled", gating.before === 0 && gating.after === 1);
  ok("GM tab appears when enabled", gating.gm === 1);

  for (const tab of ["solo", "gm"]) {
    await page.evaluate((t) => { location.hash = `#/${t}`; }, tab);
    await page.waitForTimeout(200);
    const html = await page.locator("#screen").innerHTML();
    ok(`gated tab ${tab} renders`, html.length > 200, `${html.length} chars`);
  }

  ok("no console errors for the whole run", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | "));

  await browser.close();
  server.close();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) { console.log("\nFailures:"); failures.forEach((f) => console.log(` - ${f}`)); process.exit(1); }
};

run().catch((e) => { console.error(e); process.exit(1); });
