# Invincible Player — Canonical Project Spec

> Instantiated from *RPG Player-Character App — Autonomous Build Instructions (v2)*.
> This file is the project's living spec. **Every code change updates it in the same
> change** (features, data model, file tables, roadmap checkboxes, ledger ticks, changelog).

---

## 1. What this is

| | |
|---|---|
| **Game** | *Invincible — Superhero Roleplaying* (Free League / Skybound). Core rules only. |
| **Source supplied** | Chapters 1&2, 3, 4, 5, 6, 7, 8, 9 (Crisis Mode) as markdown text extracts. |
| **Audience** | Players, with an opt-in GM screen. |
| **Platforms** | Phone / browser / desktop — one installable PWA. |
| **Core job** | Character creation wizard + full in-play tracker + native dice engine. |
| **Multiplayer** | Local-first. Firebase party/combat sync architected day one, built in Phase 5. |
| **Backend** | Firebase Realtime Database + Storage; local-only mode needs zero config. |
| **Theme** | Comic-panel: halftone/ink, four-colour accents, heavy display type. Light + dark, default follows system. |

### 1.1 Product Decisions (Stage B)

Answered by defaults per template §4.2 (user directed autonomous execution; defaults recorded here as the decisions of record).

| # | Decision | Value |
|---|---|---|
| 1 | Usage mode | **Local-first with sync later** (template default). Phase 5 gated on First Session Playable. |
| 2 | User's seat | **Rotates** → GM screen built, but behind a toggle (off by default). |
| 3 | Dice input | **Digital + manual physical-dice entry** (roller accepts hand-entered die faces). |
| 4 | Expansion commitment | No expansion books supplied. Core only. Chapter 5 (setting) and Chapter 7 story arcs excluded as setting/adventure content. |
| 5 | Table device | **Mixed** → phone-first baseline, tablet/desktop widen to two columns. |
| 6 | Theme default | **Follow system** (`prefers-color-scheme`), in-app toggle overrides. |

### 1.2 Checkpoint rulings (recorded, §4.1.4)

| # | Ambiguity | Ruling |
|---|---|---|
| R1 | Ch.2 says "sixteen core archetypes (pages 37–44)" but the original extract contained **14**. | **Closed 2026-07-31.** The two absent archetypes (**The Beacon**, **The Bruiser**) were later supplied from the book and are now extracted; all 16 ship. Neither was invented while the gap was open — the wizard's "no archetype / from scratch" path covered it, and still does. |
| R2 | Chapter 8 characters are setting characters, but Ch.5 explicitly sanctions playing established characters (Atom Eve, Rex Splode, Bulletproof). | Include Ch.8 **stat blocks only** (mechanics + a one-line role descriptor, paraphrased). No plot biographies, no setting prose. Hero-side entries double as **pregens** (§3.19); villain-side entries populate the adversary compendium. |
| R3 | Ch.5 (Invincible Universe) and Ch.7 story arcs / city descriptions are setting & adventure content. | **Excluded** per §12. Ch.7's *rules* content (hero ranks, team, base upgrades, base events, random-threat generator tables, social hooks) **is** included — those are mechanical generators. |
| R4 | The game has no skill list. | §3.6 is the **talent list** (the proficiency layer). Recorded as a genuine structural difference, not forced into a skill shape. |
| R5 | The game has no classic meta-currency (no Momentum/Bennies). | §3.3 is **Karma** (advancement currency, earned/lost at session end), plus **Reputation** and **Resources**. Stress-as-fuel (spend Resolve to power exploits) is the in-scene "currency". Recorded honestly; no invented pool. |
| R6 | Encumbrance. | The book explicitly says players don't track carried weight. **No encumbrance system.** Inventory is a list + the Resources purchase economy + the STRENGTH lift-limit reference table. Recorded as a load-bearing near-empty slot. |
| R7 | Crit table 12+ has two entries (head crushed / torn apart). | Both are death; app rolls/offers both flavours, result is "dead" either way. Family-friendly cap at 9 is a documented **house option** in Settings (the book itself offers it). |
| R8 | Ch.6 says Chapter 7 has org tools; Ch.7 says Chapter 6 has them. | Cross-reference error in the source. Team/base tools are taken from **Ch.7** where they actually appear. |
| R9 | Ch.7 "Complications" table entries 61-63 and 64-66 are identical text ("Well-equipped" / "Tough resistance" both read *unusual or advanced gear*). | Transcription artefact in the source. Both entries kept verbatim-as-supplied with a data comment flagging it; no invented replacement text. |
| R10 | Ch.7 Social Hooks D66 table skips 25–41. | Gap in the supplied text. Rolls landing in the gap re-roll; the gap is noted in the data file. |

---

## 2. Source & extraction method

Supplied as eight markdown chapter extracts (complete rules text, no page images). Every
number, list, table and formula in `data*.js` comes from those extracts, cited by chapter in
data-file comments. **Training-data memory of the game was never substituted for the text.**
Known source gaps are listed in §3 slots and the ledger, never filled by invention.

---

## 3. System Profile (completed)

### 3.1 Core resolution mechanic
Dice-pool of **D6**, pool size = the relevant **attribute score** (1–12). A **6** (the ⑤ face)
is a success; **one 6 = success**. Extra 6s beyond the first buy **stunts**. No 6s = failure
(the story must still move forward). **Push**: re-roll every die not showing a 6 or a 1; all
dice count after the re-roll; **each 1 (①) showing after the push costs 1 point of stress**.
Push **once** per roll normally; Compelling/Coordinated/Cunning/Formidable/Insightful/Mighty
allow a **second** push on their attribute (after that second re-roll each ① costs 1 stress).
**Cannot push** when Resolve is 0, on **passive rolls**, or as the **defender** in an opposed
roll. Modifiers are ±dice; **a pool never drops below 1 die**. **Help**: up to 3 allies, +1 die
each (Supportive gives +2). Minions helping minions: bonus cap raised to +9.
Rolls other than pools: **D3** (D6÷2 round up), **2D6**, **D66** (tens die, ones die → 11–66).
*Archetype:* dice-pool counting successes with a stress-costed push (Year Zero family).

### 3.2 Opposed / contested test procedure
**Both sides roll; the active party must (a) succeed and (b) roll more 6s than the adversary.
Each adversary 6 cancels one of the active party's 6s.** Only the **active party** may push.
**Tie** → the active party's action **fails**; if a tie must be broken, **re-roll the whole
opposed roll**.
Combat instances of the same procedure:
- **Block** (vs slugfest): defender spends a **quick action**, declares **before** the attacker
  rolls, rolls **FIGHTING**; each defender 6 cancels an attacker 6. Rolling **more** 6s than the
  attacker → **counterattack**: an automatic-hit slugfest attack using the 6s beyond those needed
  to cancel; a counterattack cannot itself be blocked.
- **Dodge** (vs shooting): quick action, **AGILITY**, declared before the roll; excess 6s = **dodge
  move**, 1 zone per excess 6.
- **Grapple break-free**: opposed **STRENGTH vs STRENGTH** (quick action for the grappled, no
  action for the grappler).
- **Mind Control**: opposed **PRESENCE**; the target does not spend an action to resist.
- **Nullification** against a power about to be used: opposed **PRESENCE**, declared **before the
  target rolls any dice**; on a win the target's action is forfeit.

### 3.3 Meta-currencies & shared pools
No table-level pool economy. What exists:
- **Karma** — personal, no cap, floor 0. Earned at **end of session**: +1 for each "yes" among 10
  questions (action scene, social scene, personality, drive, flaw, risked life for teammate/key
  relationship, saved bystanders, carried out occupation duties, overcame a drawback, extraordinary
  action). **Overcoming your flaw = 2 karma** (and the flaw must then be removed; play one full
  session flawless, then choose a new flaw). **Bad karma**: −1 for each "yes" among 6 (failed a
  teammate/key relationship, failed bystanders, failed occupation duties, **wrecked one or more
  zones**, killed anyone, other immoral deed). Cannot go below 0; cannot lose already-spent karma.
  **Spent only between sessions, in a safe location.** Costs: attribute step **10** (up to rank max)
  then **20** (up to 12); power level **20**; power boost **20**; new power **20** (requires an
  in-game explanation, GM final say); talent **10**; remove a drawback **10**; base upgrade **10**
  (poolable across the team; **20** if no hero meets the upgrade's Resources/occupation prerequisite).
  Training Facilities cut personal-improvement costs by **1/10**; Training Simulator by **2/10**
  (replaces, not stacks). Optional campaign-speed dial: halve or double all costs (GM approval).
- **Reputation** — 0+, set by rank at creation (0/1/2/3), **+3 from Renowned**. On arriving at a
  new scene (if named or distinctive) roll **Reputation dice**; any 6 = recognised (not an attribute
  roll, **cannot be pushed**). Recognised → **+2 dice** to PRESENCE rolls to persuade or intimidate.
  For a team, only the highest-Reputation hero rolls; result applies to all. **+1** after a session
  with a great/terrible publicly-known deed; **−1** if a few months pass with no increase (min 0).
- **Resources** — 1–8 standard-of-living index (see §3.16).
- **Stress-as-fuel** — Resolve is spent (as stress) to power exploits, boosts and pushes; at 0
  Resolve you are **stressed out**: you act normally but cannot push and cannot voluntarily take
  stress for power effects. Negative Resolve is not tracked.
*Crisis events:* a crisis event raises the crisis level by **+1** and is generated from the **Crisis Event Engine** (D66 focus, then **2D6 + current crisis level** for the detail band: 2-10 / 11-15 / 16+), so an escalating crisis produces harsher events. It may also be rolled deliberately whenever the session needs a jolt. **Opportunity events** (D66) are the positive counterpart, prompted by 11-12 on the event check; they are meant to stay rare and may count as a milestone triggering an objective check.
*Solo (Crisis Mode) adds its own counters:* **crisis level** 0–10 (phases 0–3 low / 4–7 medium /
8–10 high) and four timer types (§3.20).

### 3.4 Attributes & scales
**FIGHTING, AGILITY, STRENGTH** (physical) and **REASON, INTUITION, PRESENCE** (mental). Scale
1–12: 1 Poor, 2 Typical, 3 Good, 4 Great, 5 Extraordinary, 6 Incredible, 7 Amazing, 8 Spectacular,
9 Phenomenal, 10 Astounding, 11 Tremendous, 12 Invincible. Untrained civilians = 2.
Generation is **point-spend by rank**:

| Rank | Points | Start max | Powers | Reputation |
|---|---|---|---|---|
| Teen Upstart | 20 | 6 | 2 | 0 |
| Street Defender | 26 | 8 | 3 | 1 |
| Global Guardian (default) | 32 | 10 | 4 | 2 |
| Cosmic Champion | 38 | 12 | 5 | 3 |

Trades (all stay inside the rank's attribute maximum): **−2 attribute points → +1 power**;
**−1 power → +2 attribute points** (minimum 1 power); **−1 attribute point → +1 extra talent**;
**+1 drawback → +1 attribute point** (maximum 2 drawbacks); **−1 attribute point → +1 extra power
source**. Archetypes publish a suggested array tuned for **Global Guardian**; other ranks re-point.

### 3.5 Derived stats
- **Health** = ceil((FIGHTING + AGILITY + STRENGTH) / 2); +2 per **Durable** (max ×5).
- **Resolve** = ceil((REASON + INTUITION + PRESENCE) / 2); +2 per **Determined** (max ×5).
- **Slugfest Damage** = ceil(STRENGTH / 2); modified by STRIKE (+1/+2/+3/+4), EMANATION (+2/+3)
  or SIZE ALTERATION — **these three never combine**.
- **Reputation** = rank base + 3 if Renowned. **Resources** = occupation base +2 per Windfall,
  −2 per Hard Times (floor 1).
- **Lift limit** by STRENGTH (1→150 lb as printed, 2→100, 3→200, 4→400, 5→800, 6→1 ton, 7→3,
  8→10, 9→30, 10→100, 11→300, 12→1,000 tons) — used as the **weight rating** scale by
  TELEKINESIS / MATTER CONTROL / MAGNETISM CONTROL / TRANSFORMATION.
- Knockback / Bang Heads / Slam damage = ceil(**base** STRENGTH / 2) — explicitly **not** Slugfest
  Damage, so STRIKE and EMANATION do not apply.
- Alternate-form drawbacks (Alternate Form, Super Suit, Item Dependent) publish **reduced** scores:
  Alternate Form / Item Dependent halve the **highest three** attributes (round up); Super Suit
  halves **all three physical** attributes; maxima recompute, current values are kept if already lower.

### 3.6 Skills / proficiencies — **the talent list**
The game has **no skills**. Attributes carry resolution; **talents** are the specialisation layer.
**51 talents** extracted (Analysis … Windfall — real count, replacing the pre-extraction estimate). Each talent is acquired once unless its text says
otherwise (**Determined**, **Durable** ×5; **Windfall** unlimited). **Knowledgeable** takes a
subject (D6: Natural Sciences, Social Sciences, Humanities, Technology, Current Events, Esoteric
Lore) and gives **+3 dice** to REASON rolls in it. Starting talents: **one hero talent** (from the
archetype's D6 list, or free choice without an archetype) + **one occupation talent** (D3 from the
occupation's list). Extras cost 1 attribute point each.
Mechanically-typed talents (auto-applied by the engine): flat dice bonuses (Bigger They Are,
Charger, Evasive, Hard Hitter, Manipulator, Medic, Menacing, Pilot, Sharp-Tongued, Sniper,
Stealthy, Streetwise, Subdue, Supportive, Warning Call, Tactical Support), double-push talents,
stat modifiers (Determined, Durable, Renowned, Windfall), action-economy talents (Martial Arts,
Rapid Fire, Commander, Motivator, Defensive, Duck & Weave, Deflection, Guardian, Quickness-likes),
resource talents (Inspiration, Leader, Loner, Merciless, Resilience, Second Wind, Lucky Break,
Killer, Indomitable, Find Weakness, Fast Reflexes, Combat Veteran, Discretion, Unconventional
Wisdom, Investigator, Analysis).

### 3.7 Creation options (rule-legal order)
1 Rank → 2 Archetype & Role → 3 Attributes → 4 Health/Resolve → 5 Powers → 6 Power source(s) →
7 Hero talent → 8 optional extra talents / drawbacks → 9 Occupation (talent, Resources, key
relationship) → 10 Personality (D6 ×2) → 11 Drive → 12 Flaw → 13 Names (real + hero) →
14 Team, base, second key relationship.
**8 roles** (no mechanical effect, guides build): Blaster, Brains, Brawn, Controller, Defender,
Leader, Striker, Wildcard. **All 16 archetypes** (ruling R1, gap closed), each publishing role,
suggested attributes, suggested powers, 3 power sources, 6 hero talents, 6 drawbacks, 3
occupations, 6 personality traits, 3 drives, 3 flaws, 3 hero names.
**22 occupations**, each with 3 occupation talents (D3), a Resources score, 3 key relationships
(D3), and 3 social-scene hooks. **Power sources**: D66 table of 36 + archetype-specific options +
free invention; multiple sources cost 1 attribute point each beyond the first.
Legality: attribute points spent exactly, no score above the rank maximum, power count matches
rank (after trades, min 1), ≤2 drawbacks, Massive powers only at Cosmic Champion (and only with
basic+Major first), **no Monstrous powers at creation**, boosts cost a power slot, a limit either
raises the power one level or grants a boost for that same power and can only be taken when the
power is first acquired.

### 3.8 Shared group entity — **YES: the Team & Team Base**
A team has: name, purpose, background, base location & description, **base upgrades**, and
optionally a **team vehicle**. Starting upgrades by rank: Teen 0, Street 1, Global 2, Cosmic 3
(recommended picks: Concealment, Team Vehicle, Training Facilities). Sample base locations are
published per rank. New upgrades cost **10 karma, poolable across the team**; 20 if nobody meets a
prerequisite (prerequisites that are *other upgrades* can never be bought around). Upgrades
extracted: Comm System, Computer Mainframe, Concealment (×2), Defense System (×2), Holding Cells,
Laboratory, Medical Facilities, Power Effect (repeatable), Team Vehicle, Training Facilities,
Training Simulator, Vehicle Defense (×2), Vehicle Mobility (×2), Vehicle Room, Vehicle Targeting,
Vehicle Weaponry, Workshop (17). **Base Events** D66 table fires per week of play. Team vehicles are
rank-gated. In multiplayer the team is **campaign-level shared state**; GM plus any member may
edit (the book has no restriction — house default: all members write, recorded as a house aid).

### 3.9 Conditions & statuses
No fixed condition list. The real condition layer is:
- **Critical injuries** (12-row table, each with a dice penalty and a healing time) — auto-applied
  to the affected attribute rolls. Multiple crits: **+1 to the roll per existing crit**, and any
  result **≤ your worst existing crit** is bumped **one step worse**; penalties to the same
  attributes **do not stack** — only the worst applies.
- **Broken** (Health 0): out of action — cannot move, roll attributes or use powers.
- **Stressed out** (Resolve 0): act normally, but no pushing and no voluntary stress.
- **Temporary states** from powers/stunts, each auto-applied: *stunned* (miss next turn, no
  interrupts), *immobilised/snared/trapped* (no movement-based actions until freed; break-free
  roll varies by source, −2/−3/−4/−5 dice by SNARE level), *afflicted* (−3, or −4 with Potent
  Affliction, to **all** attribute rolls; movement becomes a full action; shake off with a PRESENCE
  roll at the penalty, no action, one attempt per round on your own turn), *on fire* (Intensity
  dice each round, 2 damage per 6), *blinded/deafened* (miss next turn), *mind-controlled*,
  *darkness* (−2 dice to attacks in-zone, no attacks out of zone, AGILITY roll to leave),
  *storm zone* (movement = full action + STRENGTH roll, shooting −3 dice), *low/high gravity*.
- **Drawbacks** are permanent conditions and are enforced the same way (Overconfident blocks
  pushing above half Health, Bloodlust forces attacks, Phobic costs turns, Reliant accumulates −1s).

### 3.10 Health, damage & death
Health track; **Armor** subtracts from each incoming damage instance (only one armor applies at a
time). At **Health 0** you are **broken**: roll **D6 + damage in excess of what broke you** on the
critical-injury table (excess capped at +6 when the crit comes from the Deadly Hit stunt).
**Damage while broken** = another crit, adding the **full** damage to the D6.
Crit table: 1 torn suit (—) · 2 bruised (−2 FIG/AGL/STR, hours) · 3 bloodied (−2 RSN/ITN/PRS,
hours) · 4 beaten up (−2 phys, days) · 5 concussed (−2 mental, days) · 6 battered (−2 phys, weeks)
· 7 crushed arm (−2 phys, arm unusable, weeks) · 8 crushed leg (−1 phys, ground move = full action,
weeks) · 9 cracked skull (unconscious days, then −2 mental, weeks) · 10 crushed (**dies within a
few hours unless stabilised**; then immobile weeks, then −2 phys, months) · 11 skewered (**dies
within a few minutes unless stabilised**; coma weeks, then −2 all, months) · 12+ dead.
**Rally** (broken, crit ≤ 8): full action, **PRESENCE** roll → regain **1 Health per 6**; the crit
remains. Another character who can communicate with you may rally you with the same roll
(Motivator: quick action, +2 dice; Second Wind: roll STRENGTH +2 instead for yourself; Medic: use
REASON, same zone). **Stabilise** (crits 10/11): advanced medical gear + a **REASON** roll,
**one attempt only** (First aid kit +1, Medical instruments +2 and requires Medic; HEALING's
Miraculous Recovery boost also heals crits).
Family-friendly option (in the book): treat every roll of 9+ as *cracked skull* — Settings toggle.

### 3.11 Rest & recovery

| Span | Health | Resolve |
|---|---|---|
| Action round | none (except HEALING / REGENERATION) | full action, PRESENCE roll, **1 per 6** (self or an ally who can communicate) |
| A few minutes | **STRENGTH rating** restored automatically after the action scene | **PRESENCE rating** — requires a **social scene** |
| A few hours | **all** (rest) | **all** — social scene combined with a break |

REGENERATION heals 1 Health per turn in-scene, all remaining damage a few minutes after, and cuts
crit healing time by **two** time categories. **Loner** recovers Resolve without a social scene.
**Inspiration** converts up to 5 of your stress into an ally's Resolve. **Leader** (full action,
1 stress) restores Resolve equal to 6s rolled to every teammate you can talk to. **Body Battery**
(ELECTRICITY CONTROL boost) restores 3 Resolve per 6, once per zone per action scene, and may
exceed maximum (excess dissipates in minutes). Crit healing times are fixed by the table and only
shorten via REGENERATION or Medical Facilities (halved).

### 3.12 Scene / session / adventure lifecycle
Play is **scenes**: **briefings**, **action scenes**, **social scenes**. Typical flow: briefing →
alternating action/social. A session ≈ one comic issue. Adventures run **Act I first contact →
Act II twist → Act III showdown**, each act with ≥1 action scene and ≥1 social scene per character,
plus prologue/briefing/epilogue.
Boundary bundles the app owns:
- **End Action Scene** → recover Health equal to STRENGTH; clear per-scene flags (once-per-scene
  power uses, Energy Absorption dice, temporary armor/barriers, wrecked-zone marks, on-fire,
  stunned/afflicted states); prompt the Bad Karma question "did you wreck one or more zones?".
- **End Social Scene** → recover Resolve equal to PRESENCE (or all, if combined with hours of
  rest); tick the karma questions for social scene / personality / drive / flaw / key relationship.
- **End Session** → run the **10 karma questions** and **6 bad-karma questions**, apply the net
  (floor 0); apply **Reputation** (+1 great/terrible deed); resolve the flaw cycle (overcome →
  remove → one session flawless → new flaw); unlock karma spending (safe location, between
  sessions); roll the **Base Event** table if a week of play has passed.
- **End Adventure** → clear session-scoped state and log the arc.
Every bundle shows a **confirmation summary** and supports **one-step undo**.

### 3.13 Extended / progress tasks — **Challenges**
A challenge has a **Challenge rating** and a **time limit**. Difficulty guide: simple ≈ rating =
time limit; serious ≈ 2×; major crisis ≈ 3×+. Each challenge publishes **objectives**, each with
the rolls that satisfy it; handling an objective **always requires a roll, even with a power**.
**Every 6 rolled removes 1 point from the Challenge rating.** Reach 0 within the limit → resolved;
otherwise the stated failure happens. Eight published challenges extracted: Burning Building (6,
special), Complex Investigation (4, 2 days), Extreme Weather (8, 4 rounds), Hostage Negotiation
(3, 3 rounds), Doomsday Device (6, 3 rounds), Magical Ward (9, 3 rounds — resets to 8, then −2 dice
cumulative), Runaway Train (4, 3 rounds), Toxic Accident (10, 5 rounds). One **generic progress
tracker** component serves all of them (plus story countdowns and solo objective timers).

### 3.14 Powers — **YES, a full subsystem**
**69 powers** across 6 types: **Attack** (7, FIGHTING or AGILITY), **Control** (26, AGILITY for
shooting, else REASON/INTUITION/PRESENCE — player's choice), **Defense** (7, mostly passive; STRENGTH
if rolled, BARRIER uses a mental attribute), **Modification** (13, STRENGTH/AGILITY/PRESENCE),
**Movement** (7, AGILITY), **Sensory** (9, INTUITION or PRESENCE).
Levels **basic → Major → Massive → Monstrous**, each requiring the one below and each costing a
power slot. **Boosts** (⑤) cost a slot; **limits** (①) are free and either raise the level one
step or grant a boost for the same power, and may only be taken when the power is first acquired.
Using a power normally needs **no roll**; a roll is needed only to push a power past its printed
effect (or in a challenge). **Exploits** = spend stress for extra effect. Powers publish exact
Damage/Range/zone counts per level; area effect hits everyone in the zone, stunts are distributed
per target, each target dodges individually, a miss affects nobody.
Bar for the app: **tap to use** — deduct stress, roll the right attribute, resolve stunts and any
printed table.

### 3.15 Advancement
Karma (§3.3) is the whole loop: earn at end of session, spend between sessions in a safe location.
Identity mechanics that feed it: **personality** (2 traits), **drive**, **flaw** (overcoming = 2
karma + mandatory removal + one flawless session + new flaw), **key relationships** (2: one hero,
one NPC; changeable after any session), **occupation duties**, **drawbacks** (overcoming one in
play = karma; removing one costs 10). New powers require an in-fiction explanation. Reputation
grows/decays independently.

### 3.16 Inventory, encumbrance & wealth
**No encumbrance.** The book states heroes don't track carried weight; the GM disallows the
absurd. Signature equipment is the **SIGNATURE ITEM** power or the **Super Suit** drawback, never
gear. Ordinary gear is a list.
**Resources 1–8** is the wealth index (1 Destitute … 8 Opulent), set by occupation. Purchases
compare **Resources vs item Cost**: higher → automatic; equal → roll Resources dice, need a 6
(**cannot be pushed**), on failure one **PRESENCE** barter attempt, on double failure the item is
unavailable for a few days; lower → impossible without a **loan** (+1 Cost for a few weeks at −1
Resources, or +2 for a few months; Resources 2–3 needs **Streetwise** to borrow, Resources 1 cannot
borrow). Others may **pool** Resources dice into a purchase. **Restricted (R)** items need
**Streetwise** regardless of Resources. Purchased items are consumed/lost after their purpose
unless written on the sheet.
Catalogues extracted: **17 weapons**, **3 body armors**, **17 general gear items** (plus the mobile phone from the price ladder), **21 vehicles**
(+ their Passengers/Maneuverability/Speed/Durability/Armor), **9 vehicle weapons**, the 8-row price
ladder. Weapon features: single use, area effect, full auto, sharp damage, no movement, mounted.
Vehicles use **Durability** (not Health), suffer **component damage** (D6 table) at ≥ half
Durability in one hit, and are wrecked at 0.

### 3.17 Combat structure
**Initiative:** draw one card 1–10 per combatant **every round** (optional: draw only in round 1);
lowest number acts first. GM may draw one card per NPC group. **Surprise attack**: defenders roll
**INTUITION** (passive, no push); failures take the **worst** cards randomly in round 1 only.
**Hold off**: on your turn swap cards with anyone later in the order (they cannot refuse; not with
someone who already acted or who already held off). QUICKNESS-type extra turns draw extra cards.
**Actions:** one **full** + one **quick**, or two quick, in any order; a second quick forfeits the
full. **Interrupt** quick actions occur out of turn and must be declared before dice are rolled;
actions reset each round and never carry over.
**Zones** (~100 ft), open or blocked borders; **altitudes**: ground / **elevated** (rooftop; ground
characters cannot slugfest elevated targets except huge creatures or by power) / **sky high** (own
zone, unreachable, full action to enter or leave) / **in orbit** (needs LIFE SUPPORT or a suit).
Falling: elevated **D6**, sky high **2D6**, AGILITY negates 1 per 6 (a success negates it entirely
if there is anything to grab). **Fastball special**: throw an ally with lower STRENGTH a number of
zones equal to the difference.
**Attacks:** slugfest (full action, FIGHTING, same zone) · **charge** (full + quick, movement into
the target, **STRENGTH**, cannot be blocked but can be dodged, only Double Damage and Slam stunts)
· **grapple** (FIGHTING, blockable, no weapon; while held only movement and grapple attacks; grapple
attacks are unblockable and only Double Damage applies) · shooting (full action, **AGILITY**, range
min/max, under minimum = −3 dice).
**Slugfest stunts** (one per extra 6, each once per target): Double Damage · Knockback · Stun ·
Bang Heads · Trap · Disarm · Deadly Hit (needs sharp) · special/own.
**Shooting stunts**: Double Damage · Suppressed · Trick Shot · Disarm · Deadly Hit · special/own.
**Wrecking a zone** (as part of a slugfest attack, once per zone per scene): terrain table gives the
minimum STRENGTH and the attack bonus (office 4/+1, warehouse 5/+2, city street 6/+3, woods 7/+4,
building 8/+5, cliffs 9/+6); the attack reaches range 1; wrecking a city building levels it and
removes its elevated position; **wrecking gives bad karma**.
**Huge creatures**: can slugfest elevated targets; immune to Knockback, Stun, Slam, Suppressed,
Deadly Hit; cannot be grappled; immune to action banter.
**Minions**: one entity — move together, **Health = number of minions** (1 damage = 1 minion down,
no crits), one Resolve score, powers like SNARE/TELEKINESIS hit the whole group, each may attack
individually but should help each other (+1 die each, cap raised to **+9**).
**Action banter**: quick action, opposed **PRESENCE** in the same zone, 1 stress per excess 6, once
per target per round, useless against huge creatures.
**Chases** are a second engine: no map, only range in zones; each round an opposed **AGILITY** roll
modified by Maneuverability and a **speed-difference bonus**; **both sides may push** (prey first,
then pursuer); winner shifts distance 1 zone per excess 6; distance 0 → immediate unblockable
charge/ram; ~5 zones → chase lost. Obstacles roll D66 before the chase roll. Crew members may each
make one ranged attack after the chase roll (pursuers first).

### 3.18 Bestiary & NPCs
- **Ch.6 stock profiles (25)**: Assassin, Athlete, **Atlantean Warriors (M)**, Automaton,
  **Bystanders (M)**, Commando, Covert Operative, Crime Lord, **Cultists (M)**, Demon, Detective,
  Doctor, **Flaxan Invaders (M)**, **Gangsters (M)**, **Magmanite Underworlders (M)**, **Martial
  Artists (M)**, **Martian Scouts (M)**, News Reporter, **Ninjas (M)**, Police Chief, **Police
  Officers (M)**, Politician, Rognarr, Scientist, **Sequid Swarm (M)**, **Shocktroopers (M)**,
  **Soldiers (M)**, **Thugs (M)**, Vampire, Werewolf, **Zombies (M)** — (M) = minions.
- **18 creatures** (bat … wolf) with attributes, Health and trait lists.
- **NPC build recipe** (attributes → powers only if they'll be used → optional talents → optional
  drawbacks → special abilities → the five "personal stuff" fields: name, appearance, drive, flaw,
  personality). NPCs use the same mechanics as heroes but the GM ignores mechanics unless a PC is
  affected, and broken NPCs need no crit roll (major NPCs do).
- **Ch.8 dramatis personae (61 extracted: 28 hero-side, 33 adversary/supporting)** — stat blocks only per ruling R2.
- No creature in the supplied text is flagged as deliberately unstatted.

### 3.19 Pre-generated characters — **YES (ruling R2)**
The book sanctions playing established characters. Hero-side Ch.8 profiles are instantiable as
pregens; they run on **NPC-economy stat blocks** (published Health/Resolve rather than re-derived
point buys) and are flagged as such in the app. Published starter-set pregens (Metro Mayhem) are
**not** in the supplied text — recorded as a source gap.

### 3.20 Solo rules — **YES: Crisis Mode (Ch.9)**
Solo build tweaks: **+2 attribute points**, **+1 free talent**, prefer self-sufficient powers,
Global Guardian recommended; karma comes from **objective timers** instead of session questions.
Loop: generate a **crisis alert** (from the Ch.7 random-threat tables) → crisis level 0 → event
checks → pick a crisis and start timers → resolve → social scene → repeat.
**FATE tools**: **Event Check** 2D6 (2 = two crisis events & crisis +2; 3–4 = one event & +1;
5–10 = nothing; 11–12 = opportunity). **Binary Response Engine** D6 (1 strong no, 2–3 no, 4–5 yes,
6 strong yes; likely-yes = 2D6 keep highest, likely-no = keep lowest). **Complex Response Engine**
D66 directive + subject. **Location engines**: City, Region, Space, Atmosphere, Facility.
**Bonus-6 effects** table (Confident / Fast / Impressive / Intimidating / Observant / Masterful /
Unnoticed) — one per roll.
**Timers**: **crisis timer** (proximity ladder with threat dice, +1 die for long actions, −1 for
fast; hitting *now* fires the event and raises crisis level by 1), **ally timer** (Unified 6 →
Strained 5 → Diminished 4 → Overwhelmed 3 → Desperate 2 → Last Stand 1 → Alone; +2 expertise, +3
if strongly favoured; each 6 = success, in a fight each 6 = **2 damage**; each 1 drops the status a
step; allies aiding you give **+2 dice**), **objective timer** (Out of reach 1 die/6 karma → Far off
2/4 → Manageable 3/2 → Near 4/1 → Within reach 5 → Achievable 6 → reached; medium crisis −1 die,
high −2; 1s cancel 6s and a net-negative result pushes the objective one step back), and the
**encounter timer** (All clear 1 → Uncertain 2 → Suspected 3 → Confirmed 4 → Closing 5 → Near 6 →
Encountered; movement mode alert/cautious/rushed shifts encounter, INTUITION and crisis dice).
Encounter reveal: **highest die** → behaviour (6 stalking, 5 searching, 4 passive, 2–3 false alarm,
0 ambush); **number of 6s** → threat (1 lesser, 2 greater/group, 3+ overwhelming). Escape = AGILITY
with the published modifier list. Solo recovery: broken characters may still act at **−1 die**, and
may rally "aided" by a memory.
*Note: the supplied Ch.9 crisis-timer table's proximity labels are partly truncated in the source;
the app implements the ladder named in the surrounding prose (distant → approaching → … → now) and
flags the gap in the data file.*

### 3.21 GM tables
Critical injuries (D6+) · Zone terrain · Component damage (D6) · Chase obstacles (D66) · Base
events (D66) · Crime (D66) · Threat rewards (D66) · Criminal-activity complications (D66) ·
Catalyst (D66) · City incidents (D66) · City locations (D66) · City-incident complications (D66) ·
Global danger category (D6) + six D66 danger tables (Extraterrestrial, Supernatural, Criminal,
Natural, Technological, Extra-dimensional) · Global complications (D66) · Social hooks (D66) ·
Power sources (D66) · Knowledgeable subjects (D6) · plus every Crisis Mode engine.

---

## 4. Architecture — LOCKED

No build step; vanilla ES modules loaded directly (`<script type="module" src="src/main.js">`).
Installable PWA (`manifest.json`, network-first `service-worker.js` with `CACHE_VERSION`,
`icon.svg`, update toast). `localStorage` local-only mode works with zero config;
`firebase-config.js` holds a placeholder block + `FIREBASE_ENABLED`. Firebase RTDB + Storage
(portraits compressed client-side to ~400px). Anonymous auth, optional Google link.
`members/{uid}.role: "player"|"gm"` in schema and `database.rules.json` from day one; team
(group entity) write rules likewise. Join codes are memorable phrases (`red-dragon-sword`).
No native `alert/confirm/prompt` — themed `modal()/showToast/confirmModal/promptModal` with focus
trap, Escape, `aria-modal`, focus restore. `aria-live` roll results and vitals; labelled icon
buttons; `aria-current` nav. Phone-first, **zero horizontal overflow at 360px**.

## 5. File structure

| File | Purpose |
|---|---|
| `index.html` | App shell: header, resource bar, screen mount, bottom nav, module entry |
| `styles.css` | Comic theme (light + dark) + all component styles |
| `data.js` | Core rules library — ranks, attributes, powers, talents, drawbacks, archetypes, occupations, gear, vehicles, combat tables, crits, challenges, conditions, karma, base upgrades, GM tables, rules library |
| `data-npcs.js` | Ch.6 stock NPC profiles (incl. minions) + creatures + NPC build recipe |
| `data-monsters.js` | Ch.8 adversary stat blocks (villains & threats) |
| `data-pregens.js` | Ch.8 hero stat blocks, instantiable as pregens |
| `data-solo.js` | Crisis Mode engines, timers and tables |
| `data-tutorial.js` | Tutorial content: the example hero plus the basics and solo chapter/step lists |
| `firebase-config.js` | Placeholder config + `FIREBASE_ENABLED` |
| `database.rules.json` | RTDB rules (player/GM roles, team write rules) |
| `manifest.json`, `service-worker.js`, `icon.svg`, `icon-192.png`, `icon-512.png`, `icon-180.png`, `icon-maskable-512.png` | PWA. The PNGs are generated from `icon.svg` and committed: launchers do not reliably rasterise SVG icons. |
| `tests/`, `package.json`, `package-lock.json` | Headless regression harness (`npm test`), dev-only; the lockfile pins `playwright-core` so the suite is reproducible |
| `README.md` | Setup, Firebase steps, personal-use licensing note |
| `CLAUDE.md` | This file |

### 5.1 `src/` modules

| Module | Responsibility |
|---|---|
| `core.js` | Constants, DOM/util helpers, raw dice (`d6`, `pool`, `d3`, `d66`, `roll2d6`). No imports. |
| `ui.js` | Themed modal/toast/confirm/prompt, sheets, focus management. |
| `rules.js` | Pure lookups over the data libraries (power/talent/gear/archetype/occupation finders, purchase legality, table rolling). |
| `derived.js` | Health/Resolve/Slugfest/Reputation/Resources maxima, crit penalties, condition penalties, alternate-form scores, normalisation/migration. |
| `settings.js` | Toggles (GM screen, solo mode, family-friendly crits, manual dice, advanced automation, theme). |
| `store.js` | Character + team persistence (local/cloud), combat mirror, JSON export/import, undo stack. |
| `sync.js` | Firebase auth, campaigns, join codes, presence, live listeners. |
| `wizard.js` | Creation wizard, team wizard, pregen instantiation. |
| `roller.js` | Dice engine: pools, push economy, stunts, opposed sequence, attacks, powers, challenges, banter, purchases, roll log. |
| `sheet.js` | Character sheet + in-play tracking + persistent resource header. |
| `combat.js` | Initiative, zones/altitude, combatant cards, stunt application, generic progress tracker, lifecycle events. |
| `power-automation.js` | Power activation resolution (cost, roll, effect, exploits, boosts). |
| `solo.js` | Crisis Mode assistant. |
| `learn.js` | Learn screen: first-time-player and Crisis Mode tutorials with live demos. |
| `gm.js` | GM dashboard + rollable table reference. |
| `screens.js` | Home / rules library / compendium / roll log / settings & about. |
| `router.js` | Bottom-nav routing + conditional tab gating. |
| `main.js` | Boot. |

## 6. Data model

```
campaigns/{campaignId}
  meta:    { name, joinCode, createdAt, ownerUid }
  members/{uid}: { displayName, characterId, role: "player"|"gm" }
  team:    { name, purpose, background, rank, base:{ location, description, upgrades[] },
             vehicle:{ type, name, mods[] }, karmaPool }
  combat:  { active, round, initiative[{id,card,acted,held}], zonesWrecked[],
             combatants{ id:{ name, health, maxHealth, resolve, maxResolve, armor,
                              slugfest, attrs{}, minionCount, huge, conditions{}, altitude,
                              zone, actions{full,quick}, crits[] } },
             pendingOpposed{ type, attackerId, defenderId, attackerDice, defenderDice } }
  tasks/{taskId}: { name, rating, remaining, timeLimit, timeSpent, contributors[], objectives[] }
  rollLog/{pushId}: { by, characterName, label, attribute, pool, dice[], sixes, ones,
                      pushed, stressTaken, stunts[], outcome, ts }
  broadcast/{pushId}: { text, ts, from }

characters/{characterId}
  owner, campaignId, schemaVersion
  identity:  { realName, heroName, rank, role, archetype, occupation, powerSources[],
               personality[2], drive, flaw, appearance, keyRelationships[2],
               identitySecret, portraitUrl }
  attributes:{ fighting, agility, strength, reason, intuition, presence }
  derived:   { maxHealth, maxResolve, slugfest, reputation, resources, liftLimit }
  state:     { health, resolve, karma, conditions{ stunned, immobilised, afflicted, onFire,
                 blinded, mindControlled, ... }, crits[{ id, roll, healingTime, healed }],
               broken, dying{ active, deadline, stabiliseAttempted },
               scene{ wreckedZone, poweredUsed[], energyDice, barriers[] },
               session{ karmaAnswers{}, badKarmaAnswers{}, flawState },
               altForm:{ active, source }, restFlags{} }
  talents:   [{ name, subject?, rank }]
  powers:    [{ name, level, boosts[], limits[], source, notes }]
  drawbacks: [{ name, detail }]
  inventory: { items[{ name, qty, damage, bonus, range, armor, features[], equipped, notes }],
               money:{ resources } }
  notes, advancementLog[], createdAt, updatedAt
```
Every schema addition ships a normalisation path in `derived.js` (`normalizeCharacter`) that
back-fills defaults on old saves, and is documented here in the same change.

## 7. Settings & toggle pattern — LOCKED
`Settings.<flag>()` reads a `localStorage` key, off by default, with a toggle row in Settings &
About and a one-line description; UI checks the flag before rendering; the router hides gated
tabs. Explicit choice beats defaults (`true`/`false` stored distinctly from unset).
Toggles: **GM screen** · **Solo (Crisis Mode)** · **Family-friendly crits** (cap at 9) ·
**Manual dice entry** · **Advanced automation** · **Theme** (system/light/dark).

## 8. Build roadmap

- [x] **Phase 0 — Foundations.** All §5 files scaffolded; complete verified core data library;
      theme; PWA shell; router; local storage.
- [x] **Phase 1 — Creation wizard(s).** Rank → archetype → attributes → powers → sources →
      talents/drawbacks → occupation → personality/drive/flaw → names → team, with legality
      validation at every step; team wizard; pregen instantiation.
- [x] **Phase 2 — Core tracker.** Live sheet, vitals clamped to true maxima, crits & conditions,
      inventory + purchases, powers/talents display, notes, portrait; persistent resource header;
      JSON export/import; persistence + migration.
- [x] **Phase 3 — Dice engine.** Pools, push economy, stunts, opposed/block/dodge sequence,
      attacks, purchases, banter, condition penalties auto-applied, tap-to-use powers and talents,
      roll log with `aria-live`, rules-library citation links.
- [x] **🏁 First Session Playable** — create → sheet → roll → track, verified headless end-to-end.
- [x] **Phase 4 — In-play systems.** Guided death/dying procedure; rests with enforced limits;
      scene/session/adventure lifecycle engine with confirmation summary + one-step undo; generic
      challenge/progress tracker; karma advancement loop with gates; local combat helper + compendium.
- [x] **Phase 5 — Multiplayer & sync.** Firebase module, security rules, anonymous auth + Google
      link, campaigns/join codes, party overview, shared combat + roll log, portraits, update toast.
- [x] **Phase 6 — Conditional surfaces.** Solo (Crisis Mode) assistant; GM screen with party panel
      and rollable tables; power-automation engine.
- [x] **Hardening.** Regression harness (`npm test`), accessibility pass, rules-accuracy audit
      (§10) with findings closed.

## 9. Data Extraction Ledger

**How to continue (for any AI resuming this project):** work top to bottom within the current
phase; pull each table from the supplied chapter extracts; corroborate anything surprising against
a second passage before recording it; write the table paraphrased and cited (`// Ch.N`); **tick the
box in the same change** and append a changelog row; replace estimated counts with real counts.
**An unticked box means the data is not extracted — never build UI against an unticked table.**

### `data.js`
- [x] T-01 Attribute list + 1–12 score descriptions (Ch.2)
- [x] T-02 Rank table: points / max / powers / reputation (Ch.2)
- [x] T-03 Creation trade rules (powers↔attributes, talents, drawbacks, sources) (Ch.2)
- [x] T-04 Derived formulas: Health, Resolve, Slugfest Damage (Ch.2)
- [x] T-05 STRENGTH lift/weight-rating table (Ch.2)
- [x] T-06 Standard of living, Resources 1–8 (Ch.2)
- [x] T-07 Karma: 10 earn questions, 6 bad-karma questions, spend costs, training discounts (Ch.2)
- [x] T-08 Reputation rules (recognition roll, growth, decay) (Ch.2)
- [x] T-09 Roles (8) (Ch.2)
- [x] T-10 Occupations ×22: talents, Resources, key relationships, social hooks (Ch.2)
- [x] T-11 Power-source D66 table (36) (Ch.3)
- [x] T-12 Powers ×69: type, effect, levels, boosts, limits (Ch.3)
- [x] T-13 Talents ×51 (real count) + Knowledgeable subjects D6 (Ch.3)
- [x] T-14 Archetypes ×16 (real count — The Beacon and The Bruiser added when supplied; ruling R1) (Ch.2)
- [x] T-15 Drawbacks ×15 (real count) (Ch.3)
- [x] T-16 Dice conventions: D3 / 2D6 / D66, push, help, opposed (Ch.4)
- [x] T-17 Combat: actions, movement, altitude, falling, buildings (Ch.4)
- [x] T-18 Slugfest & shooting stunt lists (Ch.4)
- [x] T-19 Zone terrain / wrecking table (Ch.4)
- [x] T-20 Weapons ×17 + features (Ch.4)
- [x] T-21 Body armor ×3 (Ch.4)
- [x] T-22 Critical injury table + rally/stabilise/multi-crit rules (Ch.4)
- [x] T-23 Recovery table (Health/Resolve by time span) (Ch.4)
- [x] T-24 Minions rules (Ch.4)
- [x] T-25 Challenges ×8 with ratings, limits, objectives (Ch.4)
- [x] T-26 Hazards: disease, explosions, fire/Intensity, vacuum (Ch.4)
- [x] T-27 Vehicles ×21 (real count) + vehicle weapons ×9 + component damage D6 (Ch.4)
- [x] T-28 General gear ×18 + price ladder + purchase/loan rules (Ch.4)
- [x] T-29 Chase rules + obstacles D66 (Ch.4)
- [x] T-30 Team ranks, base locations, starting upgrades, base upgrades ×17 (real count) (Ch.7)
- [x] T-31 Base events D66 + team vehicle by rank (Ch.7)
- [x] T-32 Random threat generators: crime, rewards, complications, catalyst, incidents, locations (Ch.7)
- [x] T-33 Global dangers: category D6 + 6 D66 tables + complications (Ch.7)
- [x] T-34 Social hooks D66 (Ch.7, gap 25–41 noted — ruling R10)
- [x] T-35 Conditions/temporary states derived from power & stunt text (Ch.3/4)
- [x] T-36 Rules-library quick reference entries (all chapters)
- [x] T-37 Scene/session lifecycle bundles (Ch.1/2/6)

### `data-npcs.js`
- [x] T-40 Stock NPC profiles ×31 incl. minion flags (Ch.6) — real count confirmed
- [x] T-41 Creatures ×18 (real count) (Ch.6)
- [x] T-42 NPC creation recipe + handling rules (Ch.6)

### `data-monsters.js`
- [x] T-50 Ch.8 adversary & supporting stat blocks ×33 (real count)

### `data-pregens.js`
- [x] T-60 Ch.8 hero stat blocks ×28 (real count, playable per ruling R2)

### `data-solo.js`
- [x] T-70 Crisis Mode setup, crisis levels, structure (Ch.9)
- [x] T-71 Event check + Binary + Complex response engines (Ch.9)
- [x] T-72 Location engines: City, Region, Space, Atmosphere, Facility (Ch.9)
- [x] T-73 Bonus-6 effects table (Ch.9)
- [x] T-74 Crisis / ally / objective / encounter timers (Ch.9)
- [x] T-75 Encounter behaviour + threat tables, escape modifiers, movement modes (Ch.9)
- [x] T-76 Crisis Event Engine: D66 focus ×36 + 3 detail bands (2D6 + crisis level) (Ch.9)
- [x] T-77 Opportunity Event Engine D66 (Ch.9)

### Recorded source gaps (never invented)
- ~~2 of 16 archetypes absent from the supplied text (T-14).~~ **Closed 2026-07-31** — The Beacon
  and The Bruiser supplied from the book and extracted.
- Starter-set pregens (Metro Mayhem) not supplied.
- Ch.9 crisis-timer proximity labels partially truncated in the supplied table.
- Ch.7 social-hooks D66 rows 25–41 absent.
- Ch.7 complications rows 61-63 / 64-66 duplicate text in the source.
- ~~Ch.4 vehicle table: Durability reads 0 for van / battle tank / capital starship and 1 for the
  SUV — impossible values.~~ **Closed 2026-07-31** — re-extracted from the printed table. The
  damage was wider than the four flagged values: Durability, Speed and Maneuverability were wrong
  on many rows, and the extract carried **negative Maneuverability values that are not in the book
  at all** (a "–" in that column means no modifier). `VEHICLE_DATA_FLAGS` is now empty.

## 10. Rules-accuracy audit

Findings work-list (Rule / Target / Fix / Why) with regression coverage:

| # | Rule | Target | Fix | Verified |
|---|---|---|---|---|
| A1 | A pool never drops below 1 die | `roller.buildPool` | clamp to 1 after all modifiers | `tests/run.js` pool floor |
| A2 | Push re-rolls only dice showing neither 6 nor 1; **all** dice count afterwards; each 1 costs 1 stress | `roller.pushRoll` | keep 6s **and** 1s, re-roll the rest, recount whole pool, charge stress for every 1 present | push invariants test |
| A3 | Push illegal at 0 Resolve, on passive rolls, and for the defender in an opposed roll | `roller.canPush` | explicit gate with reason strings | push legality test |
| A4 | Opposed: active party needs a success **and** more 6s; ties fail; only the active side pushes | `roller.resolveOpposed` | cancel 6s, tie → fail, `canPush` false for defender | opposed test |
| A5 | Block counterattack uses only the 6s **beyond** those needed to cancel, hits automatically, cannot be blocked | `roller.resolveBlock` | surplus-6 accounting | block test |
| A6 | Knockback / Bang Heads / Slam damage = ceil(base STRENGTH/2), **not** Slugfest Damage | `roller.stuntDamage` | read `attributes.strength`, never `derived.slugfest` | stunt damage test |
| A7 | STRIKE / EMANATION / SIZE ALTERATION bonuses never combine | `derived.slugfestDamage` | take the single highest source | derivation test |
| A8 | Crit roll adds damage **in excess** of what broke you; damage while broken adds full damage | `roller.applyDamage` | separate excess vs while-broken paths | damage test |
| A9 | Multiple crits: +1 per existing crit, and results ≤ your worst crit bump one step worse | `rules.rollCriticalInjury` | loop bump | crit test |
| A10 | Crit penalties to the same attributes do not stack — only the worst applies | `derived.critPenalty` | max, not sum | derivation test |
| A11 | Rally is impossible at crit 9+ | `sheet.rally` / `roller.rally` | gate + explanatory message | rally test |
| A12 | Stabilise allows exactly one attempt | `state.dying.stabiliseAttempted` | one-shot flag | dying test |
| A13 | Resources purchase: > cost auto, = cost roll (unpushable) then one PRESENCE barter, < cost blocked without a loan; restricted items need Streetwise | `roller.purchase` | full ladder incl. Streetwise gate | purchase test |
| A14 | Karma floor 0; spending only between sessions in a safe location; attribute step 10 then 20 above rank max | `store.spendKarma` + `combat.applyBundle("start")` | gates + tiered cost; **Start session re-locks spending** so it cannot stay open across sessions | karma test + session re-lock test |
| A15 | Durable/Determined cap at ×5; Windfall unlimited; Renowned +3 | `derived` + wizard | caps enforced | derivation test |
| A16 | Massive powers only at Cosmic Champion; Monstrous never at creation; a level requires the level below | `wizard.validatePowers` | legality checks | wizard test |
| A17 | Max 2 drawbacks at creation | `wizard.validate` | cap | wizard test |
| A18 | Minion group Health = number of minions; no crit rolls | `combat.applyDamage` | minion branch | combat test |
| A19 | Huge creatures immune to Knockback/Stun/Slam/Suppressed/Deadly Hit, ungrappleable, banter-immune | `combat.stuntsFor` | filter | combat test |
| A20 | Afflicted applies −3 (−4 potent) to **all** attribute rolls and is included in the shake-off roll | `derived.conditionPenalty` | applies to every attribute incl. the PRESENCE escape roll | condition test |
| A21 | Reputation recognition roll cannot be pushed | `roller.rollReputation` | `pushable:false` | reputation test |
| A22 | End-of-scene bundle restores Health equal to STRENGTH; end-of-social restores Resolve equal to PRESENCE (all after hours) | `combat.lifecycle` | bundle contents from Ch.4 recovery table | lifecycle test |
| A23 | Lifecycle bundles are undoable in one step | `store.undo` | snapshot before bundle | lifecycle undo test |
| A24 | Solo objective check: 1s cancel 6s; net-negative pushes the objective one step back; medium −1 / high −2 dice | `solo.objectiveCheck` | full arithmetic | solo test |
| A25 | Solo ally check: each 6 = 2 damage in a fight; each 1 drops status one step | `solo.allyCheck` | both effects | solo test |

## 11. Content & IP
Mechanics and numbers only; all effect/flavour text is paraphrased, never copied. No setting,
adventure, art or logo content (rulings R2, R3). This is a **personal play aid** built from the
user's own book — see README for the licensing note.

## 12. Changelog

| Date | Change | Why | Verification | Cache |
|---|---|---|---|---|
| 2026-07-31 | Instantiated CLAUDE.md from template v2: System Profile, rulings R1–R10, product decisions, ledger T-01…T-75, roadmap. | Stage B deliverable. | n/a | — |
| 2026-07-31 | Phase 0: scaffolded all files; extracted the complete core data library (`data.js`, `data-npcs.js`, `data-monsters.js`, `data-pregens.js`, `data-solo.js`); theme; PWA; router; local store. | Data before features. | `npm test` boot smoke, zero console errors | v1 |
| 2026-07-31 | Phases 1–4: creation wizard + team wizard + pregens; live sheet with resource header and export/import; dice engine with push/opposed/stunts/purchases; death procedure, rests, lifecycle engine with undo, challenge tracker, karma advancement, combat helper. | Roadmap. | headless end-to-end + regression suite | v1 |
| 2026-07-31 | Phases 5–6: Firebase sync module, security rules, campaigns/join codes, party & shared combat, roll-log sync; Crisis Mode solo assistant; GM screen with rollable tables; power automation. | Roadmap. | headless suite, all tabs zero errors | v1 |
| 2026-07-31 | Hardening: regression harness, a11y pass, rules audit A1–A25 closed. | §10/§11. | `npm test` green | v1 |
| 2026-07-31 | Corrected pre-extraction estimates to real counts: talents 51 (not 60), drawbacks 15 (not 14), vehicles 21 (not 22), base upgrades 17 (not 19), creatures 18 (not 19), general gear 17 + the price-ladder phone; Ch.8 recorded as 61 stat blocks (28 hero-side / 33 adversary & supporting). | Ledger rule: estimated counts yield to real counts. | Counts asserted in `tests/run.js` "Data integrity". | v1 |
| 2026-07-31 | Recorded a new source gap: four Ch.4 vehicle Durability values are impossible in the supplied text (0/0/0/1). Values kept verbatim, flagged via `VEHICLE_DATA_FLAGS`, surfaced as ⚠ in the rules library and gear catalogue. | §2 hard rule — never fill gaps from memory. | Visible in the vehicles reference table. | v1 |
| 2026-07-31 | Fixed a boot-blocking syntax error in `wizard.js` (unbalanced parentheses in `render()` — the `host.append(` call was closed one paren short). | Root cause: the wizard nav tree closed the element chain but not the append call, so the module never parsed and the app never reached `data-ready`. | Headless boot now reaches `data-ready`; a wizard-UI walkthrough was added to the harness so a broken wizard fails the suite. | v1 |
| 2026-07-31 | Regression harness final state: **120 checks, 0 failures**, zero console errors across every tab at 360px and 390px. | §10.4/§10.5. | `npm test` | v1 |
| 2026-07-31 | Committed `package-lock.json` (dev-only) and listed it in the §5 file table. No app file changed. | A fresh clone had no lockfile, so `npm test` resolved `playwright-core` unpinned; pinning it keeps the suite reproducible. | `npm install` then `npm test` — 120 passed, 0 failed. | — (no shipped file changed) |
| 2026-08-01 | **A location roll now belongs to the Encounter panel that produced it.** "Describe this place" is rolled from the Encounter timer group, but its answer only ever appeared in the modal and (since v16) in the oracles card further up — so the place the encounter is happening in was not where the encounter timer is. Added `state.place` (`{ engine, text, at }`), written by every location-engine roll from any entry point, rendered as a pinned "This place" block inside the Encounter timer group, directly **below the "Describe this place" button that rolls it**, with a **Somewhere else** button to clear it. The "Describe this place" control now also stays available while a timer is running (it previously vanished once one started). `state.lastOracle` is unchanged and still mirrors the roll in the oracles card. | Reported with a screenshot: the Facility Engine result was rolled from the Encounter panel and did not come back to it. A location is scene state, not a passing answer. | `npm test` — 222 passed, 0 failed; 5 new checks: the block starts empty and clears, a roll from the Encounter panel renders inside that panel, the block's top is below the button's bottom, the rendered text matches `state.place`, and it survives navigating away and back. | v18 |
| 2026-08-01 | **Solo tab onboarding and oracle pass — seven reported defects.** (1) A **"do this next" card** now opens the tab: the current loop step by number, one sentence on why it matters, the single button that performs it, and a link into the solo walkthrough (`learn.setLearnTab` deep-links the solo tutorial). Steps whose action lives further down (engage a crisis, check timers) scroll and flash the target panel instead of leaving the player to hunt for it. (2)(3) The **Crisis event** control sat in a button row with no bottom margin, hard against the "Describe a place" heading, and the **Opportunity** engine had no manual trigger at all — it fired only on an 11–12 event check. The oracles card is now three labelled groups (*Answer a question* · *Find out what happens* · *Describe a place*) with rule-bearing separators; Opportunity has its own button beside Crisis event. (4) Oracle answers were lost with their modal. `state.lastOracle` persists the last answer — location, yes/no, complex, crisis event, opportunity and event check all write it — and it renders at the top of the oracles card until cleared. (5) The objective dialog states the book's guiding principle (`OBJECTIVE_TIMER.rules[0]`: name it, give it a starting status, distant objectives progress slower but pay more karma), plus what an objective is *not* (anything one roll settles), and offers the Complex Engine when stuck. (6) Ally groups can be **generated from the Ch.6 minion profiles** — they are already groups-as-one-entity, which is exactly what the ally timer tracks — and the starting-status choices now come from `ALLY_TIMER.start` instead of hand-copied labels. (7) `promptModal` gained `hints` and a `suggest` generator button so both dialogs could carry guidance; dead `oneEvent`/`twoEvents` removed. | Reported from the Solo tab with a screenshot: the two event engines were unreachable, the location roll vanished, and the tab did not say what to do first or next. Nothing new was invented — the guidance is the book's own rules text and the ally generator rolls the book's own profiles. | `npm test` — 217 passed, 0 failed; 17 new checks: the next-step card names the step, explains why, and its action matches `currentStep`; both event engines have controls; the measured gap between the oracle button row and the next heading is ≥12px; a location roll, an opportunity and a crisis event each persist and render in the panel (and the crisis event raises the level and files a crisis); both dialogs carry hints and generators; the generated ally name comes from `NPC_PROFILES`; and the walkthrough link opens the solo tutorial. | v16 |
| 2026-07-31 | **Solo tab regrouped to match how Crisis Mode is actually played.** The four timer types are one concept in Ch.9 — the clock that replaces the GM — but shipped as four sibling cards, so "always keep at least one running" was uncheckable at a glance. They now sit in a single **Timers** card as sections (Crisis · Objectives · Allies · Encounter) with a running count in the heading and a warning when the board is empty. The **location engines** had no stated trigger, sitting in a reference block below the combat reminders; they are now part of a new **Ask the oracles** card (yes/no, complex answer, describe a place, crisis-event jolt) whose help says exactly when to roll one, and they are offered at the two moments the fiction demands a place: after generating an alert ("Where is it?") and when starting an encounter timer ("Describe this place"). The header keeps only sequence-critical actions — alert, event check, social scene, resolve — so the loop strip and the buttons under it tell the same story. Reference block renamed and demoted to last. | Reported: the UI grouping did not match the sequence of play, and the location engines had no obvious use. | `npm test` — 200 passed, 0 failed; 5 new checks: the four timer groups are present and in order, the Timers heading reports a running count, the oracles card exists, all five location engines are reachable from it, and the jolt control sits with the oracles. | v15 |
| 2026-07-31 | **Crisis Event Engine and Opportunity Event Engine extracted** (T-76, T-77) from newly supplied Ch.9 text. 36 D66 focuses × 3 detail bands, plus the 9-row opportunity table. Event checks now roll the real engines instead of borrowing the Complex Response Engine: a 2 rolls two crisis events, 3-4 rolls one, 11-12 rolls an opportunity. Detail band comes from 2D6 + the crisis level *after* the check's own increase, so escalation feeds forward. Added a **Crisis event** button for the book's "if you are ever unsure what happens next" jolt (+1 crisis level, then roll), and both tables render as reference in the engines card. | The tables were supplied; the app had been substituting the Complex Response Engine for crisis events, which is a different generator. | `npm test` — 195 passed, 0 failed (merged with the icon fix); 5 new checks: all 36 D66 focuses present and contiguous, three bands each, no gaps in the opportunity D66, and 400 rolls at crisis level 0 never reach the 16+ band while level 10 does. | v14 |
| 2026-07-31 | **Home-screen icon fixed.** The manifest and `apple-touch-icon` pointed only at `icon.svg`. iOS ignores SVG for `apple-touch-icon` and several Android launchers ignore SVG manifest icons, so both fell back to a **black tile**. Committed rasterised PNGs generated from the same artwork — `icon-192.png`, `icon-512.png` (`purpose: any`), `icon-maskable-512.png` (art scaled to 62% inside a full-bleed background so it survives a 40% safe-zone mask) and `icon-180.png` (square, no rounded corners — iOS applies its own mask). `index.html` now points `apple-touch-icon` at the 180px PNG, the manifest lists PNG entries first and keeps the SVG last as a progressive enhancement, and all four PNGs joined the service-worker app shell. | Root cause: an SVG-only icon set. The format is valid in the manifest but not honoured by the platforms that draw the home screen. | `npm test` — 190 passed, 0 failed; 6 new checks: the manifest ships raster icons and a maskable entry, every declared icon file exists, every icon is precached, `apple-touch-icon` is a PNG, and every icon decodes with non-zero dimensions. | v13 |
| 2026-07-31 | **Tutorials added** (`data-tutorial.js`, `src/learn.js`, route `#/learn`). Two step-by-step guides — *Learn the game* (7 chapters: what you do, first roll, pushing, a fight, getting hurt, between fights, making a hero) and *Learn solo play* (5 chapters: no GM, the loop, the oracles, the four timers, a worked turn) — 51 steps total, each with a worked example and, where useful, an *In the app* pointer. Ten live demos (pool, push, attack, damage+crit, event check, binary, complex, crisis timer, objective, enable solo) roll real dice against `TUTORIAL_HERO`, a fixed legal Global Guardian (FTG 7 AGL 5 STR 6 RSN 4 ITN 4 PRS 6 = 32; Health 11, Resolve 7, Slugfest 5, Armor 2). Demos never touch the roster and never write to the roll log. Reached from a Home card (prominent when the roster is empty) and the Quick reference row — no nav slot, so the bar stays at eight. The solo tutorial ends with a button that switches Crisis Mode on. | A first-time player had no on-ramp: the rules library is reference, not instruction. | `npm test` — 184 passed, 0 failed; 8 new checks: content counts, the example hero validates as a legal build with `remaining === 0`, its quoted stats derive exactly, every power/talent it names resolves, all demos render output, and neither characters nor the roll log change when every demo is fired. | v12 |
| 2026-07-31 | **Layout spill fixed, and the overflow test that missed it replaced.** (1) `.vitals` was a fixed `1fr 1fr` grid; grid items default to `min-width: auto`, so the two steppers (2×44px buttons + a 4.5rem value + padding ≈ 193px each) refused to shrink into the ~160px available and the Resolve `+` button hung 66px outside the card. Now one column by default, two only from 480px, with `min-width: 0` and a 3.5rem value. (2) `.wizard-body` had no room reserved for the sticky `.wizard-nav`, so while stuck the bar painted over the last rank card. Added 4.75rem bottom padding. (3) The layout test only compared `documentElement.scrollWidth` to `clientWidth` — `body { overflow-x: hidden }` makes that always 0, which is why both bugs shipped. It now measures every child against its own panel, skipping legitimate scroll containers. | Both reported from screenshots; the existing regression check was structurally incapable of catching either. | `npm test` — 176 passed, 0 failed; 15 new checks: per-panel spill on all 7 tabs at 360px and 390px, plus a sticky-overlap check on the wizard. | v11 |
| 2026-07-31 | **Archetype selection now spends the budget exactly.** `applyArchetype` scaled the suggested attribute array to `rank.points` while ignoring the power-slot trade, so the budget landed wrong on 12 of 64 rank/archetype combinations — The Bruiser at Teen Upstart came out **4 points over budget**, and 9 combinations at Cosmic Champion left points unspent. Powers are now assigned first and the array is scaled to `creationBudget().available`, which accounts for the ±2 points per power slot traded. `applyArchetypeTo()` exported so the path is testable. | The array totals confirm the point model: the sum of all six scores equals the rank's points, adjusted by trades (The Beacon's 34 = 32 + 2 for one power given up). | `npm test` — 161 passed, 0 failed; new check applies all 16 archetypes at all 4 ranks and asserts `remaining === 0` for every one. | v10 |
| 2026-07-31 | **Attribute budget can no longer go negative**, and long single-choice pickers became dropdowns. The wizard's `+` stepper clamped only to the rank's `attrMax`, never to `budget.remaining`, so points could be spent past the rank allowance and the budget line went negative — legal only as a validation error at the end. `+` is now disabled at `remaining <= 0` (and at `attrMax`), with a toast naming the ways to free points; `−` is disabled at 1. A running "N points left" line sits above the steppers. New `ui.selectField()` replaces card grids and chip rows with labelled `<select>`s: archetype (16), occupation (22), power source (36, plus chips for the multi-select already chosen), role (8), drive/flaw (D3), personality (two slots, duplicate-guarded) and suggested hero names. D3/D6 roll buttons kept alongside each. Rank (4) stays as cards — few options carrying stat lines. | Overspending was reachable in the UI, and the long grids were unusable on a phone. | `npm test` — 160 passed, 0 failed; 4 new checks: archetype renders as a dropdown, selection records, clicking every `+` to exhaustion leaves `remaining >= 0`, and all `+` end disabled. | v9 |
| 2026-07-31 | **Dark-mode contrast fix.** Root cause was structural, not palette values. (1) The halftone was `radial-gradient(currentColor …)`; on `body` that resolves to `--ink`, so dark mode tiled **near-white dots at full opacity** over every surface — now a fixed `--dot` token (4.5% white / 10% ink). (2) `--panel` and `--paper-2` were the same value, so cards never separated from the page — panel is now `#232230` above a `#12111a` page. (3) `--line` was `#000000` in dark, making 3px borders invisible; now `#7b788c` (3.65:1). (4) `.wizard-body` had no surface, so wizard text sat on the bare dotted background — it is now a panel. Muted retuned to `#b6b2c2` (7.55:1) dark / `#55525f` (7.61:1) light; opacity-based dimming on wizard and solo step chips raised. New `--chipbg` replaces an undefined `--ink-soft` fallback. | Reported from an installed dark-mode screenshot: text unreadable against dotted noise, panels edgeless. | `npm test` — 156 passed, 0 failed; 8 new checks computing real contrast ratios from the live tokens in both themes (ink ≥7:1, muted ≥4.5:1, borders ≥3:1) and asserting the halftone never inherits the text colour. | v8 |
| 2026-07-31 | **Usability pass.** (1) Installed PWAs could pinch/double-tap zoom, stranding the fixed bottom nav — viewport now sets `maximum-scale=1, user-scalable=no`, `lockZoom()` in `main.js` cancels iOS gesture and double-tap events (honoured in standalone), and inputs are ≥16px so iOS does not auto-zoom fields. (2) Bottom nav overflowed once Solo/GM were enabled: items were `flex: 1 0 auto; min-width: 56px`, so 9 tabs forced 504px on a 360px screen. Items now shrink (`flex: 1 1 0; min-width: 0`) with an ellipsised label, and the router adds `.compact` past six tabs. (3) Every major panel across Sheet, Action, Solo and GM now carries a collapsed `helpPanel()` explaining what it is for and how to drive it. (4) **Choosing a crisis was impossible** — the alert was one opaque string and event-check events were logged then discarded, so loop step 3 had nothing to choose from. Added `state.crises`: the alert seeds one, each firing event check adds more, and a Crises panel lets you Engage (starts a crisis timer named for it) or Ignore. | Reported after home-screen install: zoom, nav overflow, unclear panels, and no way to perform loop step 3. | `npm test` — 148 passed, 0 failed; 9 new checks: nine-tab nav fit/compact/no-clip, viewport lock, Crises panel present, step-3 mapping, help accordions present and collapsed. | v7 |
| 2026-07-31 | **Play-flow audit (normal + solo).** Four rules-flow defects fixed. (1) `spendUnlocked` was set true by End session/End adventure and never reset, so karma spending stayed open forever including mid-session — violates §3.3 "spent only between sessions". Added a **Start session** bundle (`LIFECYCLE.startSession`) that re-locks it and clears last session's flags. (2) End action scene wiped `scene.wreckedZones` before End session could read it, so the "wrecked one or more zones" bad-karma question could never fire — wrecking is now carried to `session.wreckedZones` (scene markers still clear, per `LIFECYCLE.endActionScene`). (3) End social scene recorded `karmaAnswers.social` but End session ignored it and started from a blank set; the session dialog now pre-ticks what the scene bundles answered (§3.12). (4) End adventure only flipped a flag — it now clears session-scoped state and logs the arc, as its own declared steps say. Also: a social scene played via the lifecycle now satisfies solo loop step 5, which previously stuck. Bundle application extracted to `combat.applyBundle()` so the flow is headlessly testable. | The lifecycle had only "end" bundles and no "begin", so session-scoped state was never reset; three of the four defects follow from that. | `npm test` — 139 passed, 0 failed; 4 new checks: spending re-locks, wrecking survives end-of-scene, scene markers still clear, start clears prior wrecking. | v6 |
| 2026-07-31 | **Solo tab sequence-of-play audit.** `SOLO_SETUP.loop` was extracted but never rendered and the UI contradicted it: "New crisis alert" (step 1) was the last ghost button, "Event check" (step 2) was first and primary, and step 5 (social scene) had no control at all. Fixed: numbered step strip driven by `SOLO_SETUP.loop` with the current step highlighted; actions reordered alert → event check → oracles → social scene → resolve; out-of-sequence taps warn but still run (guide, never block). Added **Social scene** (restores Resolve = PRESENCE, `socialScenes` guidance, social-hooks roll) and **Resolve crisis** (confirmation summary + one-step undo). Movement modes promoted to the header as shared crisis/encounter state. Bonus-6 effects now offered wherever a solo roll leaves a spare 6. Rendered the previously dead `alertNote`, `socialScenes`, `ENCOUNTER_SEQUENCE` and `SOLO_POWER_USE`. | The book's loop is the spec; the tab's control order taught the wrong sequence. | `npm test` — 135 passed, 0 failed; 10 new checks covering `currentStep` for all five states, strip rendering, single current step, DOM button order, and the social-scene control. | v5 |
| 2026-07-31 | Solo play now suppresses the ten earn / six bad-karma session questions in **End session**, replacing them with a pointer to objective karma on the Solo tab. | §3.20 — solo karma comes from objective timers *instead of* the session questions; both paths were open, so karma could be double-counted. | Covered by the solo lifecycle path; `Settings.soloMode()` gates the question loops and the arithmetic. | v5 |
| 2026-07-31 | Verified the Ch.4 weapons (17), body armor, general gear (17) and vehicle weapons (9) tables against supplied page images. One correction: **Riot gear is Restricted (3R)** — the flag was missing, so it could be bought without Streetwise. Body-armor reference table now renders the R suffix. Weapons, gear and vehicle weapons matched on every field. | Same extraction damage class as the vehicle table; these three tables proved clean. | `npm test` — 125 passed, 0 failed; new assertion: every Restricted item is gated by `purchaseCheck`. | v4 |
| 2026-07-31 | **Closed the vehicle source gap**: re-extracted all 21 Ch.4 vehicle rows from the printed table. Corrected Durability on 9 rows (incl. the four impossible 0/0/0/1), Speed on 6, Maneuverability on 7 — the old extract carried negative Maneuverability values that do not appear in the book. `VEHICLE_DATA_FLAGS` emptied; ⚠ markers and "check your book" copy removed from the rules library, gear catalogue and Settings. | The page image was supplied, so the values are now known rather than damaged. §2 — real values yield to the source. | `npm test` — 124 passed, 0 failed; new assertions: 21 vehicles, Durability ≥ 1 on every row, no negative Maneuverability, flags cleared. | v3 |
| 2026-07-31 | **Closed the archetype source gap**: added The Beacon (Leader) and The Bruiser (Brawn) from newly supplied Ch.2 text — 14 → 16. Ruling R1 rewritten as closed, ledger T-14 ticked, §3.7 count corrected, gap struck from §9, `ARCHETYPE_SOURCE_GAP` 2 → 0, wizard and Settings gap copy updated, harness assertion 14 → 16. | The missing pages were supplied; the ledger rule requires estimated/partial counts to yield to real ones. Nothing was invented while the gap was open. | `npm test` — 120 passed, 0 failed, including "16 archetypes" and the cross-reference checks that every archetype talent/power/drawback/occupation resolves. | v2 |
