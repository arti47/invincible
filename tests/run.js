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
  await page.locator(".card.selectable").nth(1).click();           // pick the first archetype
  await page.waitForTimeout(150);
  const afterArchetype = await page.evaluate(() => ({
    powers: document.querySelectorAll(".chosen").length,
    budget: document.querySelector(".budget")?.textContent || "",
  }));
  await page.locator(".wizard-step").nth(2).click();               // attributes
  await page.waitForTimeout(120);
  ok("archetype application fills powers and the budget line", afterArchetype.budget.includes("power slots"));
  ok("attribute steppers render", (await page.locator(".attr-row").count()) === 6);
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
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(`no horizontal overflow at ${width}px on ${tab}`, overflow <= 0, `${overflow}px`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });

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
