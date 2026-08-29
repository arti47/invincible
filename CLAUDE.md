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
**Applied, not just documented:** `identity.solo` is set at creation (pre-ticked when Crisis Mode is
on), `derived.soloAllowance` feeds `creationBudget`, and the wizard's rank step publishes the
recommended talents (Durable, Resilience, Second Wind), the powers to favour (DUPLICATION, HEALING,
QUICKNESS) and to avoid (ACTION PLAN, PRECOGNITION), and the objective-karma note. Data in
`D.SOLO_BUILD`.
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
with the published modifier list.
The **12-step Encounter Check Sequence is driven, not printed**: `state.encounter.phase` walks
`moving` → `revealed` → `standoff` → `fight` → `reset` → `advance`, and each phase offers only the
controls that step allows — check / search / Outmaneuver / Prepare · spotting check (movement mode
applied to both INTUITION rolls) · reveal, ambush, hide, back out, sneak past, escape or draw
initiative · reset the timer from the published list · advance time (crisis timer checks, movement
mode + delay stacking). Drawing initiative starts a real action scene and carries surprise into it. Solo recovery: broken characters may still act at **−1 die**, and
may rally "aided" by a memory.
*The Ch.9 crisis-timer table was re-extracted from the printed page on 2026-08-04; `sourceGap` is
now false and the previously reconstructed ladder has been replaced.*

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
| `data-tutorial.js` | Tutorial content: the example hero plus the basics, solo and worked-session chapter/step lists |
| `firebase-config.js` | Placeholder config + `FIREBASE_ENABLED` |
| `database.rules.json` | RTDB rules (player/GM roles, team write rules) |
| `manifest.json`, `service-worker.js`, `icon.svg`, `icon-192.png`, `icon-512.png`, `icon-180.png`, `icon-maskable-512.png` | PWA. The PNGs are generated from `icon.svg` and committed: launchers do not reliably rasterise SVG icons. |
| `tests/`, `package.json`, `package-lock.json` | Headless regression harness (`npm test`), dev-only; the lockfile pins `playwright-core` so the suite is reproducible. `tests/run.js` is the browser suite; `tests/reachability.js` and `tests/coverage.js` are static specs that need no browser and run **first**; `tests/probe.js` drives the real app, clicking every control on every route (§12.5) |
| `docs/coverage.json`, `docs/COVERAGE.md` | Source-document → code coverage map and the guide to extending it (§12) |
| `docs/solo-guide.pdf`, `docs/solo-guide.html` | Generated 23-page Solo Play Guide (A4, mono). Rebuild with `npm run guide` |
| `docs/build-guide.mjs`, `docs/guide-content.mjs` | Guide build script (seeded, drives the real solo engines) + its prose and layout |
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
| `journal.js` | The campaign record: one timeline per hero, absorbing the roll log and receiving solo, lifecycle and state events |
| `solo.js` | Crisis Mode assistant, including the editable crisis log. |
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
               identitySecret, portraitUrl, solo }
  attributes:{ fighting, agility, strength, reason, intuition, presence }
  derived:   { maxHealth, maxResolve, slugfest, reputation, resources, liftLimit }
  state:     { health, resolve, karma, conditions{ stunned, immobilised, afflicted, onFire,
                 blinded, mindControlled, ... }, crits[{ id, roll, healingTime, healed }],
               broken, dying{ active, deadline, stabiliseAttempted },
               scene{ wreckedZone, poweredUsed[], energyDice, barriers[] },
               session{ karmaAnswers{}, badKarmaAnswers{}, flawState, stage },
               altForm:{ active, source }, restFlags{} }
  talents:   [{ name, subject?, rank }]
  powers:    [{ name, level, boosts[], limits[], source, notes }]
  drawbacks: [{ name, detail }]
  inventory: { items[{ name, qty, damage, bonus, range, armor, features[], equipped, notes }],
               money:{ resources } }
  notes, advancementLog[], createdAt, updatedAt

journal (localStorage `invincible:journal`)
  sessions: [{ id, title, characterId, startedAt, endedAt }]
  entries:  [{ id, at, sessionId, characterId, kind, text, detail{}, note }]
            kind: note | roll | solo | lifecycle | state
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
- ~~Ch.9 crisis-timer proximity labels partially truncated in the supplied table.~~ **Closed 2026-08-04** —
  re-extracted from the printed page: the ladder is Remote 6 · Distant 5 · Approaching 4 · Soon 3 ·
  Looming 2 · Imminent 1 · Now, and a new timer's rung comes from 2D6 read against the crisis-phase
  column. The old reconstruction was missing **Remote** and carried two invented rungs.
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

## 12. The two audit specs

Two committed specs run before the browser suite. They walk in **opposite directions** and
neither substitutes for the other:

| spec | direction | catches | file |
|---|---|---|---|
| Reachability | code → user | shipped surface nobody can reach | `tests/reachability.js` |
| Coverage | source doc → code | a documented rule never implemented | `tests/coverage.js` |

A reachability suite stays green on an app missing half its rulebook, because an unimplemented
feature leaves no artefact to detect. A coverage suite stays green on an app whose every feature
is unreachable. Both, or neither is worth much.

**They run first, before the browser launches.** Ordered last they were skipped silently whenever
the app failed to boot — which is exactly when you most want to know what drifted. Proven: renaming
`roller.resolveBlock` aborted the browser section before the static specs ever ran.

### 12.1 Reachability — the eight classes

Orphan functions · orphan content · broken navigation targets · inert controls (a handler naming a
function that does not exist) · missing shipped files · shipped modules absent from the offline
app shell · dead-end guards (a refusal naming a destination it cannot reach) · silent refusals.
Every check **names its offenders**, so a red build is a work list.

**Exemptions live inline in the spec with their reason**, so a later reader can tell an accepted
exception from a regression: generic `core.js`/`rules.js` helper sets kept complete; Firebase
surface that only runs with `FIREBASE_ENABLED`; `Store.createCharacter` and `wizard.applyArchetypeTo`
exported for the harness; `Journal.clearAll` (no UI on purpose — the player's destructive controls
are per-session, and Settings' mission wipe deliberately spares the journal); and the rules objects
the app shows through a `RULES_LIBRARY` paraphrase.

### 12.2 False-positive traps (each cost a real investigation — do not re-litigate)

1. Runtime-assigned identifiers (`el.id = x`) never appear as literals; grepping markup misses them.
2. Names built by concatenation or template look orphaned to a literal search.
3. CSS classes in compound selectors (`.chip.warn`) look unstyled to a bare `.warn` grep, and
   JS-only classes legitimately have no CSS — so the suite does **not** assert class coverage.
4. Elements inside an inactive route report zero size and no offset parent.
5. "Can this modal be closed" must match only **visible** controls.
6. Re-exports are not usages.
7. **A helper used only by the harness looks orphaned to a src-only scan.** That is a true finding
   about *user* reachability, but the answer is an exemption naming the reason, not deletion —
   deleting `Journal.clearAll` broke the very suite that reported it.
8. **A data file may export both the parts and an aggregate over them** (`TUTORIAL_INDEX` gathers
   the three tutorials), so the orphan-content corpus must include the data files themselves.

### 12.3 Coverage — and its honesty problem

`docs/coverage.json` holds 144 requirements: 137 implemented, 2 partial, 4 deliberately omitted,
1 unknown. Markers are `file#exportedSymbol` or `file::test name`; the 20 `A-*` entries point at
**behavioural tests** rather than implementations, because a constant can exist holding wrong
values — the spec proves a *mapping*, never correctness.

**The chapter extracts are not in this repository** (they are the user's own book, §11). Entries
were seeded from §9's extraction ledger and §3's System Profile, and the project owner has attested
that the extraction (`data*.js`, `src/`) is reliable — recorded as `provenance: "owner-attested"`.

**Correctness and completeness are different properties, and only one is attested.** The owner's
attestation says the extracted numbers are *right*; it cannot say they are *complete*, because an
unextracted rule leaves no artefact anywhere in the repository — not in `data.js`, not in `src/`,
not in the ledger. So the audit detects **regression** and **drift**, never **omission**. Three
provenance levels are defined (`project-ledger` · `owner-attested` · `source`); only `source`
supports omission detection, and the spec fails if an entry claims it while the extracts are
absent, so the top level cannot be claimed by assertion. `docs/COVERAGE.md` is the promotion
procedure.

**The list is deliberately not built from `data.js`,** despite that file looking like source
material — 289 KB of paraphrased rules with `// Ch.N` citations. A checklist derived from the
implementation maps perfectly onto the implementation and passes forever while proving nothing.
`data.js` cannot testify that `data.js` is complete.

21 entries carry a `count`, checked against the live module, so CLAUDE.md's stated figures and the
data cannot drift apart unnoticed. All 22 counts agreed when this was introduced. Counts printed by
`npm test` mean "everything we wrote down is implemented" — a weaker claim than a percentage looks.

### 12.4 Both specs are proven to fail

A spec that only ever passes reads like assurance and is worth nothing, so each check was driven
red with an injected defect and green again after restoring: an unreferenced export, an orphan
table, `#/nowhere`, `onclick: () => noSuchHandler()`, a manifest entry with no file, a module
dropped from the app shell, a renamed marker, a stripped citation, a stripped marker, a `partial`
with no note, an omission secretly carrying a live marker, and a false `provenance: "source"`
claim. The runner exits non-zero, so it works as a pre-commit hook or CI gate.

## 12.5 The probe — reachability driven against the running app

`tests/reachability.js` is static: it proves an artefact is *referenced*. `tests/probe.js`
**clicks**. It asks the different question — can someone who has read nothing find each capability
and tell what they found — across nine checks:

| | check |
|---|---|
| R1 | every capability has a control that reaches it (static half lives in `reachability.js`) |
| R2 | every visible control has a name a screen reader can speak |
| R3 | every dialog is titled, `aria-modal`, and leaveable by Escape or a visible control |
| R4 | every empty state names a control on that same screen |
| R5 | no control throws or leaves the screen broken |
| R6 | every generator the app holds has a control that rolls it |
| R7 | a cold start with empty storage reaches a playable sheet by clicking alone |
| R8 | every panel explains what it is |
| R9 | inside each dialog: controls named, choosers non-empty, a default where there is work to do |

**The store is snapshotted before every click and restored after**, which is what makes clicking
destructive controls safe; without it the probe deletes the fixture it is standing on and every
later check reports a phantom failure. R7 runs first, in wiped storage, and restores afterwards.

**Proven to fail.** The probe was driven red with an injected defect and green again after
restoring: a `<button>` labelled `⚙` with no `aria-label` reported
`R2 ... compendium: glyph with no spoken name — ⚙` and exited non-zero.

**A clean run prints its own boundary** — 10 routes and every visible button on each — and states
what it does *not* cover: controls behind a dialog (only first-level dialogs are opened),
multi-step flows past their first click, drag/keyboard/pointer gestures, anything needing
`FIREBASE_ENABLED`, visual rendering, and whether a label is *accurate* rather than merely present.
"Clean" is a bounded claim, not an unbounded one.

## 12.6 Standing rules

- Every bug fix adds a check that would catch its return.
- Find the root cause before editing. Record cause and fix, not just the fix.
- Verify in the real runtime, not by reading the diff. "The syntax is valid" is not verification;
  zero console errors is part of passing.
- Every audit reports **all** findings per run, never stop-on-first.
- A clean run states what it covered and what it did not.
- When a check is disabled, skipped or optional, say so in the output — a silent skip reads
  exactly like a pass.
- Keep the spec and the code in the same commit. A change with a stale spec is not finished.

---

## 13. Changelog

| Date | Change | Why | Verification | Cache |
|---|---|---|---|---|
| 2026-08-04 | **Closed the crisis-timer source gap.** The printed Ch.9 table was supplied as a page image. The reconstruction built from surrounding prose was wrong in three ways: it was **missing the Remote rung entirely** (6 threat dice, the slowest start), and it carried two invented rung names — *Close* and *Next moment* — where the book prints **Soon** and **Looming**. The real ladder is Remote 6 · Distant 5 · Approaching 4 · Soon 3 · Looming 2 · Imminent 1 · Now. The fabricated `startByPhase` (one fixed rung per phase) is replaced by the book's actual rule: **2D6 read against the column for the current crisis phase**, so a high crisis can never start Remote and only medium/high can start Imminent. `rollStartProximity()` implements it and the new-timer dialog now offers every rung plus the roll. Separately verified the Ch.7 **Social Hooks D66** table against its page image: all 27 rows and every D66 value match, and the 25–41 gap is in the **printed table itself**, not extraction damage — ruling R10 stands. | The page images were supplied, so reconstructed values yield to the source (§2). | `npm test` — 391 passed, 0 failed; 5 new checks: the ladder's keys and dice, `sourceGap` false, every phase column covering 2–12, and 300 rolls confirming a high crisis never starts Remote nor a low one Imminent. Guide rebuilt: the proximity table now prints all three 2D6 columns. | v44 |
| 2026-08-03 | **Per-session wipe and reload.** Each session heading now carries **Wipe** and, when closed, **Reopen**; a **Sessions…** picker in the header reaches any of them without scrolling. Wiping asks which it means — *Keep my writing* removes only the heading and leaves the entries unfiled, *Delete everything* removes both — because destroying a session boundary should never silently destroy the prose under it. Either way it snapshots first, so the toast's Undo restores it. Reopening a closed session files new entries under it again and closes whichever session was current, since only one is ever open. New `Journal.deleteSession`/`clearSessionEntries`/`reopenSession`/`listSessions`. | Requested. | `npm test` — 386 passed, 0 failed; 9 new checks: sessions list with entry counts, reopen resumes writing and closes the previous open one, keep-the-writing leaves entries while dropping the heading, an outright wipe removes both, the wipe is undoable, and the UI offers Reopen/Wipe/Sessions… with both wipe options. | v43 |
| 2026-08-03 | **Journal reworked around writing rather than logging.** Researched how solo players actually journal (prose is the record; dice and oracle results prompt it) and how activity feeds handle noise (keep the raw append-only log, render an *aggregated projection*). The first build inverted both: dice dominated the page and every row carried three buttons. Now — consecutive rolls collapse into one expandable line (`Journal.aggregate`, `burstSummary`), so a combat round costs a line instead of twelve; a session reads **oldest first** like a diary while sessions stay newest-first; an inline compose box sits at the foot of the open session (⌘/Ctrl+Enter saves) instead of a modal, and the header ✎ navigates and focuses it; per-entry actions are revealed by tapping the entry; old sessions collapse to a one-line heading; free-text search spans entries and notes; solo oracle answers render as quotable prompts with a *Write from this* control. Scene/session boundaries no longer block — the entry lands and the toast offers *Add a note*. **Fixed a real ordering bug found by the new tests:** entries recorded in the same millisecond sorted arbitrarily, so a written entry could land mid-burst; a monotonic `seq` now decides order, back-filled on existing journals. | Reported as clunky. Sources: [uxpatterns.dev activity feed](https://uxpatterns.dev/patterns/social/activity-feed), [wolf-tech.io feed aggregation](https://wolf-tech.io/blog/designing-an-activity-feed-for-b2b-saas-events-aggregation-and-privacy-safe-logging). | `npm test` — 377 passed, 0 failed; 11 checks on the new screen: inline compose, chronological order inside a session, a 6-roll burst collapsing to one line and expanding to all six, actions hidden until tapped, search narrowing, filters and export. Two checks from the previous build were rewritten — they asserted the modal-based "Write an entry" control and a flat entry list. | v42 |
| 2026-08-03 | **Journal system.** One timeline per hero is now the record of play (`src/journal.js`, route `#/journal`, taking the Log tab's slot). Dice rolls, solo engine results, lifecycle bundles and damage/crits flow in automatically; the player writes alongside them. **The roll log is now a view over the journal's dice entries** — `store.rollLog()` reconstructs the old shape, so nothing that already wrote a roll changed. Entries group under the session they happened in, opened by *Start session* (or a solo alert) and closed by *End session* (or *Head home*); sessions are retitleable. Writing has three routes: a note on any automatic entry, a free entry from the Journal screen or the ✎ control in the persistent resource header, and an optional prompt at every scene/session boundary. Filters: Everything / Written / Dice / Solo / Scenes, plus an all-heroes toggle. Retention keeps written, annotated and event entries forever and prunes only routine dice past 2000. Markdown export per session or whole journal; the journal rides along in the JSON backup and in `store.snapshot`/`undo`. | Requested. The record was previously split across a 100-entry roll log, a 60-entry per-crisis solo log and freeform sheet notes, none of which survived a campaign. | `npm test` — 371 passed, 0 failed; 13 new checks: a roll reaching the journal and reading back through `rollLog()`, session grouping, written entries, annotation, the prune rule and its exemptions, markdown containing headings/prose/notes, backup round-trip, and the screen's controls, filters and nav slot. Two existing checks were repointed: wipe-mission and undo both used the old roll-log key. | v41 |
| 2026-08-03 | **Solo Play Guide (PDF).** `npm run guide` renders `docs/solo-guide.pdf` — 23 pages, A4, black and white — plus the `docs/solo-guide.html` it came from. Thirteen chapters and four appendices: setup and the solo build allowance, the six-step loop, alert and event checks, choosing a crisis, each of the four timers with its ladder and trigger, the oracles, combat entry and solo recovery, social scenes, the endgame, common mistakes, a transitions-at-a-glance page, the full Crisis Event and Complex Response tables, a one-page play aid and a glossary. **Every die in the worked session is rolled by the shipped engines** in a real page at build time, with `Math.random` replaced by a seeded generator so rebuilds reproduce; the seed was chosen for mechanical coverage and no individual result was edited, which the cover states. Ladders and tables are read out of `data-solo.js` at build time so the guide cannot drift from the app. `rollTimer`/`rollObjective`/`rollAlly`/`rollEncounter`/`rollEventCheck` are now exported for this. | Requested. The in-app tutorial teaches the shape of solo play; this is the reference you keep beside you, and the transitions page answers the question that kept coming up — when to move from one timer or step to the next. | `npm test` — 358 passed, 0 failed (unchanged by the exports). Guide verified: 23 pages, no unresolved template values, and the worked session exercises an escalating sweep to Encountered, an objective advance and a setback, a fired crisis event, an ally casualty and an opportunity. | — (no app file changed) |
| 2026-08-03 | **Removed a duplicate control I had just created.** Pointing loop step 4's next-step card at `whatHappened()` left two stacked cards fronting the same function with near-identical copy — *"Say what your hero just did"* directly above *"What did your hero just do?"* and its *Something happened — roll it* button. At step 4 the next-step card now owns the action and `#solo-move` drops to its reference table alone, retitled **"Which timer fires when?"** with the table open by default; outside step 4 it keeps the button, since the next-step card is offering something else. | Reported from a screenshot. Two big primary buttons running the same function read as a bug, not as emphasis. | `npm test` — 358 passed, 0 failed; the new check counts the control screen-wide and requires exactly one. The existing move-flow test drove the button through `#solo-move`; it now finds the control wherever the current step puts it, so it tests the flow rather than the layout. | v40 |
| 2026-08-03 | **The step-4 dead end.** Reported: after setting an objective timer, play stalls — is an encounter timer the next thing? Three causes. (1) Loop step 4's next-step card read *"Check your timers"* and its button only scrolled to the timers panel, so the one step where the player is supposed to **act in the fiction** was the only step whose card handed them no action. It now reads *"Say what your hero just did"* and runs `whatHappened()` directly, stating that the app works out which checks the action triggers so you never pick a timer yourself. (2) Setting an objective rolled nothing and closed silently, which reads as a dead end; it now confirms the rung and karma, says an objective only advances on a **milestone** and never on a clock, and offers the narrate-then-roll control as its primary action. (3) The encounter question had guidance but no answer, so the Encounter panel gained **"Do I need one right now?"** — a single question (exploring or evading vs a fixed, known scene) that either starts the timer or explains why none is needed. | The trigger lines added earlier said what each timer *is*; none of them told a stalled player what to physically do next. | `npm test` — 357 passed, 0 failed; 6 new checks: timers running maps to step 4, the card's heading and rationale, the decision control renders, and its dialog is one question with both branches. | v39 |
| 2026-08-03 | **Greyed-out combat controls are now genuinely inert, and turn order gates attacking.** `.combatant.acted` dimmed the whole card with `opacity: .6`, but nothing inside carried `disabled`, so every spent combatant's buttons still worked. Worse, `Attack` was rendered for anyone alive with no check on whose card was up, so the entire board could attack before the round advanced. Added `attackBlockedReason()` — broken / already acted / not your turn / round over — driving a real `disabled` attribute plus a `title` saying why; `Hold off` is likewise disabled once you have acted. `Damage`, `Un-act` and `Remove` stay live, because damage and corrections arrive out of turn; card dimming softened to `.78` so those read as usable, with an **Acted** chip carrying the state instead. | Reported: greyed items still clickable, and any combatant could attack without the round advancing. | `npm test` — 351 passed, 0 failed; 8 new checks on the rule and on the DOM actually carrying `disabled`. Two older checks were rewritten rather than deleted: one counted Attack buttons *present* (they now always render, disabled) and one asserted *every* living combatant could attack, which turn order deliberately no longer allows. | v38 |
| 2026-08-03 | **Attacking now ends the attacker's turn.** `openAttack` resolved the roll, applied damage and closed, but never touched `acted` — and `currentTurn()` skips only combatants with `acted` set, so the "Acts now" marker stayed on the attacker until the separate *Acted* button was tapped by hand. The `actions {full, quick}` record was initialised each round and then never consumed at all. Added `spendAttackTurn()` (full action gone, quick too on a charge, `acted` set, returns whoever is up next) called the moment the dice are rolled, and `spendDefence()` so a declared block or dodge costs the defender their quick action **without** ending their turn — it is an out-of-turn interrupt. The result dialog now closes with "Turn spent — X acts next", announced to screen readers. | Reported: after an attack the current combatant stayed current. | `npm test` — 343 passed, 0 failed; 9 new checks: lowest card first, attacking sets `acted` and clears the full action, a slugfest leaves the quick action while a charge spends it, the turn advances to the next card, the helper reports who is up, defending costs the quick action but not the turn, and `currentTurn` goes null once everyone has acted. | v37 |
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
| 2026-08-05 | **The arc of a session: starting, sustaining and ending one.** Reported after every audit was green — "I still don't know how to start playing, sustaining play, and ending well." No audit could catch it: reachability proves every control is findable and coverage proves every rule is implemented, and both stay green on an app that never teaches the *shape* of a sitting. Four causes. (1) **Two parallel spines, with nothing saying which is the game.** Home rendered the group lifecycle card ("Start session" → "Start action scene") even in Crisis Mode, while the engine that actually generates a solo game sat on another tab — and "Start action scene" drops you on an empty board with no idea who you are fighting. When solo is on, Home now renders `soloStageCard()`, reading the same state the Solo tab does so the two can never disagree. (2) **Nothing said where you left off.** Returning days later meant reconstructing a crisis from a timer panel. The card now opens with the live step ("In play — step 4 of 6"), the crisis headline, the crisis level and how many timers are running. (3) **Ending was only possible if you had won.** `headHome` was offered solely at loop step 6 — something resolved AND nothing left running — so a player who simply had to stop for the night mid-crisis was given no ending at all. New **Stop for tonight** deliberately KEEPS the timers, level and alert, because the point is to resume, not reset; the dialog says how it differs from Head home, which is the in-fiction rest that does clear the board and pay objective karma. (4) **A closed session left no memory.** Both endings now write a `Session closed:` line carrying what was resolved, the crisis level, and what is *still out there*, and Head home shows it as a recap dialog rather than a toast that vanishes; the next sitting's Home opens with "Last time: …". | Requested. The machinery was right and complete; nothing tied it into a session a person could start, continue and finish. | `npm test` — 480 passed, 0 failed; 11 new checks covering the arc end to end: cold Home offers one control that begins play and a worked session to read first, mid-session Home names the crisis and the step instead of starting over, a sitting can be closed mid-crisis, stopping keeps the crisis in flight (timers, level and alert all preserved), and a closed session leaves the foothold the next Home opens with. | v53 |
| 2026-08-05 | **Ran the audit-prompt document: converge, then the reachability lens driven against the running app.** Prompt A terminated immediately — green twice with a clean tree — so the floor held. Prompt C then found four things the static spec structurally could not, because it clicks rather than reads. **One is a real bug: the global-danger generator silently dropped its danger table on 1 category roll in 6.** `globalDanger()` built the key by stripping non-letters from the rolled category, so "Extra-dimensional" became `globalExtradimensional` while the data key is `globalExtraDimensional`; the lookup returned undefined and the generator printed a category and a complication with no danger between them. Now resolved case-insensitively, with a check asserting every category resolves. Also: **the vitals value was a `<button>` labelled only `9/9`** — a screen reader said "nine slash nine, button", naming neither which track it was nor that tapping opens an editor (now an `aria-label` and a title); and two panels (**Notes**, Learn's **Ready to play**) carried no one-line explainer where the other ~40 cards do. `tests/probe.js` is the permanent version: nine checks R1-R9, **the store snapshotted before every click and restored after** so destructive controls are safe to probe, R7 run first in wiped storage, all findings reported per run, and a clean run printing its own coverage boundary — what it probed and, explicitly, what it does not cover. Prompt E's standing rules are recorded in §12.6. | Requested: run the audit-prompt document. | `npm test` — 468 passed, 0 failed. Three of the four initial findings were detector bugs I fixed rather than app defects, each now carrying its trap inline: five global-danger tables reached only through a concatenated key read as unreferenced; read-only dialogs were flagged for "no default action" when their Close *is* the default; and `.danger`/`.warn` count as highlighting, so counting only `.primary` reported every confirm dialog in the app. | v52 |
| 2026-08-04 | **Owner attestation recorded, and what it does not cover made enforceable.** Asked whether the source material is in `src/`: it is not — `src/` is 19 application modules, and `git log --all --diff-filter=A` confirms the chapter extracts have never been in any commit. The owner then attested that the extraction is reliable. That is a claim about **correctness**, not **completeness**, and the two are now separated in the schema rather than in a paragraph: three provenance levels (`project-ledger` · `owner-attested` · `source`), of which only `source` supports omission detection, and the spec still refuses a `source` claim while the extracts are absent. Recorded explicitly that the list is **not** built from `data.js` despite that file looking like source material — a checklist derived from the implementation passes forever while proving nothing. What the attestation *does* license is cross-checking the artefacts against each other, so 21 entries gained a `count` field verified against the live module: **all 22 figures CLAUDE.md states agree with the data**, and a stated count and the data can no longer drift apart unnoticed. | The owner holds the book and vouched for the extraction; the audit should use that for everything it can support, and claim nothing it cannot. | `npm test` — 459 passed, 0 failed; 2 new checks. Both proven to fail: a stated count edited to 60 reported `T-13: says 60, data.js#TALENTS has 51`, and deleting a real row from `ROLES` reported `T-09: says 8, data.js#ROLES has 7`. One self-inflicted false alarm on the way — my first consistency probe read `CRISIS_EVENT_ENGINE.focus` when the key is `entries`, so the data was right and the checker was wrong. | v51 |
| 2026-08-04 | **Two committed audit specs, each proven to fail.** The three reachability passes were conversations; their result was fixes, not a guard, so nothing stopped the next dead end. Both directions are now specs that run before the browser (§12). **`tests/reachability.js`** — eight classes (orphan functions, orphan content, broken nav targets, inert controls, missing shipped files, modules absent from the app shell, dead-end guards, silent refusals), each naming its offenders, with exemptions inline carrying their reason. **`tests/coverage.js`** + **`docs/coverage.json`** — the inverse: 144 requirements mapped from the source rulebook onto named markers, because a reachability suite stays green on an app missing half its rulebook. The 20 `A-*` entries point at **behavioural tests** rather than implementations, since the spec proves a mapping and never correctness. **The honesty problem is enforced, not just written down:** the chapter extracts are not in this repo (§11), so every entry is `provenance: "project-ledger"` — seeded from §9's ledger, which buys regression detection and *not* omission detection — and the spec fails if an entry claims `provenance: "source"` while the extracts are unavailable. Four real findings on the way: **`roller.fireAttack` was reimplemented inline** in the fire-damage code added earlier today (the engine already owned that roll); `core.sum` was dead and is gone; `Journal.clearAll` and `Store.createCharacter` are harness-only and are now exempt *with the reason* rather than deleted — deleting `clearAll` broke the very suite that reported it; and the static specs were **ordered last, so a broken app boot skipped them silently**, which is exactly when drift matters most. | Requested: audit source-document coverage, and commit the reachability audit as a test. | `npm test` — 457 passed, 0 failed. Every check driven red then green: an unreferenced export, an orphan table, `#/nowhere`, `onclick: () => noSuchHandler()`, a manifest entry with no file, a module dropped from the shell, a renamed marker (named `B-block` by id), a stripped citation, a stripped marker, a `partial` with no note, an omission secretly carrying a live marker, and a false source claim. Two detector bugs found by that exercise and fixed: a data file's parts reached through a same-file aggregate (`TUTORIAL_INDEX`) read as orphans, and harness-only helpers read as orphans. | v50 |
| 2026-08-04 | **Third reachability pass — the fields inside reached tables.** The first two passes swept whole tables and whole exports; both would pass an app where every table has a screen and every mechanical flag on it drives nothing. This pass walked the live data objects and checked each *property* against every `src/` module. Eleven fixes. (1) **Five `CONDITIONS.effect` flags were read by nothing**, so §3.9's "auto-applied" claim was false: a **stunned** combatant still took their turn, an **immobilised** one still threw punches, **on fire** never burned, and `noPush` was honoured only via the Resolve-0 case that implies it. `combat.conditionFlags()` now reads them — `currentTurn` skips a lost turn, `attackBlockedReason` names the blocking condition, `advanceRound` rolls the start-of-round fire attack (Intensity dice, 2 damage per 6) and spends the missed turn, and `canPush` consults the condition itself. (2) **Combatants had a `conditions` object with no UI** — three stunts wrote to it and nothing could read or clear it, so an enemy set on fire by a power had nowhere to live. Each card now shows its active conditions and opens the full picker. (3) **Four pregens dealt double the printed Slugfest Damage in human form**: `publishedMax` was written at Phase 1 and read by nothing, so alternate-form stats were re-derived — halving STRENGTH while keeping a STRIKE bonus the form does not have. Published blocks now use their printed numbers in both forms (§3.19); all 28 verified against the book in both. (4) **`altHealth`/`altResolve`/`altSlugfest`/`slugfestEmanation` were extracted and never shown** — a Werewolf's human form and Furnace's emanation damage existed only in the data file. `showNPC` prints the second block, `combatantFromProfile` carries it, and a **Change form** control switches a combatant between its printed forms. (5) **`team.vehicle` has been in the schema since Phase 0 with no UI at all** — the Team Vehicle upgrade could be bought and the vehicle never chosen. The team wizard now offers the rank's own list (T-31) with its Ch.4 stats, names it, and records the vehicle upgrades held as its modifications. (6) **Knowledgeable was taken without its subject**, so the +3 dice had no scope and `talents[].subject` was never populated; the wizard asks (the book's D6 list, roll offered), the quick build rolls it, the sheet shows it and offers it on old saves. `rules.talentSubject` — written for this and never called — is now the reader. (7) **Drawbacks needing a detail were never asked for one** at creation (`needsDetail` unread). (8) **`underMinimumRange` (−3) and `unaware` (+2) were implemented in `makeAttack` and passed by no caller**; the board attack dialog now offers both, and reads "unaware" off the target's own conditions rather than asking blind. (9) **Eighteen `POWERS` mechanical fields** (area effect, inflicted condition, halves armor, break-free dice, weight rating, stress armor …) were in the data and stated nowhere; the power dialog now lists them. (10) `RANKS.situations` on the rank cards and `REPUTATION.greatDeedExamples` behind the end-of-session Reputation question. (11) `LIFECYCLE.sceneTypes`/`flow`/`actStructure` — what a briefing, an action scene and a three-act adventure actually are — in the rules library. | Requested: audit the whole app for missing elements with no route to the user. | `npm test` — 438 passed, 0 failed; 9 new checks: a lost turn is skipped and the reason named, on fire is recognised, a noPush condition blocks pushing with Resolve left, all 28 published blocks match the book in both forms, a two-form profile switches and switches back, 200 quick builds never leave a subject-bearing talent unnamed, the team vehicle is offered and picked, and a power's condition and break-free penalty appear in its dialog. The rank-cap check that matched source text was already replaced last pass; the combatant-control order check was updated for the new Conditions button rather than deleted. | v49 |
| 2026-08-04 | **Second reachability pass — dead ends found by sweeping exports instead of tables.** The first pass swept data files; this one swept `src/` for exported behaviour nothing calls, plus the three data files the first sweep missed (`data-monsters.js`, `data-pregens.js`, `data-solo.js`). Seven fixes. (1) **A team could be created and edited but never removed** — `Store.deleteTeam` was written at Phase 5 and called from nowhere, so a wrong team was permanent. The team wizard now has a **Disband** section; heroes, karma and the journal are untouched. (2) **`Sync.subscribeParty` was never called**, so in a campaign the GM's Party panel showed only heroes saved on this device. It now renders the synced members below the local roster, keyed off the campaign; local-only mode never fires the callback, so nothing appears. (3) **Upgrade prerequisites were unenforced at creation** — a Global team could take Vehicle Defense with no Team Vehicle, which Ch.7 says can never be bought around. Cards whose prerequisite is another upgrade are now disabled until it is held, and removing a prerequisite while a dependent is held is refused. (4) **A repeatable upgrade at its cap dumped the whole stack** on the next tap; it now decrements by one. (5) **`baseUpgradeCost` read the occupation's printed Resources**, so Windfall and Hard Times did not count toward a Resources prerequisite — it now reads the live `Derived.resources`, and carried a dead `const res = R.D ? undefined : undefined;` line that is gone. (6) **The three encounter-avoidance options had buttons but no rules** — Ch.9's `AVOIDING_ENCOUNTERS` (what Hide, Back out and Sneak past each cost you) renders beside them. (7) The Ch.8 stat-block caveat renders on the compendium's Adversaries group, and the pregen dialog's hand-copied note is replaced by `PREGEN_NOTE` itself, so the text has one source. Also: a route from the Home team card to the base-upgrade purchase (the buy point is in the karma dialog, which nobody looking at their base would find), `button[disabled]` styled globally rather than only `.btn[disabled]`, and two genuinely dead exports removed (`Journal.clearSessionEntries`, superseded by `deleteSession({keepEntries})`; `solo.soloBuildNotes`). | Requested: fix everything. | `npm test` — 429 passed, 0 failed; 7 new checks, and the source-text match on the rank cap was replaced by driving the real grid: prerequisites lock and unlock, the cap holds at the rank allowance, a prerequisite with a dependent survives the tap, a team disbands, the Home card reaches the purchase, Windfall lifts a hero over a Resources prerequisite, and both notes render. The standing stranded-table sweep now covers all five data files. | v48 |
| 2026-08-04 | **Reachability audit — everything the app knows now has a route to it.** Swept every exported table in `data.js` / `data-npcs.js` against every `src/` module and found content with no screen at all. (1) **Base upgrades could not be bought.** §3.8's karma purchase had `Store.baseUpgradeCost` and `Store.upgradePrereqSatisfied` written at Phase 4 and called from nowhere — 17 extracted upgrades with no way to acquire one after creation. `sheet.buyBaseUpgrade()` now sits in a **Team base** section of the karma dialog: it lists only upgrades whose prerequisite is met and whose repeat limit is unspent, quotes the real price (10, or 20 when nobody meets the Resources/occupation prerequisite), and lets any hero with unlocked spending pay — the karma is poolable, so the payer is chosen. (2) **Starting upgrades were unlimited and free.** The team wizard's grid let you tick all 17; it now enforces `rank.baseUpgrades` (Teen 0 · Street 1 · Global 2 · Cosmic 3) and says to buy the rest with karma. (3) **Six extracted rules tables had no reader**: HAZARDS (disease, explosions, fire Intensity, vacuum), FALLING, WEAPON_FEATURES, VEHICLE_RULES, TIME_CATEGORIES and BASE_UPGRADE_RULES. They render verbatim from the data at the foot of the rules library. (4) **The Ch.6 NPC build recipe and handling rules** (T-42, extracted at Phase 0) were reachable from nothing — they now render there too, which matters most for a solo player inventing an opponent. (5) The Ch.6 caveat over the animal list renders with the animals in the compendium instead of sitting unused in `data-npcs.js`. (6) Removed a dead `renderRollLog` — the `log` route has rendered the journal's dice view since v41. | Requested: audit the whole app for elements with no route to the user. | `npm test` — 422 passed, 0 failed; 11 new checks: every route renders a real screen, the nav reaches every non-card screen, the six rules and the NPC recipe have a home, an upgrade's price and prerequisite gate are quoted correctly, karma actually buys one, rank caps the free starting picks, and a standing sweep asserting no exported table is stranded — with an explicit exempt list naming, per symbol, either the `RULES_LIBRARY` entry that paraphrases it (each id asserted to exist) or its status as internal metadata, so a future table added without a route fails the suite. | v47 |
| 2026-08-04 | **First-timer audit: the app assumed you owned the book.** Walked every screen and every dialog as someone who has never read the rules or played a solo RPG, and fixed what blocked them. (1) **Creation was nine steps of jargon before you could roll a die** — sixteen archetypes, sixty-nine powers, fifty-one talents, twenty-two occupations. Step 1 now opens with **Build one for me**: `wizard.rollWholeHero()` rolls a complete, legal hero off the book's own D3/D6 lists (archetype, attributes, powers, source, hero talent, occupation and its talent, key relationship, personality, drive, flaw, name), spends any leftover points, and drops you on the last step to name it. Everything stays editable. Two real bugs surfaced while verifying it: `POWER_SOURCES` is keyed by `roll`, not `range`, so `tableLookup` threw on it; and the archetype and occupation talent lists overlap **and name the same talent two ways** ("Knowledgeable (Technology)" vs "Knowledgeable"), which built illegal heroes — the picker now dedupes on the base name. 3200 builds across all four ranks, solo and not, come out legal with the budget spent exactly. (2) **Four dialogs demanded a number nobody could know** — "Defender's FIGHTING score?", "The target's PRESENCE score?" and two "Their INTUITION score?". Replaced with `sheet.askAttributeScore()`: the book's own scale in words (an ordinary person 2 … superhuman 7), the option to read the value straight off any Ch.6 profile, or type it if you do know. (3) Challenge rating, time limit, minion count and stress prompts gained hints explaining what the number means and what a sane value looks like. (4) **New `D.GLOSSARY` — 29 terms** (stunt, push, stress, broken, zone, minions, karma, opposed roll, passive roll, boost/limit …) rendered above the rules library and filtered by the same search box, each linking to the full rule. (5) Home no longer shows six session-lifecycle buttons to someone who has no hero yet. | Requested: "how idiot proof is it?" | `npm test` — 411 passed, 0 failed; 15 new checks, including 240 quick-builds all legal and playable, the picker returning the book's 2 for "an ordinary person", no bare score prompt surviving anywhere in the source, and the glossary covering the blocking terms. Cold-start path driven end to end: Create → Build one for me → Create hero → Which one do I roll? → rolled, zero console errors. | v46 |
| 2026-08-04 | **"Which attribute do I roll?" — the answer to being stuck at loop step 4.** Reported: the loop reaches step 4 and there is nothing telling you which roll a given action calls for. Added `D.ATTRIBUTE_USES`, an index of where each of the six attributes is **actually rolled** — compiled from rules the app already implements (attack kinds, block, dodge, grapple break-free, wrecking minimums, stabilise, rally, banter, purchases, escapes, spotting, searching, the opposed PRESENCE powers), never invented, and each line carries a `rule` id that resolves against `RULES_LIBRARY`. `sheet.openAttributeGuide()` renders the six as expandable rows: name, **live pool with crits and conditions already applied**, one line on what the attribute covers, the rules-cited uses with links, and a Roll button that goes straight through the normal roll path. Reachable from the Sheet's Attributes card (**Which one do I roll?**) and from the Solo tab at step 4 and beside the move picker — the two places where "but what do I roll?" actually bites. | Requested; shape chosen by the player (picker, organised by the six attributes). | `npm test` — 398 passed, 0 failed; 7 new checks: all six covered with ≥3 uses each, every `rule` id resolves, the six render in order, FIGHTING 7 under a −2 crit reads 5 dice, expanding gives rules-linked uses and a roll button, and it opens from both the Sheet and Solo step 4. | v45 |
| 2026-08-02 | **Combat closes the loop: attacks resolve on the board and apply their own damage.** Reported as clunky, and correctly — the attack dialog lived on the **Sheet**, printed "Hit for 3 damage", and then you had to switch to the Action tab and type 3 into the target's Damage prompt. The whole roll was disconnected from the board it was about. Every living combatant now carries an **Attack** button that runs the full procedure against the combatants already in the scene: kind → target picked off the initiative list (showing their Health, Armor, altitude and Huge flag) → the defender's block or dodge **declared before the roll and rolled from their own attributes**, never typed → the attack roll (through the real character when the attacker is the hero, so crits, conditions, talents and weapons all apply; off the profile's attributes for an NPC) → cancelled 6s → tappable stunts capped at the surplus, with **Double Damage** changing the number and **Stun / Trap / Suppressed / Knockback** changing the board → **Apply damage**, which routes minions one-per-point, NPCs through their armor, and the hero through the crit engine so the sheet, the resource header and the dying procedure all follow. Manual `Damage` entry stays as a ghost button for damage the app did not roll. `startActionScene` also stopped clobbering a running scene, and `joinCombat`/`blankCombatant` were added so an enemy can be dropped onto the board mid-round. | Reported: "Combat doesn't work properly? Damage have to manually add? Very clunky." | `npm test` — 334 passed, 0 failed; 6 new checks: every living combatant offers Attack and a broken one does not, the dialog asks for a kind first, minion damage drops one per point, NPC damage subtracts armor, a board stunt lands with the damage, and damage to the hero produces a crit on the sheet. | v36 |
| 2026-08-02 | **Walked all twelve encounter steps as a player would; two were reachable but not workable.** (1) **Step 9 delivered you into a fight with an empty board** — `drawForEncounter` started an action scene containing only the hero, so the enemy the threat table had just named had to be found and added by hand on another tab. It now asks **"What are you facing?"** with the threat band choosing the source (1 six → a Ch.6 individual · 2 → a minion group, with a count · 3+ → a Ch.8 adversary), plus **Roll one from the book**, **Name it myself** (a blank combatant) and **Nothing yet**. The enemy joins the scene with its own initiative card, and surprise on either side redraws. (2) **Step 6 had no "or established facts" path** — the chapter allows the threat table to be skipped when the fiction already says who this is; **I know what this is** now overrides the rolled threat while leaving the behaviour result standing. Also fixed on the way: `combat.startActionScene()` unconditionally built a fresh combat, so drawing initiative from the Solo tab **wiped any fight already in progress** — it now returns a running scene untouched, and `joinCombat()` adds a latecomer with `dealCard` so nobody else's card or turn moves. | Reported: "all these can be executed in the app easily?" | `npm test` — 328 passed, 0 failed; 5 new checks: step 6 offers established facts, step 9 asks what you face and offers book / own / none, both hero and enemy end up on the board with legal cards, and starting a scene never wipes one already running. | v35 |
| 2026-08-02 | **The crisis log became an editable record.** It was a read-only list of the latest 12 lines, which is the wrong shape for the one artefact that survives the session: a rolled result rarely says what it *meant*. Log entries now carry an `id` and a `note`, and each row offers **Note** (or Edit note), **Edit** and **Remove**; the card offers **Add an entry** for anything the app did not roll, **Clear the log**, and a Show all / latest-12 toggle once the log passes 12. Removing an entry and clearing the log both snapshot first and surface a one-step **Undo** in the toast. Entries render with a timestamp, the text, and the note in an accent-bordered block. Saves written before this change have no `id`, so lookups fall back to the timestamp and old logs stay fully editable. | Requested. | `npm test` — 323 passed, 0 failed; 8 new checks driven through the DOM: the three per-row controls, the entry count in the heading, rewording an entry, adding a note and seeing it render, remove-then-undo, writing an entry by hand, clear-then-undo with the empty state, and the 12/all collapse. | v34 |
| 2026-08-02 | **The encounter step marker is a position, not a paragraph.** Asked "what is this?" about `STEP 2 OF 12 — MAKE AN ENCOUNTER CHECK WITH ENEMY DICE FOR THE CURRENT PRESENCE, MODIFIED BY MOVEMENT MODE.` — the whole printed step, set in the all-caps `.stage-label` utility, restating what the button under it already said. Replaced with a compact `.step-marker`: a `Step 2/12` pill, a two-or-three word name for the step (`STEP_NAMES`), and a **see all 12** link that opens the full printed procedure with the current step marked. The collapsed "Encounter procedure, in order" block now shows only while no timer is running, so the sequence is never printed twice on the same panel. | Reported. | `npm test` — 315 passed, 0 failed; the existing step-marker check was retargeted to the new element and format. | v33 |
| 2026-08-02 | **Encounter panel: movement mode where you choose it, and controls that stop wrapping into a ragged column.** Reported. (1) **The movement mode was only in the Crisis Mode header**, far above the panel whose dice it changes — so on the Encounter panel there was no way to set it and no sign of what it did. `movementPicker()` now sits directly under the encounter ladder, each option spelling out its own trade (*Cautious: -1 enemy die · +1 your INTUITION · +1 crisis die*), the current one marked, writing the same `state.mode` as the header. The status line already reflects it: Closing reads **roll 4 dice** cautious, 5 alert, 6 rushed. (2) **Four equal-weight buttons wrapped one per line.** The step's own controls now share a row evenly (`.row-actions.steps`, primary full width), and the panel's utilities — Describe this place, Stop the encounter timer — moved to a quieter `tiny ghost` row of their own, so what the sequence asks for is never mixed in with housekeeping. | Reported. | `npm test` — 315 passed, 0 failed; 6 new checks: all three modes render with their effects, the selected one is marked, changing it changes the dice the panel says to roll, clicking one from the encounter panel persists, and the utilities sit in a separate row. | v32 |
| 2026-08-02 | **Every timer reads the same way, in plain words.** A bare status name told you nothing: "Imminent · 2 threat dice" does not say which direction is bad, how much road is left, or what a 6 does. One shared `timerRow()` now renders all four types identically — the name, a **ladder of pips** lit to the current rung (diamond at the outcome end), the status with the dice it rolls **right now** (including the crisis-level penalty on objectives and the movement-mode modifier on encounters), and one sentence of plain English: *"2 steps from happening. Every 6 you roll moves it one step closer."* · *"2 steps from being wiped out. Every 6 is a win for them (2 damage in a fight); every 1 costs them a step."* · *"3 steps to go, then 4 karma points."* Spent ally groups read "nobody left" instead of a dice count and lose their roll buttons; a reached objective shows its karma instead of dice. Pip colour tracks danger (blue → amber → red) or progress (green → yellow). **Engaging a crisis now names the timer with the crisis headline** rather than the whole flattened string, carrying the complication as a note underneath. Tone classes are namespaced `t-*` because `.good` / `.warn` are global colour utilities and were repainting whole rows. | Reported: the timer wording was hard to understand. | `npm test` — 309 passed, 0 failed; 9 new checks: every row has a ladder, status and meaning; the ladder lights to the current rung; statuses give a plain dice count; meanings give steps left; a spent group says "nobody left"; a reached objective shows karma; the encounter panel matches; the tone class never repaints text; and the movement-mode note is a full sentence. | v31 |
| 2026-08-02 | **A crisis is laid out as facts, not a run-on sentence.** Reported with a screenshot: `Supervillain activity: A dangerous substance is discharged. (Research district). Complication: Media presence: reporters are already on scene, in the way.` — four separate table results glued into one string by `generateAlert` and printed as body text. Crises now carry structured `parts` (`kind` · `headline` · `where` · `complication`), written by all four alert sources and by the Crisis Event Engine (focus → kind, detail → headline), and `crisisBody()` lays them out: source as an eyebrow, kind as a coloured label, the event itself as the lede, location on its own marked line, complication in a warn-bordered block with its own label. The flat one-liner survives as `text` for the log and for timer names, and any save from before the split still renders through the same function. The header alert box uses the same layout. | Reported. | `npm test` — 300 passed, 0 failed; 6 new checks: the four fields render separately, the headline carries no glued-on location or complication, the complication is labelled, the source is an eyebrow, a pre-split save still renders, and all four alert sources emit parts. | v30 |
| 2026-08-02 | **Third tutorial: a worked solo session.** Eight chapters walking one complete Crisis Mode outing beat by beat, opening with the piece that was actually confusing — the four timer triggers and the only three ways combat starts — then alert, clocks, oracles, the encounter sequence, the fight and closing out. Every dice array in it (`step.roll`) was rolled through the app's own engines and recorded verbatim, so the ladders, bands and arithmetic on the page are real rather than illustrative; `learn.js` renders them as die faces beside the step. Reached from the Learn screen's third chip. | The player asked for a full worked example of solo play and how to drive the app for it. It belongs in the app, offline, beside the buttons it describes. | `npm test` — 294 passed, 0 failed; 5 new checks: eight chapters, ≥15 recorded rolls all rendering, every face a legal D6 result, every roll captioned, and the tutorial opening with the triggers and the combat explainer. | v29 |
| 2026-08-02 | **"What did your hero just do?" — one control instead of four timers to choose between.** Reported: the timers are confusing, it is unclear when to use the encounter timer, and unclear when combat starts. Root cause is that Ch.9 gives each timer a **different trigger** (crisis = time passing · objective = a milestone · ally = the group facing danger · encounter = per zone while exploring), and the UI presented four sibling panels each with a `Check` button, leaving the player to know which applied. Inverted it: a new card fronts the tab with six moves — *moved to a new place · searched or waited · something moved my objective · my allies faced danger · a fight or long scene ended · time jumped* — and each fires the right checks in the right order with the right modifiers (a finished fight rolls every crisis timer at **+1 die** then an event check; a move with no encounter timer running simply skips that check). One combined report at the end. To make it teachable rather than magic, every timer group now prints its own **trigger line**, and the encounter panel states that ordinary travel needs no timer plus a **"When does a fight actually start?"** explainer naming the only three ways: the encounter sequence delivers an enemy you neither avoid nor escape, you choose to attack, or a crisis timer fires into a fight. Internally the four roll procedures were split from their dialogs (`rollObjective`, `rollAlly`, `rollEncounter`, `rollEventCheck`, `rollTimer`) so a composed move and a single button share the same arithmetic. | Reported. The rules were right; the interface made the player be the rules engine. | `npm test` — 289 passed, 0 failed; 8 new checks: the control is present, all four trigger lines render with the right conditions, the encounter panel carries both explainers, the move list has six entries, a finished fight rolls timers at +1 and then an event check, and a move skips checks with nothing running. | v28 |
| 2026-08-01 | **Solo rules audit — every Crisis Mode function checked against Ch.9.** Nine defects fixed. (1) **The social scene was unreachable after resolving a crisis**: `currentStep` tested `!state.alert` before `awaitingSocial`, and resolving clears the alert, so the loop jumped from step 6 back to step 1 despite the toast promising a social scene. Step 5 now outranks step 1. (2) **Heading home reported objective karma it never paid** — reached objectives were filtered away and the karma discarded; it is now awarded. (3) **The bonus-6 table was offered on threat, progress, support and enemy dice.** The chapter scopes it to *attribute* rolls ("When rolling multiple ⑤ in an attribute roll in solo play"), and its own *Fast* entry proves the point by applying a bonus **to** a crisis timer check. Removed from the timer, objective, ally and encounter checks; kept on the escape (AGILITY) and search (INTUITION) rolls and added to the hero's half of the spotting check. (4) **Crisis timer checks ignored "+1 threat die for a lengthy scene or action, −1 for a speedy one."** Every check now asks, and a **Time passes — check every timer** control performs the chapter's "repeat this check for each active timer" in one go. (5) **A new timer's proximity was assumed** from the crisis phase; the book says give it a proximity, and roll 2D6 only if unsure — it is now chosen, with the roll offered as an option (and flagged, since that 2D6 table is the truncated one). Engaging a crisis uses the same chooser. (6) **A fired timer set `awaitingSocial`** — but a timer firing is the bad thing happening, not a resolution; only resolving a crisis or completing an objective calls for the social scene. (7) **"You are Alone" could still be rolled** whenever an expertise bonus pushed the pool above zero. (8) **Social scenes had no long option**: the recovery table restores all Resolve (and Health) when the scene includes a few hours' rest. (9) **Ch.9 recovery had no controls** — a hero broken by damage or stress acts at −1 die, and one broken by stress may roll PRESENCE "as if aided by an ally", the aid being an important memory. A recovery panel now appears exactly when it applies, with a **Rally on a memory** roll at PRESENCE +1 help die that asks what comforts the hero. Also: new-timer dialogs offer the Complex Response and Crisis Event engines as seeds, encounter start states carry the book's three guidelines, and advancing time asks whether anything delayed you instead of assuming it. | Requested audit of every solo function against the chapter. | `npm test` — 281 passed, 0 failed; 8 new checks covering each finding. | v27 |
| 2026-08-01 | **The Ch.9 Encounter Check Sequence is now performed, not printed.** The encounter panel rolled the check and displayed the behaviour and threat tables; steps 7-12 existed only as reference prose, so spotting, hiding, sneaking, escaping, drawing initiative, resetting the timer and advancing time had no controls anywhere. The panel is now a state machine over `state.encounter.phase` (`moving` → `revealed` → `standoff` → `fight` → `reset` → `advance`), showing the step number out of twelve and offering only that step's controls: **Move / linger — check** and **Search this zone** (an INTUITION check that costs time and rolls the Complex Engine on a general sweep), the **Outmaneuver / Prepare** powers option (gated on a relevant power, ≥1 six, ≤1 one, presence closing or worse), a **Spotting check** that applies the movement mode to both sides' INTUITION, then **Reveal · Ambush · Hide · Back out · Sneak past** for an unspotted hero or **Escape (AGILITY)** with the printed modifier checklist / **Draw initiative** for a spotted one, a surprised hero getting only the draw. Drawing initiative starts a real action scene and marks the hero surprised so the initiative draw honours it. **Reset the encounter timer** offers the book's four reset states; **Advance time** rolls every crisis timer with the movement-mode and delay modifiers stacked, firing any that reach *now* and raising the crisis level. A false alarm short-circuits straight to the reset step. | Supplied Ch.9 text: "the whole encounter sequence is not inside the app". The tables were extracted at Phase 0; only the procedure was missing. | `npm test` — 273 passed, 0 failed; 11 new checks: twelve printed steps, every phase maps onto one, the panel names its step, each phase offers exactly its own controls (moving, revealed, unspotted, spotted, surprised, reset, advance), movement mode changes the enemy dice shown, and the powers option is gated on power, sixes, ones and proximity. | v26 |
| 2026-08-01 | **The Ch.9 solo build allowance is now applied, not just printed.** `SOLO_SETUP.build` had carried the rules text since Phase 0, but nothing acted on it: a hero built for Crisis Mode got the same points and talents as any other. Added `D.SOLO_BUILD` (2 extra attribute points, 1 extra free talent, the recommended talents, the powers to favour and avoid, the rank and objective-karma notes), `identity.solo` on the character (normalised onto old saves), and `derived.soloAllowance()` feeding `creationBudget` — so the extra points are spendable and the third talent is free rather than costing an attribute point. The wizard's rank step carries the opt-in, pre-ticked when Crisis Mode is on, with the chapter's power and karma guidance beside it; the talents step states the raised free-talent count and the recommended picks. Archetype arrays scale to the larger budget, so all 16 still spend it exactly. | Supplied Ch.9 "Creating Your Hero" text. The numbers were already recorded; the app just never used them. | `npm test` — 262 passed, 0 failed; 5 new checks: the solo budget is +2, the third talent costs nothing, all 16 archetypes still land on `remaining === 0` at a solo budget, `SOLO_BUILD` matches the chapter's lists, and the rank step renders the opt-in. | v25 |
| 2026-08-01 | **Wipe all mission data.** New Settings control (`store.wipeMissionData`) clearing the running action scene, every challenge/progress task, the solo crisis board and the roll log, and resetting each hero's `state.scene`, `state.conditions` and `state.session` flags to `idle` with karma spending unlocked. Heroes, the team, karma and the advancement log survive — it clears the mission, not the campaign. The confirmation lists exactly what goes, and the toast carries a one-step Undo. `store.snapshot`/`undo` were extended to cover tasks, the roll log and the solo board so that Undo is honest (they previously snapshotted only characters, team and combat). | Requested. | `npm test` — 257 passed, 0 failed; 4 new checks: the four mission stores clear, heroes and karma survive, scene/session flags reset, and one Undo restores everything including the solo board. | v24 |
| 2026-08-01 | **Fifth sequence-of-play pass — the Solo loop's own tail.** (1) The header row read alert · event check · **social scene** · resolve, but loop step 5 is *"**after** resolving an event, threat or objective, play a social scene"* — resolving now comes first, as it does in the fiction. (2) **Loop step 6 had no implementation at all.** `SOLO_SETUP.loop` publishes six steps; `currentStep` only ever returned 0-4, so "return to any remaining crisis dangers, or head home to rest, recover and earn karma" was printed in the strip and never reachable. Added `state.resolved` (incremented by Resolve crisis) and a sixth step that fires only when something has been resolved and no crisis or timer is left — its action is a new **Head home** control that restores all Health and Resolve (a few hours' rest), reports the karma the reached objectives paid, unlocks karma spending, and clears the board for the next alert. This is where solo karma is actually claimed (§3.20 — objective timers instead of the session questions), and it previously had no control anywhere. | Fifth pass over the same report. The wizard steps, GM tab, compendium, challenge tracker, crisis/ally/objective/encounter controls and every remaining dialog were re-walked and match play order; these two were the breaks left. | `npm test` — 253 passed, 0 failed; 5 further checks: resolve precedes the social scene in the header, an unengaged crisis is still step 3, step 6 fires only after a resolution with nothing left running, the next-step card reads "Step 6 of 6 — Head home", and all six loop steps have an action. | v23 |
| 2026-08-01 | **Fourth sequence-of-play pass — one shared answer to "what now" outside Solo.** The Solo tab has had a "do this next" card since v16; normal play had nothing equivalent, so each tab was a pile of panels with no shared sense of which beat of §3.12 was live. Added `state.session.stage` (`idle` → `open` → `afterAction` → `afterSocial`), written by the lifecycle bundles themselves (Start session, End action scene, End social scene, End session, End adventure), normalised onto old saves. `combat.sessionStage()` folds that plus the running combat into a single answer — create · between sessions · session open · action scene (round N, who acts now) · action over, social due · between scenes — each with the one control that carries it forward, and `combat.stageCard()` renders it in the same shape the Solo tab uses. It leads the Home screen and heads the Sheet, so the same instruction appears wherever the player is looking. | Fourth pass over the same report. Panels (v19), dialogs (v20) and turn order (v21) were sequenced individually, but nothing tied them together: the app never said which beat of the session was live. | `npm test` — 248 passed, 0 failed; 4 further checks: the stage walks create → start → open → inAction → social → next as the bundles fire, each stage names a non-empty control (with "Start action scene" and "End social scene" at the right beats), the card is the first card on Home, and the Sheet carries the same one. | v22 |
| 2026-08-01 | **Third sequence-of-play pass — turn order.** The Action tab tracked a round without ever saying whose turn it was, and one control silently destroyed the order. (1) **`openAddCombatant` called `drawInitiative`**, which redraws every card and clears every `acted` flag — so adding one reinforcement in round 3 reshuffled the whole round and un-acted everyone who had already gone. New `dealCard()` gives a joiner one unused card and leaves every other combatant's card and acted flag alone; a full redraw now happens only at the start of a round. (2) **Nothing said who was up.** New `currentTurn()` (lowest card first, skipping anyone who has acted or is down) drives an "X acts now (card #n)" line in the round header, an **Acts now** badge and an accent outline on that combatant's card, and "Everyone has acted — draw the next round" when the round is spent. (3) **Next round** is a plain button mid-round and becomes the primary action only once the round is done, so the button that leads is always the one the sequence calls for. | Third pass over the same report. Panels (v19) and dialogs (v20) were sequenced; the round itself still was not, and the mid-round redraw was a live defect rather than an ordering nit. | `npm test` — 244 passed, 0 failed; 7 further checks: the lowest card acts first, a joiner keeps everyone else's cards and acted flags with no duplicate cards and the list still sorted, the round ends when all have acted, the header announces the turn, Next round only leads when the round is done, and exactly one combatant carries the marker. | v21 |
| 2026-08-01 | **Second sequence-of-play pass — the dialogs, not just the panels.** (1) **Block and Dodge were unreachable.** `roller.resolveBlock` / `resolveDodge` (audit A5) had no UI at all, so an attack went straight from "what kind?" to rolling — and the rules require the defender to declare **before the attacker rolls any dice** (§3.2). The attack dialog now runs kind → weapon → target → **defence declaration** → attack roll → defence roll → resolution, gated by the attack's own `blockable`/`dodgeable` flags (charge cannot be blocked, shooting is dodged, huge targets skip it). Cancelled 6s reduce the stunts on offer, a surplus shows the counterattack or the dodge move, and a push re-resolves the standing defence. (2) **Rest & recovery** listed its four buttons by resource (both Health options, then both Resolve options), so it did not match the recovery table printed directly above it. Now grouped by time span — an action round (the full-action PRESENCE roll for 1 Resolve per 6, which had no control at all) → a few minutes → a few hours — with Health and Resolve side by side in each span. (3) **The rules library** was ordered arbitrarily: "Scenes and sessions" (the frame for everything) sat 23rd of 24 and Death came after it. Reordered to the sequence of play — session framing, rolling, pushing, opposed, help, stunts, initiative, actions, attacks, wrecking, damage, death, crits, recovery, banter, challenges, powers, minions, huge, chases, then the between-session economies. | Second pass over the same report. The first pass fixed panel and row ordering; this one covers the flows inside the dialogs, where the worst break was a rules procedure with no UI at all. | `npm test` — 237 passed, 0 failed; 7 further checks: the rules library opens with the session frame and reads damage → death → recovery and rolling → initiative → attacks; the attack kinds carry their blockable/dodgeable flags; the attack dialog asks for the defence **and has rolled nothing** at that point; and recovery is grouped shortest span first. | v20 |
| 2026-08-01 | **Sequence-of-play audit across every tab.** Buttons were ordered by convenience, not by the order the game is played, so several screens taught the wrong sequence. Fixed: (1) **Home's Scene & session card** offered `Start session` and then four *end* bundles — there was no way to begin the scene it asked you to end. It is now three labelled stages (open the session · alternate scenes · close out) with a real **Start action scene** control (`combat.startActionScene`, exported) sitting before End action scene. (2) The **Action tab's empty state** led with `End social scene` / `End session` as if they were next steps; they now sit under a "Between scenes" label below the primary Start control. (3) **Round controls** read `Next round · Add combatant · Wreck a zone · End scene` — advancing the round before setting the board. Now set up → act (wrecking is an attack option) → advance → finish. (4) **Combatant controls** read `Damage · Acted · Altitude · Hold off · Remove`, i.e. the turn backwards; now hold off → altitude → damage → acted → remove. (5) **Karma & advancement** sat in the identity card at the top of the sheet, but karma is spent *between sessions* (§3.3) — it moved to a new **Between sessions** card at the foot, below Notes. (6) With an empty roster **Home now meets the tutorial before the creation card**. (7) The Solo **timer groups** now follow loop step 3's own wording — crisis, ally, objective, encounter. | Reported after walking every tab: the interface did not follow the sequence of actual gameplay. | `npm test` — 230 passed, 0 failed; a new **Sequence of play** section with 8 checks asserting the Home stage labels and lifecycle ordering, that a scene can be started before it is ended, the exact round- and turn-control order, that karma is the last card on the sheet, that vitals run harm before recovery, and that the tutorial precedes creation on an empty roster. | v19 |
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
