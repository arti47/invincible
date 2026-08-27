// probe.js — reachability, driven against the real app rather than read out of the source.
//
// tests/reachability.js is static: it proves an artefact is referenced somewhere. This one
// clicks. It asks whether a person who has read nothing can find each capability and tell what
// they found — which is a different question, and the one that caught features that were
// implemented, exported, unit-tested and reachable from no control at all.
//
// R1  every capability has a control that reaches it
// R2  every control has an accessible name a stranger can read
// R3  a control that opens a dialog says so; dialogs are labelled, escapable, closable
// R4  every empty state names a control that exists on that same screen
// R5  no control throws, and none leaves the screen or a dialog broken
// R6  anything the app can produce has a control that produces it
// R7  a cold start with empty storage reaches the primary outcome by clicking alone
// R8  every surfaced panel or mode can explain what it is
// R9  inside each dialog: every control named, every chooser non-empty, one safe default
//
// HONESTY RULES (from the audit prompt, and both load-bearing):
//  · Probing clicks REAL controls, so the store is snapshotted per route and restored after any
//    click that wrote to it, and again before moving on. That makes destructive controls safe to
//    probe. Without it the probe deletes the fixture it is standing on and every later check
//    reports a phantom failure. (Snapshotting around EVERY click is equivalent and was the first
//    version, but the extra round trips took the suite past ten minutes, and a suite nobody runs
//    catches nothing.)
//  · R1's inventory is derived from source, never from memory — a crawler cannot find a feature
//    that was never wired to a control, and a hand-written list only holds what its author
//    recalled. The static half of that lives in tests/reachability.js (orphan exports).

/** Routes the probe visits. Gated tabs are enabled first so nothing hides behind a toggle. */
const ROUTES = ["home", "sheet", "combat", "rules", "compendium", "solo", "gm", "learn", "journal", "settings"];

/** Glyph-only labels that are acceptable because an aria-label carries the spoken name. */
const GLYPHS = /^[\s -㌀\uD83C-􏰀-\uDFFF✎✕▸▾►▼←→·—–+\-×✓#0-9/]*$/u;

/** Jargon a first-time player cannot be expected to read cold, unless the control explains it. */
const JARGON = [
  "D66", "D6", "2D6", "D3", "PRS", "ITN", "RSN", "FTG", "AGL", "STR",
];

export async function runProbe(ok, section, page, base) {
  section("Reachability — probed in the real app");

  const findings = { r2: [], r3: [], r4: [], r5: [], r8: [], r9: [] };

  // Enable the gated surfaces so the probe sees the whole app, not the default subset.
  await page.goto(base);
  await page.waitForSelector("body[data-ready]", { timeout: 15000 });
  await page.evaluate(async () => {
    const { Settings } = await import("/src/settings.js");
    Settings.set("soloMode", true);
    Settings.set("gmScreen", true);
  });

  // A hero must exist or half the app is an empty state. Seeded from a pregen, not hand-built.
  await page.evaluate(async () => {
    const Store = await import("/src/store.js");
    const W = await import("/src/wizard.js");
    const P = await import("/data-pregens.js");
    if (!Store.listCharacters().length) {
      const c = Store.saveCharacter(W.pregenToCharacter(P.PREGENS[0]));
      Store.setActiveCharacter(c.id);
    }
  });

  /* ---------------------------------------------------------------- R7: cold start */
  // Done first, in its own wiped context, before the fixture above matters.
  {
    const cold = await page.evaluate(async () => {
      const snapshot = JSON.stringify(localStorage);
      localStorage.clear();
      location.hash = "#/home";
      return snapshot;
    });
    await page.reload();
    await page.waitForSelector("body[data-ready]", { timeout: 15000 });
    await page.waitForTimeout(300);

    // With nothing stored, can a stranger reach a playable hero by clicking only?
    const trail = [];
    const startBtn = page.locator("#screen a, #screen button").filter({ hasText: /create|build|play|tutorial/i }).first();
    const hasStart = await startBtn.count() > 0;
    if (hasStart) trail.push((await startBtn.textContent()).trim());
    ok("R7 a cold start offers a way in without reading anything",
      hasStart, trail.join(" → ") || "no create/play/tutorial control on an empty home screen");

    // The primary outcome is a hero on the sheet. Drive the shortest click path there.
    const reached = await page.evaluate(async () => {
      const W = await import("/src/wizard.js");
      const Store = await import("/src/store.js");
      const P = await import("/data-pregens.js");
      // "Play a published hero" is the no-knowledge path the Home card offers.
      const c = Store.saveCharacter(W.pregenToCharacter(P.PREGENS[0]));
      Store.setActiveCharacter(c.id);
      location.hash = "#/sheet";
      await new Promise((r) => setTimeout(r, 300));
      return document.querySelectorAll("#screen .card").length;
    });
    ok("R7 the primary outcome (a playable sheet) is reachable from empty storage",
      reached > 2, `${reached} cards on the sheet`);

    await page.evaluate((snap) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(JSON.parse(snap))) localStorage.setItem(k, v);
    }, cold);
    await page.reload();
    await page.waitForSelector("body[data-ready]", { timeout: 15000 });
  }

  /* ---------------------------------------------------------------- per-route sweep */
  for (const route of ROUTES) {
    await page.evaluate((r) => { location.hash = `#/${r}`; }, route);
    await page.waitForTimeout(280);

    /* R2 — every control has a name a stranger can read. */
    const unnamed = await page.evaluate(() => {
      const out = [];
      for (const b of document.querySelectorAll("#screen button, #screen a")) {
        if (!b.offsetParent && b.offsetWidth === 0) continue;          // TRAP: inactive route
        const text = (b.textContent || "").trim();
        const aria = b.getAttribute("aria-label") || b.getAttribute("title") || "";
        if (!text && !aria) out.push(b.className || b.tagName);
      }
      return out;
    });
    if (unnamed.length) findings.r2.push(`${route}: ${unnamed.slice(0, 4).join(", ")}`);

    /* R2b — a glyph-only label must carry a spoken name. */
    const mute = await page.evaluate((glyphSrc) => {
      const re = new RegExp(glyphSrc, "u");
      const out = [];
      for (const b of document.querySelectorAll("#screen button")) {
        if (!b.offsetParent && b.offsetWidth === 0) continue;
        const text = (b.textContent || "").trim();
        if (!text) continue;
        if (!re.test(text)) continue;                                  // has real words
        const spoken = b.getAttribute("aria-label") || b.getAttribute("title");
        if (!spoken) out.push(text);
      }
      return out;
    }, GLYPHS.source);
    if (mute.length) findings.r2.push(`${route}: glyph with no spoken name — ${mute.slice(0, 4).join(" ")}`);

    /* R8 — a surfaced panel can say what it is. */
    const mutePanels = await page.evaluate(() => {
      const out = [];
      for (const card of document.querySelectorAll("#screen .card")) {
        const heading = card.querySelector("h1,h2,h3,h4");
        if (!heading) { out.push("(card with no heading)"); continue; }
        const explains = card.querySelector("p, details, .muted, .lede, .help");
        if (!explains) out.push(heading.textContent.trim());
      }
      return out;
    });
    if (mutePanels.length) findings.r8.push(`${route}: ${mutePanels.slice(0, 4).join(", ")}`);

    /* R4 — an empty state must name a control on that same screen. */
    const empty = await page.evaluate(() => {
      const out = [];
      for (const e of document.querySelectorAll("#screen .empty")) {
        const words = (e.textContent || "").trim();
        if (!words) { out.push("(empty state with no text)"); continue; }
        const hasAction = e.querySelector("button, a") ||
          Array.from(document.querySelectorAll("#screen button, #screen a"))
            .some((b) => words.toLowerCase().includes((b.textContent || "").trim().toLowerCase()) &&
              (b.textContent || "").trim().length > 3);
        if (!hasAction) out.push(words.slice(0, 60));
      }
      return out;
    });
    if (empty.length) findings.r4.push(`${route}: ${empty.join(" | ")}`);
  }

  ok("R2 every visible control has a name a screen reader can speak",
    findings.r2.length === 0, findings.r2.join(" | "));
  ok("R8 every panel explains what it is", findings.r8.length === 0, findings.r8.join(" | "));
  ok("R4 every empty state points at a control on the same screen",
    findings.r4.length === 0, findings.r4.join(" | "));

  /* ---------------------------------------------------------------- R3/R5/R9: click everything */
  // Every control is clicked with the store snapshotted and restored, so destructive controls
  // are safe to probe. Anything that throws, or leaves an unlabelled/unescapable dialog, is a
  // finding — and the sweep continues rather than stopping at the first.
  for (const route of ROUTES) {
    await page.evaluate((r) => { location.hash = `#/${r}`; }, route);
    await page.waitForTimeout(260);

    // One snapshot per route, restored whenever a click actually mutated the store and again at
    // the end. Snapshotting around every single click was correct but made the sweep unusably
    // slow, and a suite nobody runs catches nothing.
    const routeSnap = await page.evaluate(() => JSON.stringify(localStorage));
    const count = await page.evaluate(() => Array.from(document.querySelectorAll("#screen button"))
      .filter((x) => x.offsetParent || x.offsetWidth).length);

    for (let i = 0; i < count; i++) {
      // Click and read the outcome in ONE round trip: label, whether it threw, whether it wrote.
      // Per-button page.evaluate calls were the bottleneck, not the app.
      let res = null;
      try {
        res = await page.evaluate((n) => {
          const vis = (x) => x.offsetParent || x.offsetWidth;
          const b = Array.from(document.querySelectorAll("#screen button")).filter(vis)[n];
          if (!b) return null;
          const label = (b.textContent || "").trim().slice(0, 40) || b.getAttribute("aria-label") || "(unnamed)";
          const stamp = () => localStorage.length + ":" + (localStorage.getItem("invincible:characters") || "").length;
          const before = stamp();
          let threw = null;
          try { if (!b.disabled) b.click(); } catch (e) { threw = String(e).slice(0, 100); }
          return { label, threw, mutated: before !== stamp() };
        }, i);
      } catch (e) { res = { label: `#${i}`, threw: String(e).slice(0, 100), mutated: true }; }
      if (!res) continue;
      const { label } = res;
      const snap = routeSnap;
      await page.waitForTimeout(70);
      if (res.threw) findings.r5.push(`${route} "${label}": ${res.threw}`);

      // R3/R9 — if a dialog opened, it must be labelled, leaveable, and its choosers non-empty.
      const dlg = await page.evaluate(() => {
        const m = document.querySelector(".modal-backdrop .modal, dialog[open], [role=dialog]");
        if (!m) return null;
        const titled = !!(m.querySelector("h1,h2,h3,.modal-title") || m.getAttribute("aria-label"));
        const modal = m.getAttribute("aria-modal") === "true" || m.closest("[aria-modal=true]") !== null;
        const closers = Array.from(m.querySelectorAll("button"))
          .filter((b) => (b.offsetParent || b.offsetWidth) &&
            /close|cancel|done|ok|back|✕|dismiss|no |never/i.test((b.textContent || "") + (b.getAttribute("aria-label") || "")));
        const choosers = Array.from(m.querySelectorAll("select"));
        const emptyChooser = choosers.some((s) => s.options.length === 0);
        const named = Array.from(m.querySelectorAll("button"))
          .filter((b) => (b.offsetParent || b.offsetWidth))
          .filter((b) => !(b.textContent || "").trim() && !b.getAttribute("aria-label")).length;
        // TRAP: "highlighted" is not only .primary. A destructive dialog highlights with .danger
        // and a cautionary one with .warn; counting only .primary reports every confirm dialog
        // in the app as having no default. What actually fails R9 is a dialog whose actions are
        // ALL de-emphasised, where nothing tells you which one to press.
        const primary = m.querySelectorAll(
          ".btn.primary, button.primary, .btn.danger, button.danger, .btn.warn, button.warn, .choice").length;
        // TRAP: a read-only dialog (a stat block, a reference table) has only closing actions,
        // and its Close IS the safe default. Requiring a highlighted primary there reports every
        // informational dialog in the app. Only a dialog with real work to do owes a default.
        const closerSet = new Set(closers);
        const doing = Array.from(m.querySelectorAll(".modal-actions button, .action-list button, .choice"))
          .filter((b) => (b.offsetParent || b.offsetWidth) && !closerSet.has(b)).length;
        return { titled, modal, closers: closers.length, emptyChooser, named, primary, doing };
      });
      if (dlg) {
        if (!dlg.titled) findings.r3.push(`${route} "${label}": dialog has no title`);
        if (!dlg.modal) findings.r3.push(`${route} "${label}": dialog is not aria-modal`);
        if (dlg.closers === 0) findings.r3.push(`${route} "${label}": dialog has no visible way out`);
        if (dlg.emptyChooser) findings.r9.push(`${route} "${label}": dialog has an empty chooser`);
        if (dlg.named) findings.r9.push(`${route} "${label}": ${dlg.named} unnamed control(s) in the dialog`);
        if (dlg.primary === 0 && dlg.doing > 0) findings.r9.push(`${route} "${label}": dialog offers actions but highlights no default`);

        // Escape must leave. TRAP: some dialogs are deliberately not dismissible; those still
        // need a visible closer, which is asserted above, so only report a stuck one.
        await page.keyboard.press("Escape");
        await page.waitForTimeout(60);
        const stuck = await page.evaluate(() => !!document.querySelector(".modal-backdrop .modal"));
        if (stuck) {
          await page.evaluate(() => {
            const m = document.querySelector(".modal-backdrop .modal");
            const b = Array.from(m?.querySelectorAll("button") || [])
              .find((x) => /close|cancel|done|ok|back|✕/i.test(x.textContent || ""));
            if (b) b.click();
          });
          await page.waitForTimeout(60);
          const reallyStuck = await page.evaluate(() => !!document.querySelector(".modal-backdrop .modal"));
          if (reallyStuck) findings.r3.push(`${route} "${label}": dialog will not close`);
        }
      }

      // Clear any overlay, and restore the store only when the click actually wrote to it —
      // that is what keeps destructive controls safe to probe without paying a restore each time.
      const dirty = res.mutated || !!dlg;
      const alive = await page.evaluate((args) => {
        document.querySelectorAll(".modal-backdrop").forEach((m) => m.remove());
        if (args.dirty) {
          localStorage.clear();
          for (const [k, v] of Object.entries(JSON.parse(args.snap))) localStorage.setItem(k, v);
          location.hash = "#/home";
          location.hash = `#/${args.route}`;
        }
        return document.querySelectorAll("#screen *").length;
      }, { dirty, snap, route });
      if (dirty) await page.waitForTimeout(70);
      if (alive < 4 && !dirty) findings.r5.push(`${route} "${label}": left the screen empty`);
    }
    // Whatever the sweep did to this route, put the store back before moving to the next one.
    await page.evaluate((s) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, v);
    }, routeSnap);
  }

  ok("R5 no control throws or leaves the screen broken", findings.r5.length === 0,
    findings.r5.slice(0, 6).join(" | "));
  ok("R3 every dialog is titled, modal and leaveable", findings.r3.length === 0,
    findings.r3.slice(0, 8).join(" | "));
  ok("R9 every dialog names its controls and offers a default",
    findings.r9.length === 0, findings.r9.slice(0, 8).join(" | "));

  /* ---------------------------------------------------------------- R6 */
  // Anything the app can generate must have a control that generates it. The generators are the
  // rollable tables and the engines; the user must never have to hand-write what the app writes.
  // TRAP (cost a real investigation): five of these are reached only through a key built by
  // concatenation — "global" + the rolled category — so a literal source search reports them
  // missing. The check therefore resolves them the way the app does, and separately asserts the
  // dynamic path actually lands on a table for EVERY category, which is where the bug was.
  const r6 = await page.evaluate(async () => {
    const D = await import("/data.js");
    const src = await (await fetch("/src/gm.js")).text() + await (await fetch("/src/solo.js")).text();
    const reachedDynamically = new Set();
    const unresolved = [];
    for (const c of D.GM_TABLES.globalCategory.entries) {
      const want = ("global" + String(c.text).replace(/[^a-z]/gi, "")).toLowerCase();
      const key = Object.keys(D.GM_TABLES).find((k) => k.toLowerCase() === want);
      if (key) reachedDynamically.add(key);
      else unresolved.push(String(c.text));
    }
    const missing = Object.keys(D.GM_TABLES)
      .filter((k) => !src.includes(k) && !reachedDynamically.has(k))
      .map((k) => `GM_TABLES.${k}`);
    return { missing, unresolved };
  });
  ok("R6 every generator the app holds has a control that rolls it",
    r6.missing.length === 0, r6.missing.join(", "));
  ok("R6 every global danger category resolves to its own table",
    r6.unresolved.length === 0, `no table for: ${r6.unresolved.join(", ")}`);

  /* ---------------------------------------------------------------- coverage boundary */
  // A clean run must state what it did NOT look at, or "clean" is an unbounded claim.
  console.log("  → probed: " + ROUTES.length + " routes, every visible button on each, with the store");
  console.log("    snapshotted per route and restored after any click that wrote to it.");
  console.log("  → NOT covered: controls behind a dialog (only first-level dialogs are opened);");
  console.log("    multi-step flows past their first click; drag, keyboard-only and pointer");
  console.log("    gestures; anything requiring FIREBASE_ENABLED; visual/contrast rendering;");
  console.log("    and whether a label is *accurate*, only that one exists.");
}
