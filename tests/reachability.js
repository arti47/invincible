// reachability.js — shipped code the user can never get to.
//
// The inverse of tests/coverage.js. This walks code -> user; coverage walks source -> code.
// A reachability defect is not a crash and not a wrong answer: it is surface that exists in the
// build and has no route to a person using the app.
//
// FALSE-POSITIVE TRAPS hit while writing this — do not re-investigate these, and do not "fix"
// a detector by removing the guard against them:
//   1. Runtime-assigned identifiers (`el.id = x`, `node.dataset.k = v`) never appear as literals,
//      so grepping for `id="x"` misses them. Element ids here are set through el({ id }), so the
//      detector reads the option object, not markup.
//   2. Names built by concatenation or template (`` `#/${route}` ``, "chip " + cls) look orphaned
//      to a literal search. Route checks resolve against the router's table, not against strings.
//   3. CSS classes used only in compound selectors (.chip.warn) look unstyled to a bare `.warn`
//      grep, and classes that only drive JS behaviour legitimately have no CSS at all. This suite
//      therefore does not assert that every class has a rule.
//   4. Elements inside an inactive route have zero size and no offsetParent. Anything checking
//      visibility must activate the route first, which the DOM-driven checks in tests/run.js do.
//   5. "Can this modal be closed" must match only VISIBLE controls; ui.js renders a hidden close
//      affordance in some variants, which makes a working closer look broken.
//   6. Re-exports (`export { X } from "./y.js"`) are call sites for the purposes of orphan
//      detection but are not usages — the detector counts identifier occurrences, not imports.
//   7. A helper used only by the regression harness looks orphaned to a src-only scan. That IS a
//      true finding about user reachability, but the answer is an exemption naming the reason,
//      not deletion — deleting one of these breaks the suite that reported it.
//   8. A data file may export both the parts and an aggregate over them (TUTORIAL_INDEX gathers
//      the three tutorials), so the orphan-content corpus must include the data files themselves.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "src");

const read = (p) => fs.readFileSync(p, "utf8");
const srcFiles = () => fs.readdirSync(SRC).filter((f) => f.endsWith(".js")).map((f) => path.join(SRC, f));
const dataFiles = () => fs.readdirSync(ROOT).filter((f) => /^data.*\.js$/.test(f)).map((f) => path.join(ROOT, f));

/**
 * Deliberate exemptions. Each says WHY, so a later reader can tell an accepted exception from a
 * regression. Anything not listed here that the detector reports is a real finding.
 */
const EXEMPT = {
  orphanFunctions: {
    // Generic helpers kept as a complete, coherent utility surface. Each is a one-liner with no
    // behaviour of its own, so an unused one is not a feature the user is missing.
    "core.js": ["debounce", "rollTable", "plural", "fmtRange", "titleCase", "signed"],
    // Pure lookups over the data libraries, kept as a complete finder set for the same reason.
    "rules.js": ["powerLevelName", "talentRanks", "hasDrawback", "findGear", "rulesEntry"],
    // Firebase surface that only runs with FIREBASE_ENABLED; local-only mode never calls it.
    "sync.js": ["isEnabled"],
    // Whole-journal wipe with no UI path on purpose: the destructive controls the player gets are
    // per-session (Wipe/Reopen) and Settings' mission wipe, which deliberately spares the journal.
    // Kept because the harness resets state with it. TRAP: deleting this breaks tests/run.js.
    "journal.js": ["clearAll"],
    // Snapshot plumbing called by store.js internals rather than by a UI path.
    "store.js": ["clearUndo", "STORAGE_KEYS",
      // Exported for the regression harness. The UI creates heroes through the wizard, which
      // builds a draft and calls saveCharacter; createCharacter is the headless equivalent.
      "createCharacter"],
    // Exported at v10 purely so the archetype-application path could be driven headlessly across
    // all 16 archetypes x 4 ranks. The UI path is applyArchetype(), which is not exported.
    "wizard.js": ["applyArchetypeTo"],
  },
  orphanContent: {
    // Internal metadata with no player-facing content of its own.
    "data.js": ["GAME", "ARCHETYPE_SOURCE_GAP", "VEHICLE_DATA_FLAGS", "TALENT_INDEX",
      // Rules objects the app shows through its own paraphrase in RULES_LIBRARY. Each id here
      // is asserted to exist by tests/run.js's exempt-list check.
      "ACTIONS", "ACTION_BANTER", "CHALLENGE_RULES", "CHASE_RULES", "DAMAGE_RULES", "DICE_RULES",
      "GENERIC_STUNTS", "HUGE_CREATURE_RULES", "INITIATIVE", "MINION_RULES", "PURCHASE_RULES",
      "WRECKING_RULES"],
  },
};

const exemptFor = (kind, file) => new Set(EXEMPT[kind]?.[path.basename(file)] || []);

export function runReachability(ok, section) {
  section("Reachability");

  const all = srcFiles().map(read).join("\n");

  /* 1 — orphan functions: exported, referenced nowhere but their own declaration. */
  {
    const orphans = [];
    for (const file of srcFiles()) {
      const src = read(file);
      const skip = exemptFor("orphanFunctions", file);
      const names = [...src.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1])
        .concat([...src.matchAll(/^export\s+const\s+(\w+)\s*=/gm)].map((m) => m[1]));
      for (const n of names) {
        if (skip.has(n)) continue;
        const uses = (all.match(new RegExp(`\\b${n}\\b`, "g")) || []).length;
        if (uses <= 1) orphans.push(`${path.basename(file)}::${n}`);
      }
    }
    ok("no exported function is declared and never referenced", orphans.length === 0, orphans.join(", "));
  }

  /* 2 — orphan content: a data table with no screen that shows it. */
  {
    const orphans = [];
    // TRAP: a data file may export both the parts and an aggregate over them (TUTORIAL_INDEX
    // gathers the three tutorials). The parts are reachable through the aggregate, so the corpus
    // must include the data files themselves — searching only src/ reports them as orphans.
    const corpus = all + "\n" + dataFiles().map(read).join("\n");
    for (const file of dataFiles()) {
      const src = read(file);
      const skip = exemptFor("orphanContent", file);
      for (const m of src.matchAll(/^export\s+const\s+([A-Z][A-Z_0-9]*)/gm)) {
        const n = m[1];
        if (skip.has(n)) continue;
        // One occurrence is the declaration itself; a reachable table is named at least twice.
        const uses = (corpus.match(new RegExp(`\\b${n}\\b`, "g")) || []).length;
        if (uses <= 1) orphans.push(`${path.basename(file)}::${n}`);
      }
    }
    ok("no data table is defined and never surfaced", orphans.length === 0, orphans.join(", "));
  }

  /* 3 — broken navigation targets: a link or hash jump to a route the router does not know. */
  {
    const router = read(path.join(SRC, "router.js"));
    const known = new Set([...router.matchAll(/^\s*(?:case\s+)?["']([a-z-]+)["']\s*:/gm)].map((m) => m[1]));
    for (const m of router.matchAll(/path:\s*["']([a-z-]+)["']/g)) known.add(m[1]);
    for (const m of router.matchAll(/["']([a-z-]+)["']\s*:\s*\(/g)) known.add(m[1]);
    const bad = new Set();
    for (const file of srcFiles()) {
      for (const m of read(file).matchAll(/["'`]#\/([a-z-]+)/g)) {
        // Template routes (`#/${x}`) are skipped by the character class above by construction.
        if (!known.has(m[1])) bad.add(`${path.basename(file)} -> #/${m[1]}`);
      }
    }
    ok("every in-app link points at a route the router resolves", bad.size === 0, [...bad].join(", "));
  }

  /* 4 — inert controls: an onclick naming a function that does not exist in that module's scope. */
  {
    const bad = [];
    for (const file of srcFiles()) {
      const src = read(file);
      const declared = new Set([
        ...[...src.matchAll(/function\s+(\w+)/g)].map((m) => m[1]),
        ...[...src.matchAll(/(?:const|let|var)\s+(\w+)\s*=/g)].map((m) => m[1]),
        ...[...src.matchAll(/import\s*\{([^}]+)\}/g)].flatMap((m) => m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop())),
        ...[...src.matchAll(/import\s+\*\s+as\s+(\w+)/g)].map((m) => m[1]),
      ]);
      // onclick: () => name(...)  — a direct call to a bare identifier.
      for (const m of src.matchAll(/onclick:\s*\(\)\s*=>\s*(?:await\s+)?(\w+)\s*\(/g)) {
        const n = m[1];
        if (declared.has(n)) continue;
        if (/^(alert|confirm|prompt|fetch|console|Object|Array|Number|String|Math|JSON|location|document|window|setTimeout)$/.test(n)) continue;
        bad.push(`${path.basename(file)} -> ${n}()`);
      }
    }
    ok("no control is wired to a function that does not exist", bad.length === 0, bad.join(", "));
  }

  /* 5 — missing shipped files: anything the service worker or manifest lists but is not on disk. */
  {
    const sw = read(path.join(ROOT, "service-worker.js"));
    const shell = [...sw.matchAll(/["']\.\/([^"']*)["']/g)].map((m) => m[1]).filter(Boolean);
    const manifest = JSON.parse(read(path.join(ROOT, "manifest.json")));
    const icons = (manifest.icons || []).map((i) => i.src.replace(/^\.\//, ""));
    const missing = [...new Set([...shell, ...icons])].filter((f) => !fs.existsSync(path.join(ROOT, f)));
    ok("every file the build manifest ships exists on disk", missing.length === 0, missing.join(", "));
  }

  /* 6 — shipped files not cached: the inverse, which breaks the app offline. */
  {
    const sw = read(path.join(ROOT, "service-worker.js"));
    const uncached = srcFiles().map((f) => `src/${path.basename(f)}`).filter((f) => !sw.includes(f))
      .concat(dataFiles().map((f) => path.basename(f)).filter((f) => !sw.includes(f)));
    ok("every shipped module is in the offline app shell", uncached.length === 0, uncached.join(", "));
  }

  /* 7 — dead-end guards: a refusal that names somewhere to go but cannot take the user there. */
  {
    const bad = [];
    for (const file of srcFiles()) {
      const src = read(file);
      // A toast/modal telling the user to go to a named screen should not be the whole story when
      // the module has no route to it. Flag messages naming a tab with no matching link anywhere.
      for (const m of src.matchAll(/showToast\(\s*[`"']([^`"']*\b(?:Settings|Home|Sheet|Solo|Action|Journal) (?:screen|tab)\b[^`"']*)/g)) {
        const tab = /Settings/.test(m[1]) ? "settings" : /Home/.test(m[1]) ? "home"
          : /Sheet/.test(m[1]) ? "sheet" : /Solo/.test(m[1]) ? "solo"
          : /Journal/.test(m[1]) ? "journal" : "combat";
        if (!src.includes(`#/${tab}`)) bad.push(`${path.basename(file)}: "${m[1].slice(0, 60)}" with no route to #/${tab}`);
      }
    }
    ok("no guard names a destination it cannot reach", bad.length === 0, bad.join(" | "));
  }

  /* 8 — silent refusals: an early return in a click handler with no feedback of any kind. */
  {
    // A handler that gives up without a toast, modal or announce leaves the user tapping a
    // control that appears to do nothing. Only flagged where the return is the whole branch.
    const bad = [];
    for (const file of srcFiles()) {
      const src = read(file);
      for (const m of src.matchAll(/if\s*\(![\w.?[\]]+\)\s*\{\s*return;?\s*\}\s*\/\/\s*silent/g)) {
        bad.push(`${path.basename(file)}: ${m[0].slice(0, 40)}`);
      }
    }
    ok("no click handler is annotated as silently refusing", bad.length === 0, bad.join(" | "));
  }
}
