# Invincible Player

An installable, offline-capable player-character app for **Invincible — Superhero Roleplaying**:
a creation wizard, a full in-play character sheet, a native dice engine, a searchable rules
library, an NPC compendium, a solo (Crisis Mode) assistant and an opt-in GM screen.

No build step. Vanilla JavaScript and native ES modules — clone it and open it.

## Run it

```bash
# any static server works
npx http-server -p 8080 -c-1 .
# then open http://localhost:8080
```

Opening `index.html` directly from the filesystem also works for most features, but browsers
block service workers on `file://`, so install-to-home-screen and offline caching need a server.

## What it does

- **Creation wizard** — rank → archetype & role → attributes → powers (levels, boosts, limits) →
  power sources → talents & drawbacks → occupation → personality/drive/flaw → names & team, with
  the rules' legality checks applied at every step.
- **Published heroes** — the core book's character stat blocks are instantiable in one tap and
  flagged as published stat blocks rather than point-built heroes.
- **Live sheet** — vitals clamped to true maxima, critical injuries with their dice penalties
  auto-applied, conditions with real mechanical teeth, alternate forms, gear and the Resources
  purchase economy, karma and advancement.
- **Dice engine** — attribute pools, the push economy (including the second push some talents
  allow, and every case where pushing is illegal), stunts, opposed rolls, blocks with
  counterattacks, dodges, attacks, damage with armor, the critical-injury table, rallying,
  stabilising, action banter, purchases, fire, explosions and challenges.
- **In-play systems** — a guided death procedure, rest and recovery, the scene/session/adventure
  lifecycle engine with a confirmation summary and one-step undo, a generic challenge tracker, an
  initiative and combatant tracker with minion and huge-creature handling.
- **Roll log** — every roll recorded with its pool, modifiers, faces and outcome, announced to
  screen readers, capped at the last 100.
- **Backup** — JSON export/import in Settings.
- **Solo play** — the book's Crisis Mode: event checks, the binary and complex response engines,
  location engines, and crisis / ally / objective / encounter timers.
- **GM screen** — party panel, adversary drop-ins and every rollable generator table.

Solo mode and the GM screen are off by default; turn them on in **Settings**.

## Multiplayer (optional)

The app is local-first and fully functional with no configuration. To share a party, combat
tracker and roll log:

1. Create a Firebase project. Enable **Realtime Database**, **Storage** and **anonymous
   authentication** (optionally Google sign-in for cross-device linking).
2. Paste your web config into `firebase-config.js` and set `FIREBASE_ENABLED = true`.
3. Deploy `database.rules.json` as your Realtime Database security rules. They give players
   read/write access to their own sheet plus the shared campaign state, and the GM access to
   everything in their campaign.
4. Create a campaign in Settings and share the join code (e.g. `red-dragon-sword`).

**Never commit real keys to a public repository.** The checked-in config is a placeholder.

## Tests

```bash
npm install    # dev-only: playwright-core
npm test
```

The harness boots the real app in headless Chromium with Firebase requests aborted and asserts
boot/wiring for every tab with zero console errors, the derived-stat formulas, dice-engine
invariants (push legality and cost, the opposed sequence, block counterattacks, stunt damage,
crit stacking, rally and stabilise gating, the purchase ladder), creation legality, lifecycle
bundles and their undo, the solo timer arithmetic, an end-to-end play flow, JSON round-tripping,
zero horizontal overflow at 360/390px on every screen, and accessibility basics.

## Content, accuracy and licensing

Everything mechanical in `data*.js` is extracted from the core rulebook chapters supplied to the
build. Effect and flavour text is **paraphrased**, never copied, and no setting or adventure
content is included. Where the supplied text had gaps or implausible values, they are recorded as
gaps and flagged in the UI rather than guessed at — see **Settings → Known source gaps** and
`CLAUDE.md`.

This is a **personal play aid** built from your own book. If you publish or distribute it,
licensing is your responsibility; openly licensed material (an SRD, or ORC/CC-licensed content)
is the safe basis for anything public. *Invincible — Superhero Roleplaying* is the property of
its publishers; this project is not affiliated with or endorsed by them.

`CLAUDE.md` is the project's canonical specification: the completed system profile, the data
extraction ledger, the build roadmap, the rules-accuracy audit and the changelog.
