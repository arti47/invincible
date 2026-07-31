// data-tutorial.js — tutorial content for first-time players (basics + Crisis Mode solo).
// Rules content here is paraphrased from the same chapter extracts as data.js (§11); nothing is
// copied. The worked example runs on TUTORIAL_HERO, a fixed legal Global Guardian build so every
// number quoted below is reproducible. It is never saved to the player's roster.

export const TUTORIAL_HERO = {
  heroName: "Backdraft",
  realName: "Nia Okoro",
  rank: "global",
  role: "Brawn",
  occupation: "Blue Collar",
  // 7 + 5 + 6 + 4 + 4 + 6 = 32 = the Global Guardian allowance.
  attributes: { fighting: 7, agility: 5, strength: 6, reason: 4, intuition: 4, presence: 6 },
  // 4 power slots: PROTECTION (1) + Major STRIKE (2) + FLIGHT (1).
  powers: [
    { name: "PROTECTION", level: 0, boosts: [], limits: [] },
    { name: "STRIKE", level: 1, boosts: [], limits: [] },
    { name: "FLIGHT", level: 0, boosts: [], limits: [] },
  ],
  talents: [{ name: "Hard Hitter", rank: 1 }, { name: "Durable", rank: 1 }],
  derived: { health: 11, resolve: 7, slugfest: 5, armor: 2, resources: 3, reputation: 2 },
  note: "Health ceil((7+5+6)/2)=9, +2 for one rank of Durable = 11. Resolve ceil((4+4+6)/2)=7. Slugfest ceil(6/2)=3, +2 from Major STRIKE = 5. Armor 2 from basic PROTECTION.",
};

export const BASICS_TUTORIAL = [
  {
    id: "what",
    title: "1 · What you actually do",
    intro: "You play one superhero. A GM describes a situation, you say what your hero does, and dice settle anything risky.",
    steps: [
      { text: "Everything is resolved with a handful of six-sided dice. You never add numbers together — you count how many dice landed on 6.",
        example: "One 6 = you succeed. No 6s = you fail. Every 6 beyond the first buys something extra." },
      { text: "How many dice you roll is simply the attribute score being tested. A score of 7 means 7 dice.",
        app: "On the Sheet tab, each attribute card shows the dice it currently rolls. Tap it to roll." },
      { text: "There is no skill list in this game. Attributes do the work, and talents are the specialisation layer on top.",
        example: "Picking a lock is a REASON or AGILITY roll depending on how you go about it — the GM decides which attribute fits." },
    ],
  },
  {
    id: "roll",
    title: "2 · Your first roll",
    intro: "Backdraft has FIGHTING 7, so a punch rolls 7 dice.",
    steps: [
      { text: "Roll dice equal to the attribute. Count the 6s.", demo: "pool",
        example: "7 dice come up 6, 4, 6, 2, 1, 3, 5 → two 6s. That is a success, with one 6 spare." },
      { text: "The first 6 succeeds. Each extra 6 is a stunt — a free extra effect you choose from a list.",
        app: "The roll result panel tells you how many stunts you earned and lists what they can buy." },
      { text: "Modifiers add or remove dice, never bonuses to a total. A pool never drops below one die no matter how many penalties apply.",
        example: "Backdraft afflicted (−3 dice) rolling PRESENCE 6 rolls 3 dice. The same hero at PRESENCE 1 still rolls 1." },
    ],
  },
  {
    id: "push",
    title: "3 · Pushing, and what it costs",
    intro: "A failed roll is not the end. You can push it once — but pushing hurts.",
    steps: [
      { text: "Pushing re-rolls every die that is not showing a 6 and not showing a 1. The 6s you already have are kept, and so are the 1s.",
        demo: "push" },
      { text: "After the push, every 1 showing costs you 1 point of Resolve. That is the price, and it is paid whether or not the push worked.",
        example: "Push and end with three 1s on the table → 3 Resolve gone." },
      { text: "You cannot push at 0 Resolve, cannot push a passive roll, and cannot push when you are the defender in an opposed roll.",
        app: "The app hides the Push button and tells you which of those three rules is stopping you." },
      { text: "At 0 Resolve you are stressed out. You still act normally — you simply cannot push, and cannot spend stress to fuel powers." },
    ],
  },
  {
    id: "fight",
    title: "4 · A fight, start to finish",
    intro: "Combat runs in rounds. Each round you draw an initiative card 1–10 and the lowest number goes first.",
    steps: [
      { text: "On your turn you get one full action plus one quick action, or two quick actions. Taking a second quick action gives up your full action.",
        app: "Action tab → Start action scene deals initiative and tracks who has acted." },
      { text: "A slugfest is a punch in your own zone: full action, roll FIGHTING. A shooting attack is at range: full action, roll AGILITY.",
        demo: "attack",
        example: "Backdraft rolls FIGHTING 7. Two 6s → a hit plus one stunt. Damage is her Slugfest Damage, 5." },
      { text: "The defender can spend a quick action to block a slugfest (roll FIGHTING) or dodge a shooting attack (roll AGILITY) — but must declare it before the attacker rolls.",
        example: "Each defender 6 cancels one attacker 6. Roll more 6s than the attacker and you counterattack automatically." },
      { text: "Spend your spare 6s on stunts: Double Damage, Knockback, Stun, Bang Heads, Trap, Disarm, or Deadly Hit with a sharp weapon. One of each per target.",
        example: "Knockback, Bang Heads and Slam deal half your base STRENGTH — for Backdraft that is 3, not her Slugfest 5." },
    ],
  },
  {
    id: "hurt",
    title: "5 · Getting hurt",
    intro: "Damage comes off Health. Armor subtracts from each hit before it lands.",
    steps: [
      { text: "Armor reduces every incoming instance of damage. Only one armor applies at a time — the best one.",
        example: "Backdraft has Armor 2. A 6-damage hit costs her 4 Health." },
      { text: "At 0 Health you are broken: out of action, no moving, no attribute rolls, no powers. You also roll immediately on the critical injury table.",
        demo: "damage" },
      { text: "The critical injury roll is a D6 plus the damage in excess of what broke you. Most results are a dice penalty and a healing time; 10 and 11 mean you are dying; 12+ is death.",
        app: "The app rolls it, applies the penalty to the right attributes automatically, and starts the dying clock when it needs to." },
      { text: "Broken but conscious? Rally: a full action and a PRESENCE roll, regaining 1 Health per 6. You cannot rally on a critical injury of 9 or worse." },
      { text: "Health comes back on its own — your STRENGTH rating a few minutes after the scene, all of it after a few hours' rest. Critical injuries heal on their own slower schedule.",
        app: "Sheet → Rest & recover, or the End action scene bundle, which applies it for you." },
    ],
  },
  {
    id: "between",
    title: "6 · Between the fights",
    intro: "Social scenes restore Resolve, and the end of a session is when your hero actually improves.",
    steps: [
      { text: "A social scene restores Resolve equal to your PRESENCE rating — all of it if the scene includes a few hours' break. Resolve does not come back from resting alone.",
        example: "Backdraft has PRESENCE 6, so a social scene returns 6 Resolve." },
      { text: "At the end of a session you answer ten questions — did you get into an action scene, play to your personality, your drive, your flaw, and so on. Each yes is 1 karma. Overcoming your flaw is worth 2 and removes it.",
        app: "Home → End session runs the whole list and does the arithmetic." },
      { text: "Six more questions take karma away: failing a teammate, failing bystanders, wrecking zones, killing. Karma never drops below zero.",
        example: "Wreck a city street during a fight and that is 1 bad karma waiting at the end of the session." },
      { text: "Karma is spent only between sessions, in a safe location. A new talent costs 10, a new power 20, an attribute step 10 (or 20 above your rank's maximum).",
        app: "Home → Start session locks spending again for the new session." },
    ],
  },
  {
    id: "make",
    title: "7 · Making your own hero",
    intro: "Nine steps in the app, in the order the rules want them.",
    steps: [
      { text: "Pick a rank. It sets everything else: Teen Upstart 20 attribute points and 2 powers, Street Defender 26 and 3, Global Guardian 32 and 4, Cosmic Champion 38 and 5.",
        example: "The total of all six attribute scores equals your rank's points. Backdraft's 7+5+6+4+4+6 = 32." },
      { text: "Pick an archetype, or build from scratch. An archetype just fills in suggested attributes, powers and talents — change any of it freely.",
        app: "Every long list in the wizard is a dropdown, with the D3/D6 roll button beside it if you would rather roll." },
      { text: "Trades let you rebalance: 2 attribute points buy an extra power, giving a power up returns 2, an extra talent or power source costs 1, and each drawback you take returns 1 (maximum two).",
        example: "Backdraft spent 4 slots: PROTECTION, Major STRIKE (basic plus the Major level), and FLIGHT." },
      { text: "Finish with occupation (this sets your Resources), personality, drive, flaw, names and key relationships. The wizard blocks anything the rules do not allow." },
    ],
  },
];

export const SOLO_TUTORIAL = [
  {
    id: "s-what",
    title: "1 · Playing without a GM",
    intro: "Crisis Mode replaces the GM with dice oracles and timers. You ask the questions and the tables answer.",
    steps: [
      { text: "Build your hero normally, then take 2 extra attribute points and 1 extra free talent. Global Guardian is the recommended rank.",
        example: "Favour self-sufficient powers — HEALING, QUICKNESS, DUPLICATION — over ones that mainly help allies." },
      { text: "Solo karma does not come from the ten session questions. It comes from reaching objectives on the objective timer.",
        app: "With Crisis Mode on, End session skips the questions and points you at the Solo tab." },
      { text: "Turn it on in Settings → Solo play (Crisis Mode). A Solo tab appears.", demo: "enableSolo" },
    ],
  },
  {
    id: "s-loop",
    title: "2 · The loop",
    intro: "Six steps, repeating. The Solo tab shows them as a numbered strip and highlights the one you are on.",
    steps: [
      { text: "Generate a crisis alert. This is your briefing — a news report, an agency call, something you witness on patrol.",
        app: "Solo tab → Generate crisis alert rolls the threat tables appropriate to your rank." },
      { text: "Set the crisis level to 0 and start making event checks.", example: "Generating an alert resets the level for you." },
      { text: "Choose a crisis and start a crisis timer for it, plus any ally, objective or encounter timers you need.",
        app: "The Crises panel lists everything you could engage. Engage turns one into a running timer." },
      { text: "Make checks, track the timers, engage what turns up." },
      { text: "After resolving something, play a social scene — especially to get Resolve back." },
      { text: "Return to whatever is left, or go home to rest and bank karma." },
    ],
  },
  {
    id: "s-oracle",
    title: "3 · The oracles",
    intro: "Three tools answer the questions a GM normally would.",
    steps: [
      { text: "Event check: roll 2D6 whenever time passes. 2 means two crisis events and the crisis level jumps 2. 3–4 means one event and +1. 5–10 is quiet. 11–12 is an opportunity.",
        demo: "eventCheck" },
      { text: "Binary engine: any yes/no question. Roll a D6 — 1 is a strong no, 2–3 no, 4–5 yes, 6 a strong yes. If yes is likely roll 2D6 and keep the highest; if no is likely keep the lowest.",
        demo: "binary",
        example: "\"Is the guard still at the door?\" Unlikely, so roll 2D6 keep lowest." },
      { text: "Complex engine: two D66 rolls give a directive and a subject. Read it literally, interpret it, or roll again.",
        demo: "complex",
        example: "\"Abandon\" + \"Authority\" → the officer in charge walks off the job." },
    ],
  },
  {
    id: "s-timers",
    title: "4 · The four timers",
    intro: "Timers are the pressure. Always keep at least one running.",
    steps: [
      { text: "Crisis timer — counts down to something bad. Roll its threat dice when time passes; each 6 moves it one rung closer, from distant through approaching, close, imminent, next, to now.",
        demo: "crisisTimer",
        example: "It starts at distant (5 dice) in a low crisis, close (3 dice) in a medium one." },
      { text: "When it reaches now, the event fires, the crisis level rises by 1, and that timer is done. Start another.",
        example: "Long, careful actions add a die to the check. Fast ones remove one." },
      { text: "Objective timer — your goal, and your karma. It runs out of reach, far off, manageable, near, within reach, achievable, reached. Roll its dice to advance.",
        demo: "objective",
        example: "1s cancel 6s. A net-negative result pushes the objective a step backwards. Medium crisis is −1 die, high is −2." },
      { text: "Ally timer — a group helping you, tracked as one unit: Unified, Strained, Diminished, Overwhelmed, Desperate, Last Stand, Alone. Each 6 is a success and 2 damage in a fight; each 1 drops them a step." },
      { text: "Encounter timer — how close the opposition is, from All clear to Encountered. Your movement mode (alert, cautious, rushed) shifts it.",
        example: "At Encountered, the highest die sets enemy behaviour and the number of 6s sets the threat size." },
    ],
  },
  {
    id: "s-play",
    title: "5 · A worked turn",
    intro: "Backdraft, Global Guardian, in Crisis Mode.",
    steps: [
      { text: "Generate an alert: a city incident. The tables give a catalyst, an incident, a location and a complication — say a chemical fire at the docks, with the access road blocked." },
      { text: "Crisis level 0. Start a crisis timer named \"the tank ruptures\". Low crisis, so it begins at distant with 5 threat dice." },
      { text: "Set an objective: \"get everyone out of the loading bay\". Far off, so 2 progress dice and 4 karma when it is reached." },
      { text: "Move in cautiously. Roll the crisis timer: two 6s moves it from distant to close. Roll the objective: one 6, one 1 — net zero, no progress.", demo: "crisisTimer" },
      { text: "Event check: a 4. One crisis event, crisis level to 1. The complex engine says \"Restrain Machinery\" — a collapsing gantry pins a worker. That goes on the Crises list." },
      { text: "Engage it. Backdraft has STRENGTH 6 and lifts a ton, so the GM-less ruling is obvious: no roll needed for the lift itself, but the app's challenge tracker handles the fire around her.", app: "Action tab → Challenges & progress → Burning Building." },
      { text: "Objective reached. Claim 4 karma on the Solo tab, then play a social scene to get Resolve back — a phone call to her sister counts.", demo: "objective" },
    ],
  },
];

export const TUTORIAL_INDEX = [
  { key: "basics", name: "Learn the game", desc: "For a first-time player: dice, fights, damage, karma and building a hero.", chapters: BASICS_TUTORIAL },
  { key: "solo", name: "Learn solo play", desc: "Crisis Mode: playing without a GM using oracles and timers.", chapters: SOLO_TUTORIAL },
];
