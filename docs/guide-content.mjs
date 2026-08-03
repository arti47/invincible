// docs/guide-content.mjs — the Solo Play Guide's prose and layout.
// Rules content is paraphrased from the same chapter extracts as data.js (CLAUDE.md §11); the
// numbers, ladders and tables are read out of data-solo.js at build time so this file can never
// drift from the app. The worked session's dice come from the engines, not from here.

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const p = (t) => `<p>${t}</p>`;
const h2 = (t) => `<h2>${esc(t)}</h2>`;
const h3 = (t) => `<h3>${esc(t)}</h3>`;
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const ol = (items) => `<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
const dice = (faces) => `<span class="dice">${faces.map((f) =>
  `<span class="die${f === 6 ? " six" : f === 1 ? " one" : ""}">${f}</span>`).join("")}</span>`;
const table = (head, rows) =>
  `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` +
  `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const box = (title, inner) => `<div class="box"><div class="box-h">${esc(title)}</div>${inner}</div>`;
const play = (inner) => `<div class="play"><div class="play-h">The session so far</div>${inner}</div>`;
const rule = (t) => `<div class="ruleref">${t}</div>`;

const CSS = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 Georgia, "Times New Roman", serif; color: #000; background: #fff; margin: 0; }
h1 { font: 700 26pt/1.15 Georgia, serif; margin: 0 0 4pt; letter-spacing: -.4pt; }
h2 { font: 700 16pt/1.2 Georgia, serif; margin: 22pt 0 6pt; padding-bottom: 3pt;
     border-bottom: 1.5pt solid #000; page-break-after: avoid; }
h3 { font: 700 11.5pt/1.25 Georgia, serif; margin: 14pt 0 4pt; page-break-after: avoid; }
h4 { font: 700 10pt/1.25 Georgia, serif; margin: 10pt 0 3pt; page-break-after: avoid; }
p { margin: 0 0 7pt; }
ul, ol { margin: 0 0 8pt; padding-left: 16pt; }
li { margin-bottom: 3pt; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; font-size: 9pt;
        page-break-inside: avoid; }
th, td { border: .75pt solid #000; padding: 3.5pt 5pt; text-align: left; vertical-align: top; }
th { background: #e8e8e8; font-weight: 700; }
tbody tr:nth-child(even) td { background: #f5f5f5; }
.box { border: 1pt solid #000; padding: 7pt 9pt; margin: 9pt 0; page-break-inside: avoid;
       background: #f7f7f7; }
.box-h { font-weight: 700; font-size: 9pt; text-transform: uppercase; letter-spacing: .6pt;
         margin-bottom: 4pt; }
.play { border-left: 3pt solid #000; padding: 6pt 0 6pt 10pt; margin: 10pt 0;
        page-break-inside: avoid; }
.play-h { font-weight: 700; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .8pt;
          margin-bottom: 4pt; }
.play p:last-child { margin-bottom: 0; }
.ruleref { font-size: 8.5pt; font-style: italic; margin: -4pt 0 8pt; }
.dice { display: inline-block; white-space: nowrap; vertical-align: middle; }
.die { display: inline-block; width: 13pt; height: 13pt; line-height: 12pt; text-align: center;
       border: .75pt solid #000; margin-right: 2pt; font: 8pt/12pt Georgia, serif; }
.die.six { background: #000; color: #fff; font-weight: 700; }
.die.one { background: #cfcfcf; }
.cover { text-align: center; padding-top: 55mm; page-break-after: always; }
.cover .sub { font-size: 13pt; margin-top: 8pt; }
.cover .meta { font-size: 9pt; margin-top: 30mm; }
.toc { page-break-after: always; }
.toc ol { padding-left: 18pt; }
.toc li { margin-bottom: 4pt; }
.lead { font-size: 11.5pt; }
.newpage { page-break-before: always; }
.nb { font-weight: 700; }
code { font: 9.5pt "Courier New", monospace; }
`;

/** Read the rolled beats back out by name. */
const beat = (session, key) => session.log.find((b) => b.beat === key);

export function buildHtml({ session, tables }) {
  const b = (k) => beat(session, k);
  const ev1 = b("event1"), eng = b("engage"), enc1 = b("enc1"), tim1 = b("timer1"),
    obj1 = b("obj1"), enc2 = b("enc2"), tim2 = b("timer2"), ev2 = b("event2"),
    ally1 = b("ally1"), opp = b("opportunity"), jolt = b("crisisEvent"), obj2 = b("obj2"),
    sweep = b("sweep").checks;

  const sections = [];

  /* ---------------------------------------------------------------- 1. how to use */
  sections.push(`
${h2("1 · How to use this guide")}
${p(`Crisis Mode is the rulebook's solo mode: it replaces the Game Master with dice oracles and a set of timers. This guide walks the whole procedure in the order you actually play it, and shows the app's controls at each point. Every worked example follows one hero through one complete crisis, from the first alert to going home.`)}
${p(`<span class="nb">The dice in this guide are real.</span> Each roll was made by the app's own solo engines while this document was generated, using the same code the app runs during play. Nothing was chosen to look tidy — where a roll went badly, the example carries on with the bad result.`)}
${box("Before you start", ul([
  "Turn on <span class=\"nb\">Settings → Solo play (Crisis Mode)</span>. A <span class=\"nb\">Solo</span> tab appears in the bottom bar.",
  "Build a hero on the <span class=\"nb\">Home</span> tab if you have not already. Tick the solo box on the wizard's rank step so the allowance below is applied.",
  "Keep the <span class=\"nb\">Action</span> tab handy — that is where fights are run when one starts.",
])) }
${h3("The solo build allowance")}
${p("A solo hero carries the whole story, so the chapter grants a little more:")}
${ul(tables.build.map(esc))}
${rule("The app applies the extra points and the extra free talent automatically once the solo box is ticked on the rank step.")}
`);

  /* ---------------------------------------------------------------- 2. the loop */
  sections.push(`
${h2("2 · The loop")}
${p("Solo play is a six-step loop. The Solo tab prints it as a numbered strip and highlights the step you are on; the card at the top of the tab always names the single next action.")}
${table(["Step", "What it is", "The app control"], [
  ["1", esc(tables.loop[0]), "<span class=\"nb\">Generate crisis alert</span>"],
  ["2", esc(tables.loop[1]), "<span class=\"nb\">Event check</span>"],
  ["3", esc(tables.loop[2]), "<span class=\"nb\">Engage</span>, on the Crises card"],
  ["4", esc(tables.loop[3]), "<span class=\"nb\">Say what your hero just did</span>"],
  ["5", esc(tables.loop[4]), "<span class=\"nb\">Social scene</span>"],
  ["6", esc(tables.loop[5]), "<span class=\"nb\">Head home</span>"],
])}
${box("The one rule that keeps the loop moving", p("Always have at least one timer running. A timer is what makes the situation change while you are busy — it is the pressure a GM would otherwise apply. If every timer is stopped, nothing is pushing back and play stalls."))}
${h3("Crisis level")}
${p("A single 0–10 counter for how bad things have got. It rises when event checks fire and when a crisis timer runs out. It feeds back into the dice: a higher level makes crisis events harsher and objectives harder.")}
${table(["Level", "Phase", "Effect on objective checks"],
  tables.phases.map((ph) => [`${ph.range[0]}–${ph.range[1]}`, esc(ph.name),
    ph.key === "low" ? "No penalty" : ph.key === "medium" ? "−1 progress die" : "−2 progress dice"]))}
`);

  /* ---------------------------------------------------------------- 3. step 1-2 */
  sections.push(`
${h2("3 · Steps 1 and 2 — the alert, then the heartbeat")}
${h3("Step 1 · Generate a crisis alert")}
${p(esc(tables.alertNote))}
${p("Press <span class=\"nb\">Generate crisis alert</span>. The app rolls the threat tables that suit your rank and lays the result out as four separate facts — kind, what is happening, where, and a complication. It also seeds the first entry on the <span class=\"nb\">Crises</span> card and resets the crisis level to 0.")}
${box("If you want the place described", p("The alert dialog offers the five location engines — City, Region, Space, Atmosphere, Facility. Roll one when you need to know what somewhere is actually like. The Atmosphere engine is blended into the others automatically so a place gets a mood as well as a shape."))}

${h3("Step 2 · Event checks")}
${p("An event check is the heartbeat of the crisis: 2D6, rolled whenever time passes or you want to know whether the situation turns. It is the main way new trouble arrives.")}
${table(["2D6", "Result"], tables.eventCheck.map((e) => [
  e.range[0] === e.range[1] ? String(e.range[0]) : `${e.range[0]}–${e.range[1]}`, esc(e.text)]))}
${p("A crisis event is rolled on the <span class=\"nb\">Crisis Event Engine</span>: D66 picks one of " + tables.crisisFocuses + " focuses, then 2D6 plus the current crisis level picks the severity band (" + tables.crisisBands.map(esc).join(" / ") + "). Because the level is added, an escalating crisis produces harsher events by itself.")}
${play(`
${p(`<span class="nb">Backdraft</span> — a Global Guardian — answers an alert at the docks: a reactor casualty aboard a berthed freighter. Crisis level 0. First event check:`)}
${p(`2D6 → <span class="nb">${ev1.value}</span>. ${esc(ev1.text)}`)}
${ev1.extra ? p(`The engine gives: <span class="nb">${esc(ev1.extra)}</span>${ev1.rolls ? ` <span style="font-size:9pt">(${esc(ev1.rolls)})</span>` : ""}`) : ""}
${p(`Crisis level is now <span class="nb">${ev1.level}</span>.`)}
`)}
`);

  /* ---------------------------------------------------------------- 4. step 3 timers overview */
  sections.push(`
${h2("4 · Step 3 — choosing a crisis and starting timers")}
${p("The <span class=\"nb\">Crises</span> card lists everything you could engage: the alert seeded one, and every event check that fires adds more. <span class=\"nb\">Engage</span> turns a crisis into a running crisis timer named after it. <span class=\"nb\">Ignore</span> leaves it pending — ignoring a danger is a legitimate choice, and it will still be there later.")}
${p("Then add whichever other timers the scene needs. There are four types and they are not interchangeable — each answers a different question, and each is checked at a different moment.")}
${table(["Timer", "Question it answers", "Check it when"], [
  ["<span class=\"nb\">Crisis</span>", "How long until this goes wrong?", "Time passes — between scenes, on a delay, changing location, lingering. <span class=\"nb\">+1</span> die for anything lengthy, <span class=\"nb\">−1</span> for anything fast."],
  ["<span class=\"nb\">Objective</span>", "Am I getting what I came for?", "A milestone happens — something meaningful for or against the goal. <span class=\"nb\">Never</span> on a clock."],
  ["<span class=\"nb\">Ally</span>", "How is the group holding up?", "They face a threat or try something dangerous. Off-screen, at least once every few hours of game time."],
  ["<span class=\"nb\">Encounter</span>", "Have they found me yet?", "Only while exploring or evading somewhere a fight could break out — once per zone you move through or linger in."],
])}
${box("You never have to pick a timer yourself", p("Step 4's control is <span class=\"nb\">Say what your hero just did</span>. Choose from six plain descriptions of what happened — moved somewhere, searched, hit a milestone, allies in danger, a fight ended, time jumped — and the app fires the right checks in the right order with the right modifiers. The table above is the rule it is applying, printed so you can follow along."))}
${play(`
${p(`Backdraft engages the reactor crisis. It becomes a crisis timer: <span class="nb">${esc(eng.timer)}</span>, starting at <span class="nb">${esc(eng.proximity)}</span> because the crisis level is still low.`)}
${p(`She also sets an objective — <span class="nb">${esc(eng.objective)}</span> — at <span class="nb">${esc(eng.objRung)}</span>: ${eng.objDice} progress dice, paying <span class="nb">${eng.objKarma} karma</span> when reached.`)}
${p(`Nothing rolls yet. Setting an objective is bookkeeping; it only advances on a milestone.`)}
`)}
`);

  /* ---------------------------------------------------------------- 5. crisis timer */
  sections.push(`
${h2("5 · The crisis timer")}
${p("A ladder counting down to something specific happening. You name what it triggers when you start it, and that is what happens when it runs out.")}
${table(["Proximity", "Threat dice"], tables.crisisLadder.map((l) => [esc(l.name), String(l.dice)]))}
${p(`Where it starts depends on the phase: <span class="nb">${esc(tables.crisisStart.low)}</span> in a low crisis, <span class="nb">${esc(tables.crisisStart.medium)}</span> in a medium one, <span class="nb">${esc(tables.crisisStart.high)}</span> in a high one. Roll its threat dice when time passes; <span class="nb">every 6 moves it one rung closer</span>. Reaching <span class="nb">now</span> fires the event, raises the crisis level by 1, and removes that timer — so start another.`)}
${h3("Movement mode")}
${p("How carefully you are moving shifts both the crisis timer and the encounter timer. Set it in the Crisis Mode header.")}
${table(["Mode", "Crisis dice", "Enemy dice", "Your INTUITION", "Their INTUITION"], tables.modes.map((m) => {
  const sgn = (n) => (n > 0 ? `+${n}` : String(n));
  return [esc(m.name), sgn(m.crisis), sgn(m.encounter), sgn(m.ownIntuition), sgn(m.vsIntuition)];
}))}
${p("Cautious buys safety with time: fewer enemy dice and sharper senses, but crisis timers advance faster. Rushed is the reverse.")}
${play(`
${p(`Backdraft moves into the flooded deck. Crisis timer, ${tim1.dice} threat dice: ${dice(tim1.faces)} — <span class="nb">${tim1.sixes} six${tim1.sixes === 1 ? "" : "es"}</span>.`)}
${p(`${esc(tim1.from)} → <span class="nb">${esc(tim1.to)}</span>.${tim1.fired ? " It fires: the reactor floods the lower decks. Crisis level +1." : ""}`)}
`)}
`);

  /* ---------------------------------------------------------------- 6. objective */
  sections.push(`
${h2("6 · The objective timer")}
${p("Your goal, and in solo play your <span class=\"nb\">only source of karma</span> — the ten end-of-session questions do not apply. Name the objective, give it a starting distance, and it pays out when reached.")}
${table(["Status", "Progress dice", "Karma if reached"], tables.objectiveLadder.map((l) => [
  esc(l.name), l.dice ? String(l.dice) : "—", l.karma ? String(l.karma) : "—"]))}
${p("Something further away is slower but pays more. Roll its dice only on a <span class=\"nb\">milestone</span> — a development that genuinely moved the goal, for or against. Never on a timer.")}
${box("The arithmetic", ul([
  "Each <span class=\"nb\">6</span> advances one step; each <span class=\"nb\">1</span> cancels a 6.",
  "A net <span class=\"nb\">negative</span> result pushes the objective one step <span class=\"nb\">back</span>, and overcoming that setback becomes your next milestone.",
  "A medium crisis costs <span class=\"nb\">−1</span> die, a high crisis <span class=\"nb\">−2</span>.",
]))}
${play(`
${p(`She finds the maintenance crew — a genuine milestone. Objective check, ${obj1.dice} progress dice${obj1.penalty ? ` (${obj1.penalty} for the crisis level)` : ""}: ${dice(obj1.faces)}`)}
${p(`${obj1.sixes} six${obj1.sixes === 1 ? "" : "es"} − ${obj1.ones} one${obj1.ones === 1 ? "" : "s"} = <span class="nb">${obj1.net}</span>. ${esc(obj1.message)}`)}
`)}
`);

  /* ---------------------------------------------------------------- 7. encounter */
  sections.push(`
${h2("7 · The encounter timer")}
${p("Tracks how close the opposition is getting. <span class=\"nb\">Only start one when it applies</span>: your hero is moving through or searching somewhere they could be found, and it is uncertain whether they have been. A fixed scene you already understand — holding up a collapsing floor, talking someone down, fighting what is already in front of you — needs no encounter timer at all.")}
${p("The Encounter panel has a <span class=\"nb\">Do I need one right now?</span> check that asks exactly that question.")}
${table(["Enemy presence", "Enemy dice"], tables.encounterLadder.map((l) => [esc(l.name), String(l.dice)]))}
${p("Check it once per zone you move through or linger in. Each 6 shifts the presence one rung. At <span class=\"nb\">Encountered</span>, two things are read off the same roll:")}
${table(["Highest die", "Enemy behaviour"], tables.behaviour.map((x) => [
  x.highest === 0 ? "no 6s" : String(x.highest), `<span class="nb">${esc(x.name)}</span> — ${esc(x.effect)}`]))}
${table(["Number of 6s", "Threat size"], tables.threat.map((x) => [
  x.sixes >= 3 ? "3+" : String(x.sixes), `<span class="nb">${esc(x.name)}</span> — ${esc(x.examples)}`]))}
${play(`
${p(`Backdraft sweeps the flooded deck for the crew. It is unknown ground and something aboard is moving, so she starts an encounter timer at <span class="nb">All clear</span> and checks once per zone.`)}
${sweep.map((c, i) => `${p(`<span class="nb">Zone ${i + 1}</span> — ${c.dice} enemy ${c.dice === 1 ? "die" : "dice"}: ${dice(c.faces)} → presence <span class="nb">${esc(c.presence)}</span>.${c.evidence ? ` <span style="font-size:9.5pt">${esc(c.evidence)}</span>` : ""}`)}${
    c.behaviour ? p(`<span class="nb">Encounter — ${esc(c.behaviour)}:</span> ${esc(c.behaviourEffect)}<br><span class="nb">${esc(c.threat)}</span> — ${esc(c.threatExamples)}`) : ""}`).join("")}
${p(`Searching is a lengthy action, so the crisis timer rolls at <span class="nb">+1 die</span>: ${tim2.dice} dice, ${dice(tim2.faces)} → <span class="nb">${esc(tim2.to)}</span>.${tim2.fired ? " It fires — deal with it, then start another." : ""}`)}
${tim2.replaced ? p(`<span style="font-size:9.5pt">(The first timer had already run out, so a replacement was started: <span class="nb">${esc(tim2.replaced)}</span>. Never leave the board empty.)</span>`) : ""}
`)}
${h3("Avoiding a fight")}
${ul(tables.avoiding.map(esc))}
${h3("Escaping one")}
${p("Escape is an AGILITY roll. The modifiers:")}
${table(["Situation", "Dice"], tables.escape.map((m) => [esc(m.text), m.dice > 0 ? `+${m.dice}` : String(m.dice)]))}

${h3("The twelve-step encounter sequence")}
${p("The app walks this for you — the Encounter panel shows which step you are on and offers only that step's controls. It is printed here so you can see where you are in the procedure.")}
${ol(tables.sequence.map(esc))}
`);

  /* ---------------------------------------------------------------- 8. ally */
  sections.push(`
${h2("8 · The ally timer")}
${p("A group helping you, tracked as one unit rather than as individual NPCs — a squad, a dock crew, a handful of other heroes. It measures how they are holding up.")}
${table(["Status", "Support dice"], tables.allyLadder.map((l) => [esc(l.name), String(l.dice)]))}
${box("Reading an ally check", ul([
  "Each <span class=\"nb\">6</span> is a success. In a fight each 6 is also <span class=\"nb\">2 damage</span> to the enemy.",
  "Each <span class=\"nb\">1</span> drops their status one step, toward Alone.",
  "<span class=\"nb\">+2</span> dice if the task suits them, <span class=\"nb\">+3</span> if the situation strongly favours them.",
  "Allies aiding you directly instead give <span class=\"nb\">+2 dice</span> to your own roll.",
]))}
${play(`
${p(`The dock crew hold the bulkhead while Backdraft works — suited to them, so +2 dice. ${ally1.dice} dice: ${dice(ally1.faces)}`)}
${p(`${esc(ally1.text)} They are now <span class="nb">${esc(ally1.to)}</span>.`)}
`)}
`);

  /* ---------------------------------------------------------------- 9. oracles */
  sections.push(`
${h2("9 · The oracles")}
${p("Everything that answers a question a GM would otherwise answer. They live on the <span class=\"nb\">Ask the oracles</span> card.")}
${h3("Yes / no — the Binary Response Engine")}
${table(["D6", "Answer"], tables.binary.map((e) => [
  e.range[0] === e.range[1] ? String(e.range[0]) : `${e.range[0]}–${e.range[1]}`, esc(e.text)]))}
${p("If a yes is likely, roll 2D6 and keep the <span class=\"nb\">highest</span>; if a no is likely, keep the <span class=\"nb\">lowest</span>. A strong result is unequivocal and hands you something extra besides.")}
${h3("Complex answers")}
${p("Two D66 rolls give a directive and a subject — for example <span class=\"nb\">Abandon / Authority</span>, which might mean the officer in charge walks off the job. Take it literally, interpret it, or roll again.")}
${h3("Describe a place")}
${p("Five location engines, rolled when you arrive somewhere and need to know what it is like:")}
${ul(tables.locations.map((l) => `<span class="nb">${esc(l.name)}</span> — ${esc(l.note)}`))}
${h3("Crisis event — the jolt")}
${p("If you are ever unsure what happens next: raise the crisis level by 1 and roll a crisis event. That is the book's own advice, and the app has a button for it.")}
${h3("Opportunity events")}
${p("The positive counterpart, prompted by 11–12 on an event check. Keep them rare. One may itself count as a milestone that triggers an objective check.")}
${table(["D66", "Opportunity"], tables.opportunity.map((e) => [
  `${e.range[0]}–${e.range[1]}`, esc(e.text)]))}
${h3("Bonus 6 effects")}
${p("When an <span class=\"nb\">attribute</span> roll comes up with more 6s than it needed, one spare 6 can buy one of these. This applies to attribute rolls only — not to threat, progress, support or enemy dice.")}
${table(["Effect", "What it does"], tables.bonusSix.map((x) => [`<span class="nb">${esc(x.name)}</span>`, esc(x.effect)]))}
${play(`
${p(`Second event check: 2D6 → <span class="nb">${ev2.value}</span>. ${esc(ev2.text)}${ev2.extra ? ` — <span class="nb">${esc(ev2.extra)}</span>` : ""}`)}
${p(`${ev2.value >= 11
  ? "That is the opportunity band, so the Opportunity Engine is rolled"
  : "Separately, a FATE response points at a positive turn — the book's other trigger for an opportunity"}: D66 <span class="nb">${opp.value}</span> — <span class="nb">${esc(opp.text)}</span>.`)}
${p(`Later, unsure what the freighter's crew do next, Backdraft takes the jolt: crisis level +1, then the Crisis Event Engine. Focus D66 <span class="nb">${jolt.focusRoll}</span> — <span class="nb">${esc(jolt.focus)}</span>. Detail 2D6 + crisis level = <span class="nb">${jolt.detailRoll}</span>, band ${esc(jolt.band)}: <span class="nb">${esc(jolt.detail)}</span>.`)}
`)}
`);

  /* ---------------------------------------------------------------- 10. combat */
  sections.push(`
${h2("10 · Combat")}
${box("A fight starts in exactly three ways", ol([
  "An <span class=\"nb\">encounter timer</span> reaches Encountered and you neither avoid nor escape it. The Encounter panel walks you to <span class=\"nb\">Draw initiative</span>.",
  "You <span class=\"nb\">choose to attack</span> something the fiction has already put in front of you — start an action scene on the Action tab.",
  "A <span class=\"nb\">crisis timer fires into a fight</span>, because that is what you named it as triggering.",
]))}
${p("Combat itself is the ordinary combat system — the Action tab runs it. Initiative is a card 1–10 per combatant per round, lowest first. On your turn you have one full action plus one quick action, or two quick actions.")}
${p("The app deals the cards, marks whose turn it is, and gates attacking on turn order. Attacking spends your full action and ends your turn, and the marker moves to the next card automatically.")}
${h3("Running the enemy without a GM")}
${p("The encounter roll already told you two things: <span class=\"nb\">behaviour</span> (from the highest die) and <span class=\"nb\">threat size</span> (from the number of 6s). Use behaviour to decide what they do on their turn, and ask the Binary Engine when it is genuinely unclear. Pull the actual stat block from the <span class=\"nb\">NPCs</span> tab.")}
${h3("Powers without a GM")}
${ul(tables.powerUse.map(esc))}
${h3("Solo combat and recovery")}
${ul(tables.combat.map(esc))}
${ul(tables.recovery.map((t) => `<span class="nb">${esc(t)}</span>`))}
${p("The app shows the recovery panel exactly when it applies, including a <span class=\"nb\">Rally on a memory</span> roll at PRESENCE with a help die.")}
`);

  /* ---------------------------------------------------------------- 11. social */
  sections.push(`
${h2("11 · Step 5 — the social scene")}
${p("After you resolve an event, a threat or an objective, play a social scene. Mechanically it restores <span class=\"nb\">Resolve equal to your PRESENCE rating</span> — and Resolve does not come back from resting, so this is the only way to get it.")}
${ul(tables.socialScenes.map(esc))}
${p("The app's <span class=\"nb\">Social scene</span> button applies the recovery, prints that guidance and offers a social-hooks roll for a prompt. It also clears the \"social scene due\" state, so the loop moves on.")}
${box("When it is due", p("The Solo tab tracks this for you: resolving a crisis, completing an objective, or a timer firing all mark a social scene as due, and the next-step card will say so. Playing one through the ordinary session lifecycle counts too."))}
`);

  /* ---------------------------------------------------------------- 12. endgame */
  sections.push(`
${h2("12 · Step 6 — ending the crisis")}
${h3("Resolve crisis")}
${p("When the danger is dealt with, press <span class=\"nb\">Resolve crisis</span>. It shows exactly what it will do first — clear the alert, drop pending crises, stop the running timers, reset the crisis level, queue a social scene — and it is undoable in one step.")}
${h3("Head home")}
${p("With nothing left running and nothing waiting, <span class=\"nb\">Head home</span> closes the session:")}
${ul([
  "A few hours' rest: <span class=\"nb\">all Health and all Resolve</span> return.",
  "Every <span class=\"nb\">reached objective</span> pays its karma. This is where solo karma is actually banked.",
  "Karma spending unlocks — it is spent between sessions, in a safe location, and home counts.",
  "The board clears, ready for the next alert.",
])}
${box("Karma in solo play", p("Solo heroes do not answer the ten earn / six bad-karma session questions — objectives replace them. With Crisis Mode on, the app's End session dialog suppresses those questions and points you back here, so the two paths can never double-count."))}
${play(`
${p(`With the crew located, Backdraft makes the final push on the objective. Crisis level is now <span class="nb">${obj2.level}</span>${obj2.penalty ? `, costing ${obj2.penalty} progress dice` : ""}. ${obj2.dice} dice: ${dice(obj2.faces)}`)}
${p(`${obj2.sixes} six${obj2.sixes === 1 ? "" : "es"} − ${obj2.ones} one${obj2.ones === 1 ? "" : "s"} = <span class="nb">${obj2.net}</span>. ${esc(obj2.message)}`)}
${p(`Crisis level ended at <span class="nb">${session.finalLevel}</span> — ${esc(session.phase)}. Resolve the crisis, play the social scene, then head home and bank the karma.`)}
`)}
`);

  /* ---------------------------------------------------------------- 12b. mistakes */
  sections.push(`
${h2("13 · Common mistakes")}
${table(["Mistake", "Why it breaks play", "Do this instead"], [
  ["Letting every timer stop", "Nothing is pushing back, so the story stalls and you end up inventing pressure by hand.", "Keep at least one crisis timer running at all times. When one fires, start another."],
  ["Rolling the objective on a clock", "Objectives are not timers. Rolling them as time passes makes karma automatic and drains the tension.", "Roll it only on a milestone — something that genuinely moved the goal, for or against."],
  ["Starting an encounter timer for every scene", "Fixed, known scenes have nothing to discover, so the check is noise.", "Only while exploring or evading. Use the panel's <span class=\"nb\">Do I need one right now?</span> check."],
  ["Taking bonus 6 effects on timer rolls", "They are scoped to attribute rolls. Threat, progress, support and enemy dice are not attribute rolls.", "Only on attribute rolls — and the app only offers them there."],
  ["Answering the session karma questions", "Solo karma comes from objectives; answering both double-counts it.", "Bank karma by reaching objectives and heading home. The app suppresses the questions in solo mode."],
  ["Overriding an oracle you dislike", "The oracles are the GM. Ignoring them makes you the GM again, and the surprise goes.", "Take the answer and make it fit. If it truly cannot fit, read adjacent rows rather than re-rolling."],
])}
`);

  /* ---------------------------------------------------------------- appendix A */
  sections.push(`
<div class="newpage"></div>
${h2("Appendix A · Crisis Event Engine")}
${p("D66 for the focus, then 2D6 + the current crisis level for the detail. " + esc(tables.crisisNote))}
${table(["D66", "Focus", ...tables.crisisBands],
  tables.crisisEntries.map((e) => [String(e.roll), `<span class="nb">${esc(e.focus)}</span>`, ...e.details.map(esc)]))}
`);

  /* ---------------------------------------------------------------- appendix B */
  sections.push(`
<div class="newpage"></div>
${h2("Appendix B · Complex Response Engine")}
${p("Two D66 rolls: a directive and a subject. Read the pair literally, interpret it, or roll again.")}
<div style="column-count:2;column-gap:14pt">
${table(["D66", "Directive"], Object.entries(tables.complexDirectives).map(([k, v]) => [k, esc(v)]))}
${table(["D66", "Subject"], Object.entries(tables.complexSubjects).map(([k, v]) => [k, esc(v)]))}
</div>
`);

  /* ---------------------------------------------------------------- 13. transitions */
  sections.push(`
<div class="newpage"></div>
${h2("13 · Transitions at a glance")}
${p("The single hardest part of solo play is knowing when to move from one thing to the next. This is the whole answer on one page.")}
${table(["You just…", "Roll this", "Then"], [
  ["Generated an alert", "Nothing", "Event check (step 2)"],
  ["Made an event check that fired", "Crisis Event Engine", "The event joins the Crises card — engage or ignore it"],
  ["Engaged a crisis", "Nothing", "Play. Say what your hero did"],
  ["Set an objective", "Nothing", "Play. It only moves on a milestone"],
  ["Moved to a new place", "Encounter check, then crisis timers", "If Encountered: reveal, avoid, escape or fight"],
  ["Searched, waited or worked", "Encounter check, then crisis timers <span class=\"nb\">+1 die</span>", "Same"],
  ["Hit a milestone", "Objective check, then an event check", "If reached, claim karma when you head home"],
  ["Sent allies into danger", "Ally check", "Each 1 drops their status a step"],
  ["Finished a fight or long scene", "Crisis timers <span class=\"nb\">+1 die</span>, then an event check", "Social scene if something resolved"],
  ["Had a crisis timer fire", "Nothing further", "Deal with it, start another timer, social scene"],
  ["Resolved the crisis", "Nothing", "Social scene, then head home"],
])}
${h3("Deciding whether you need an encounter timer")}
${p("Ask one question: <span class=\"nb\">is my hero moving through or searching somewhere the opposition could find them?</span> Patrol, sweep of an unknown building, sneaking past a cordon, an escape — yes. A fixed, known scene — no, and the crisis timers and objective carry on regardless.")}
${h3("If you are stuck")}
${ol([
  "Check the next-step card at the top of the Solo tab. It always names one action.",
  "If the fiction has stalled rather than the procedure, take the jolt: crisis level +1 and roll a crisis event.",
  "If a specific question is blocking you, ask the Binary Engine and accept the answer.",
])}
`);

  /* ---------------------------------------------------------------- cheat sheet */
  sections.push(`
<div class="newpage"></div>
${h2("Appendix C · One-page play aid")}
${h3("The loop")}
${ol(tables.loop.map(esc))}
${h3("Timer triggers")}
${table(["Timer", "Check it when"], [
  ["Crisis", "Time passes. +1 die lengthy, −1 fast. Each 6 moves it closer; at <span class=\"nb\">now</span> it fires and the level rises."],
  ["Objective", "A milestone. 6s advance, 1s cancel 6s, net-negative pushes it back. Medium −1 die, high −2."],
  ["Ally", "They face danger. Each 6 a success (2 damage in a fight), each 1 drops a step."],
  ["Encounter", "Per zone while exploring or evading only. Each 6 shifts presence."],
])}
${h3("Event check — 2D6")}
${table(["Roll", "Result"], tables.eventCheck.map((e) => [
  e.range[0] === e.range[1] ? String(e.range[0]) : `${e.range[0]}–${e.range[1]}`, esc(e.text)]))}
${h3("Binary — D6")}
${table(["Roll", "Answer"], tables.binary.map((e) => [
  e.range[0] === e.range[1] ? String(e.range[0]) : `${e.range[0]}–${e.range[1]}`, esc(e.text)]))}
${p("Likely yes: 2D6 keep highest. Likely no: keep lowest.")}
${h3("Stuck?")}
${p("Crisis level +1, roll a crisis event. That is the book's own answer.")}
`);

  /* ---------------------------------------------------------------- glossary */
  sections.push(`
${h2("Appendix D · Glossary")}
${table(["Term", "Meaning"], [
  ["Crisis alert", "The briefing that opens a crisis — rolled from the threat tables for your rank."],
  ["Crisis level", "0–10 counter for how bad things are. Feeds crisis-event severity and objective penalties."],
  ["Crisis event", "A new or worsening complication, rolled on the Crisis Event Engine. Raises the level by 1."],
  ["Opportunity event", "The positive counterpart. Rare. May count as a milestone."],
  ["Milestone", "Something that genuinely moved your objective, for or against. The only trigger for an objective check."],
  ["Proximity", "Which rung a crisis timer is on, from distant to now."],
  ["Presence", "Which rung an encounter timer is on, from All clear to Encountered."],
  ["Movement mode", "Alert, cautious or rushed. Shifts crisis and encounter dice in opposite directions."],
  ["Stressed out", "Resolve 0. You act normally but cannot push and cannot spend stress on powers."],
  ["Broken", "Health 0. In solo play you can still act, at −1 die."],
])}
`);

  /* ---------------------------------------------------------------- cover + toc */
  const titles = ["How to use this guide", "The loop", "Steps 1 and 2 — the alert, then the heartbeat",
    "Step 3 — choosing a crisis and starting timers", "The crisis timer", "The objective timer",
    "The encounter timer", "The ally timer", "The oracles", "Combat", "Step 5 — the social scene",
    "Step 6 — ending the crisis", "Common mistakes",
    "Appendix A — Crisis Event Engine", "Appendix B — Complex Response Engine",
    "Transitions at a glance", "Appendix C — One-page play aid", "Appendix D — Glossary"];

  const cover = `
<div class="cover">
  <h1>Solo Play</h1>
  <div class="sub">A step-by-step guide to Crisis Mode<br>in the Invincible Player app</div>
  <div class="meta">
    Every die in the worked session was rolled by the app's own solo engines.<br>
    The random seed was chosen so the session exercises each mechanic; no individual result was edited.<br>
    Rules content paraphrased from the core rulebook; a personal play aid.<br>
    Generated ${new Date().toISOString().slice(0, 10)}.
  </div>
</div>
<div class="toc">
  <h2 style="margin-top:0">Contents</h2>
  <ol>${titles.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
  <p class="lead" style="margin-top:14pt">If you read nothing else, read <span class="nb">§2 The loop</span> and <span class="nb">§13 Transitions at a glance</span>. Between them they contain the whole procedure.</p>
</div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Invincible — Solo Play Guide</title><style>${CSS}</style></head>
<body>${cover}${sections.join("\n")}</body></html>`;
}
