// data-solo.js — Crisis Mode (Ch.9): the official solo rules, engines and timers.

export const SOLO_SETUP = {
  build: [
    "Create your hero normally, then add 2 extra attribute points.",
    "Start with one additional free talent. Durable, Resilience and Second Wind suit solo play.",
    "Favour powers that support utility and survivability (DUPLICATION, HEALING, QUICKNESS) over powers that mainly aid allies or need GM interpretation (ACTION PLAN, PRECOGNITION).",
    "Any rank works as long as you generate matching crisis alerts. Global Guardian is recommended.",
    "Instead of end-of-session karma, solo heroes earn karma by completing objectives on the objective timer.",
  ],
  loop: [
    "Generate a crisis alert from the random threat tables or the Complex Response Engine.",
    "Start the crisis level at 0 and begin making event checks.",
    "Choose a crisis and start a crisis timer, plus any ally, objective or encounter timers.",
    "Make checks, track timers and the crisis level, and engage threats or opportunities.",
    "After resolving an event, threat or objective, play a social scene — especially to recover Resolve.",
    "Return to any remaining crisis dangers, or head home to rest, recover and earn karma.",
  ],
  alertsByRank: {
    teen: ["Criminal activity", "City incidents", "Sometimes global dangers"],
    street: ["Criminal activity", "City incidents"],
    global: ["City incidents", "Global dangers"],
    cosmic: ["Global dangers", "Cosmic perils"],
  },
  alertNote: "A crisis alert works like a briefing: a priority message from an agency, a breaking news story, or something your hero witnesses on patrol.",
  recovery: [
    "If you are broken by damage or stress you can still act, at -1 die.",
    "When broken by stress you may make a PRESENCE roll as if aided by an ally — but the aid is an important memory. Decide what comforts or inspires you in that moment.",
  ],
  socialScenes: [
    "Condense a social scene into a brief statement rather than roleplaying a conversation with yourself.",
    "Alternatively, frame it as a flashback relevant to the current crisis.",
    "The social hooks table works as inspiration.",
  ],
};

export const CRISIS_LEVEL = {
  min: 0, max: 10,
  phases: [
    { key: "low", name: "Low danger", range: [0, 3] },
    { key: "medium", name: "Medium danger", range: [4, 7] },
    { key: "high", name: "High danger", range: [8, 10] },
  ],
  increases: [
    "Encountering a crisis event raises the crisis level by 1 or 2.",
    "Triggering a crisis timer raises the crisis level by 1.",
  ],
};

export const EVENT_CHECK = {
  die: "2D6",
  entries: [
    { range: [2, 2], text: "Roll for two crisis events; crisis level +2." },
    { range: [3, 4], text: "Roll for one crisis event; crisis level +1." },
    { range: [5, 10], text: "No event." },
    { range: [11, 12], text: "Opportunity event." },
  ],
  when: [
    "When you use the Binary or Complex Response Engine to ask a question or gain a detail.",
    "When you jump in time, move to a new location, or tie up a major element of the mission.",
    "Whenever you're unsure whether the situation still holds or something has gone wrong.",
  ],
};

export const BINARY_ENGINE = {
  die: "D6",
  entries: [
    { range: [1, 1], text: "Strong no" },
    { range: [2, 3], text: "No" },
    { range: [4, 5], text: "Yes" },
    { range: [6, 6], text: "Strong yes" },
  ],
  usage: [
    "Roll one D6 when either answer is about equally likely.",
    "If yes is likely, roll two D6 and take the highest; if no is likely, take the lowest.",
    "Phrase the question so that yes is the most positive outcome for your hero.",
    "A strong result is unequivocal and usually reveals an extra detail or unusual circumstance.",
  ],
};

export const COMPLEX_ENGINE = {
  die: "D66",
  usage: "Roll on one column for a single answer, or both to build a phrase. Take the result literally, interpret it for the situation, or roll again.",
  directives: {
    11: "Abandon", 12: "Aid", 13: "Alert", 14: "Ambush", 15: "Attack", 16: "Betray",
    21: "Breach", 22: "Capture", 23: "Command", 24: "Construct", 25: "Create", 26: "Deliver",
    31: "Destroy", 32: "Discover", 33: "Escape", 34: "Escort", 35: "Explore", 36: "Heal",
    41: "Hide", 42: "Hunt", 43: "Infest", 44: "Investigate", 45: "Isolate", 46: "Preserve",
    51: "Protect", 52: "Quarantine", 53: "Reclaim", 54: "Repair", 55: "Sabotage", 56: "Scavenge",
    61: "Secure", 62: "Survive", 63: "Threaten", 64: "Transform", 65: "Transport", 66: "Unearth",
  },
  subjects: {
    11: "Alarm", 12: "Alien", 13: "Artifact", 14: "Authority", 15: "Cargo", 16: "City",
    21: "Computer", 22: "Containment", 23: "Corporation", 24: "Creature", 25: "Darkness", 26: "Data",
    31: "Death", 32: "Destruction", 33: "Device", 34: "Environment", 35: "Experiment", 36: "Fear",
    41: "Focus", 42: "Hostility", 43: "Injury", 44: "Machine", 45: "Message", 46: "Military",
    51: "Mission", 52: "Outbreak", 53: "People", 54: "Planet", 55: "Robot", 56: "Ship",
    61: "Space", 62: "Supplies", 63: "Time", 64: "Trap", 65: "Violence", 66: "Weapon",
  },
};

export const LOCATION_ENGINES = {
  city: { name: "City Engine", die: "D66", note: "Where in the city you are, or need to travel to.", entries: [
    { range: [11, 12], text: "City limits / outskirts" }, { range: [13, 14], text: "Docks" },
    { range: [15, 16], text: "Commercial zone" }, { range: [21, 21], text: "Laboratory" },
    { range: [22, 22], text: "Park / recreational" }, { range: [23, 23], text: "Religious center" },
    { range: [24, 24], text: "University campus" }, { range: [25, 26], text: "Rough neighborhood" },
    { range: [31, 32], text: "Entertainment district" }, { range: [33, 36], text: "Residential area" },
    { range: [41, 41], text: "Research district" }, { range: [42, 43], text: "Subway tunnels" },
    { range: [44, 45], text: "Downtown" }, { range: [46, 46], text: "Financial district" },
    { range: [51, 51], text: "Performance venue" }, { range: [52, 52], text: "Police precinct" },
    { range: [53, 54], text: "Inner city" }, { range: [55, 56], text: "Sports arena" },
    { range: [61, 62], text: "Warehouse district" }, { range: [63, 63], text: "Military installation" },
    { range: [64, 65], text: "Industrial district" }, { range: [66, 66], text: "City hall" }] },
  region: { name: "Region Engine", die: "D66", note: "Outdoor locations and larger regions.", entries: [
    { range: [11, 13], text: "Arctic / polar" }, { range: [14, 16], text: "Canyon" },
    { range: [21, 23], text: "Coastal / bay" }, { range: [24, 26], text: "Desert / arid" },
    { range: [31, 33], text: "Island" }, { range: [34, 36], text: "Forest" },
    { range: [41, 43], text: "Mountain / plateau" }, { range: [44, 46], text: "Plain / grassland" },
    { range: [51, 53], text: "Subterranean" }, { range: [54, 56], text: "Swamp / marsh" },
    { range: [61, 63], text: "Tropical" }, { range: [64, 66], text: "Valley / basin" }] },
  space: { name: "Space Engine", die: "D66", note: "Outer space and interstellar travel.", entries: [
    { range: [11, 13], text: "Asteroid field" }, { range: [14, 16], text: "Black hole" },
    { range: [21, 23], text: "Comet" }, { range: [24, 26], text: "Galaxy" },
    { range: [31, 33], text: "Geomagnetic storm" }, { range: [34, 36], text: "Moon" },
    { range: [41, 43], text: "Nebulae" }, { range: [44, 46], text: "Planet" },
    { range: [51, 53], text: "Solar system" }, { range: [54, 56], text: "Star" },
    { range: [61, 63], text: "Sun" }, { range: [64, 66], text: "Supernova" }] },
  facility: { name: "Facility Engine", die: "D66", note: "Interiors of buildings, complexes, bases, lairs and factories.", entries: [
    { range: [11, 12], text: "Armory / weapons" }, { range: [13, 14], text: "Cargo / storage" },
    { range: [15, 16], text: "Command / information" }, { range: [21, 22], text: "Communal / recreation" },
    { range: [23, 24], text: "Elevators / stairs" }, { range: [25, 26], text: "Factory / production" },
    { range: [31, 32], text: "Garage / hangar" }, { range: [33, 34], text: "Garden / greenhouse" },
    { range: [35, 36], text: "Kitchen / galley" }, { range: [41, 42], text: "Maintenance / machine room" },
    { range: [43, 44], text: "Medical / infirmary" }, { range: [45, 46], text: "Offices / suites" },
    { range: [51, 52], text: "Power / reactor" }, { range: [53, 54], text: "Quarters / barracks" },
    { range: [55, 56], text: "Science / research" }, { range: [61, 62], text: "Security / detention" },
    { range: [63, 64], text: "Technology / mainframe" }, { range: [65, 66], text: "Workshop / engineering" }] },
  atmosphere: { name: "Atmosphere Engine", die: "D66", note: "A descriptive prompt for an area — mundane detail, mystery or obstacle.", entries: [
    { range: [11, 11], text: "Anomalous" }, { range: [12, 12], text: "Abandoned" }, { range: [13, 13], text: "Airless" },
    { range: [14, 14], text: "Barricaded" }, { range: [15, 15], text: "Bloodied" }, { range: [16, 16], text: "Breached" },
    { range: [21, 21], text: "Bullet-riddled" }, { range: [22, 22], text: "Claustrophobic" }, { range: [23, 23], text: "Cluttered" },
    { range: [24, 24], text: "Collapsing" }, { range: [25, 25], text: "Contaminated" }, { range: [26, 26], text: "Corpse-strewn" },
    { range: [31, 31], text: "Darkened" }, { range: [32, 32], text: "Dripping" }, { range: [33, 33], text: "Echoing" },
    { range: [34, 34], text: "Empty" }, { range: [35, 35], text: "Expansive" }, { range: [36, 36], text: "Flickering" },
    { range: [41, 41], text: "Flooded" }, { range: [42, 42], text: "Illuminated" }, { range: [43, 43], text: "Inhabited" },
    { range: [44, 44], text: "Radioactive" }, { range: [45, 45], text: "Ransacked" }, { range: [46, 46], text: "Sealed" },
    { range: [51, 51], text: "Secure" }, { range: [52, 52], text: "Silent" }, { range: [53, 53], text: "Smoke-filled" },
    { range: [54, 54], text: "Sparking" }, { range: [55, 55], text: "Stinking" }, { range: [56, 56], text: "Stockpiled" },
    { range: [61, 61], text: "Strobe-lit" }, { range: [62, 62], text: "Toxic" }, { range: [63, 63], text: "Trapped" },
    { range: [64, 64], text: "Well-lit" }, { range: [65, 65], text: "Wrecked" }, { range: [66, 66], text: "Roll twice" }] },
};

// One benefit per roll, even with several extra 6s.
export const BONUS_SIX_EFFECTS = [
  { name: "Confident", effect: "Regain 1 point of Resolve." },
  { name: "Fast", effect: "You act faster than expected. Crisis timer checks this scene roll -1 threat die." },
  { name: "Impressive", effect: "You impress onlookers: +1 die to PRESENCE rolls in this scene." },
  { name: "Intimidating", effect: "Enemies falter: -1 die to attribute rolls and attacks made against you this scene." },
  { name: "Observant", effect: "You notice an important detail: +1 die on your next roll acting on it." },
  { name: "Masterful", effect: "+1 die on your next attribute roll." },
  { name: "Unnoticed", effect: "You act with subtlety: encounter checks and NPC INTUITION rolls take -1 die." },
];

export const CRISIS_TIMER = {
  ladder: [
    { key: "distant", name: "Distant", dice: 5 },
    { key: "approaching", name: "Approaching", dice: 4 },
    { key: "close", name: "Close", dice: 3 },
    { key: "imminent", name: "Imminent", dice: 2 },
    { key: "next", name: "Next moment", dice: 1 },
    { key: "now", name: "Now", dice: 0 },
  ],
  // Source note: the supplied Ch.9 crisis-timer table's proximity/threat-dice columns are partially
  // truncated. The ladder above uses the proximity names given in the surrounding prose ("from
  // distant to approaching", "when a crisis timer drops to now") with dice decreasing as the event
  // nears, exactly as the prose describes. Flagged for re-check against a printing.
  sourceGap: true,
  startByPhase: { low: "distant", medium: "close", high: "imminent" },
  rules: [
    "Decide what the timer will trigger. If you have no specific event in mind, flag it as 'bad thing happens' and find out together.",
    "Check active timers as time passes between scenes, on delays, when you change location, or when you linger or perform something complex.",
    "Roll threat dice for the proximity; each 6 shifts the event one step closer. Repeat for every active timer.",
    "Roll +1 die for lengthy scenes or actions, and -1 (minimum 1) for anything done faster than normal.",
    "Reaching 'now' fires the event and raises the crisis level by 1.",
    "You may be able to stop a timer entirely — finding the bomb and cutting the right wire.",
    "Once a timer is triggered or stopped, start another. Always keep at least one running.",
  ],
};

export const ALLY_TIMER = {
  ladder: [
    { key: "unified", name: "Unified", dice: 6 },
    { key: "strained", name: "Strained", dice: 5 },
    { key: "diminished", name: "Diminished", dice: 4 },
    { key: "overwhelmed", name: "Overwhelmed", dice: 3 },
    { key: "desperate", name: "Desperate", dice: 2 },
    { key: "lastStand", name: "Last Stand", dice: 1 },
    { key: "alone", name: "You are Alone", dice: 0 },
  ],
  start: [
    "Unified — a group going about their business, unaware of the danger.",
    "Strained — already in the middle of a tense situation.",
    "Diminished — they have already taken casualties.",
  ],
  rules: [
    "Roll support dice for their current status whenever allies face a threat or attempt something dangerous.",
    "Add +2 dice when the action suits their role or capability, or +3 when the situation strongly favours them.",
    "Each 6 is a measure of success; in a fight each 6 converts to 2 points of damage against NPC enemies.",
    "Each 1 shifts their status one step down — deaths, injuries, infighting or being stressed out.",
    "A mix of 6s and 1s means success at a cost.",
    "Allies directly aiding one of your actions give you +2 dice.",
    "Track separate timers for separate groups, and check on off-screen allies at least once per session or every few hours of game time.",
  ],
};

export const OBJECTIVE_TIMER = {
  ladder: [
    { key: "outOfReach", name: "Out of reach", dice: 1, karma: 6 },
    { key: "farOff", name: "Far off", dice: 2, karma: 4 },
    { key: "manageable", name: "Manageable", dice: 3, karma: 2 },
    { key: "near", name: "Near", dice: 4, karma: 1 },
    { key: "withinReach", name: "Within reach", dice: 5, karma: 0 },
    { key: "achievable", name: "Achievable", dice: 6, karma: 0 },
    { key: "reached", name: "Objective reached", dice: 0, karma: 0 },
  ],
  rules: [
    "Name the objective and give it a starting status. More distant objectives progress slower but pay more karma.",
    "Whenever you make progress, roll progress dice for the current status; each 6 advances the timer one step.",
    "No 6s means the milestone didn't meaningfully help — decide why, or what minor complication appeared.",
    "Medium crisis level costs -1 progress die; high crisis costs -2.",
    "Each 1 cancels a 6. More 1s than 6s also pushes the objective one step back — use the Complex Response Engine for the complication, and overcoming it becomes the next milestone.",
    "Reaching the objective needs no further checks, though attribute rolls or encounters tied to it may remain.",
    "Completing an objective earns karma based on its starting status.",
    "If an objective becomes impossible, discard the timer.",
    "The objective timer also works as a measure of progress through a location when you aren't using a map.",
  ],
};

export const ENCOUNTER_TIMER = {
  ladder: [
    { key: "allClear", name: "All clear", dice: 1 },
    { key: "uncertain", name: "Uncertain", dice: 2 },
    { key: "suspected", name: "Suspected", dice: 3 },
    { key: "confirmed", name: "Confirmed", dice: 4 },
    { key: "closing", name: "Closing", dice: 5 },
    { key: "near", name: "Near", dice: 6 },
    { key: "encountered", name: "Encountered", dice: 0 },
  ],
  start: [
    "All clear — navigating an unknown location with no warning of enemies.",
    "Confirmed — you know enemies are here.",
    "Closing or Near — enemies are already converging on you.",
  ],
  rules: [
    "Make an encounter check when you move between zones, or when you linger in one for a few minutes or more.",
    "Roll enemy dice for the current presence; each 6 shifts it one step closer.",
    "One 6 is a subtle sign of others; two is clear evidence something is drawing closer; three or more is unmistakable danger.",
    "Reaching 'encountered' means facing a potential enemy — determine behaviour and threat, then act.",
    "After an encounter is avoided, escaped or resolved, reset the timer to fit the situation.",
  ],
  resets: [
    "All clear — a single enemy defeated and no reason to think others are here.",
    "Suspected — enemies probably remain, but you aren't sure.",
    "Confirmed — you're certain enemies are still somewhere in the location.",
    "Closing — you believe they are in the vicinity.",
  ],
  evidence: [
    { sixes: 1, text: "Imprecise power effects, vague sounds of movement, tracks, signs someone passed this way." },
    { sixes: 2, text: "Clear power effects, sightings on remote cameras, sounds coming nearer." },
    { sixes: 3, text: "Confirmed power effects, shadows in your peripheral vision, nearby sounds, movement in the area." },
  ],
};

export const MOVEMENT_MODES = [
  { key: "alert", name: "Alert (default)", encounter: 0, ownIntuition: 0, vsIntuition: 0, crisis: 0,
    desc: "Moving as you normally would in a crisis: low profile, wary of danger." },
  { key: "cautious", name: "Cautious", encounter: -1, ownIntuition: 1, vsIntuition: -1, crisis: 1,
    desc: "Abundant caution: fewer enemy dice and sharper senses, but crisis timers advance faster." },
  { key: "rushed", name: "Rushed", encounter: 1, ownIntuition: -1, vsIntuition: 1, crisis: -1,
    desc: "Outrunning a deadline: more enemy dice and duller senses, but crisis timers advance slower." },
];

export const ENEMY_BEHAVIOUR = [
  { highest: 6, name: "Stalking, hidden or lying in wait", effect: "The NPCs automatically spot you; roll INTUITION to spot them." },
  { highest: 5, name: "Searching or hunting", effect: "You automatically spot them; they roll INTUITION to spot you." },
  { highest: 4, name: "Passive", effect: "You automatically spot them; they are unaware." },
  { highest: 3, name: "False alarm", effect: "Non-hostile NPCs, or unfounded paranoia." },
  { highest: 2, name: "False alarm", effect: "Non-hostile NPCs, or unfounded paranoia." },
  { highest: 0, name: "Ambushing", effect: "Draw initiative — you are surprised." },
];

export const ENEMY_THREAT = [
  { sixes: 1, name: "Lesser foe", examples: "Lone soldier, guard, cultist, thug, hostile animal." },
  { sixes: 2, name: "Greater enemy or group", examples: "Squad of soldiers, killer robot, infiltrators, an organization's enforcer." },
  { sixes: 3, name: "Overwhelming enemy", examples: "Parasite swarm, supervillain, kaiju, a Viltrumite." },
];

export const ESCAPE_MODIFIERS = [
  { text: "You are using a movement power well suited to the environment", dice: 1 },
  { text: "You are outnumbered", dice: -1 },
  { text: "Fast movement is hampered by flooding, debris or similar", dice: -1 },
  { text: "You are escaping a speedy enemy such as a Viltrumite", dice: -2 },
  { text: "Hostile environment such as fires or extreme cold", dice: -2 },
];

export const AVOIDING_ENCOUNTERS = [
  "Hide: decide whether the enemy actively searches (ask the Binary Engine). If they search, roll INTUITION for them; if they don't search or fail, they move out of the zone within minutes.",
  "Back out: you can retreat from the zone without risk, but consider what that costs you in the location.",
  "Sneak past: roll INTUITION for the enemy; on a failure you slip through to the next zone.",
];

export const ENCOUNTER_SEQUENCE = [
  "Choose your movement mode: alert, cautious or rushed.",
  "Make an encounter check with enemy dice for the current presence, modified by movement mode.",
  "Each 6 shifts the enemy presence one step closer.",
  "If the presence isn't 'encountered' yet, continue moving.",
  "On 'encountered', check the enemy behaviour table for who spots whom.",
  "Check the enemy threat table (or established facts) for what you're facing.",
  "Make spotting rolls as needed. An unspotted side may reveal itself, ambush, back out or hide.",
  "If spotted but not surprised, you may attempt to escape with an AGILITY roll.",
  "If the encounter isn't avoided or escaped, draw initiative.",
  "Once resolved, reset the encounter timer.",
  "Check any active crisis timers, modified by movement mode and prolonged actions.",
  "Repeat as you move on or linger.",
];

export const SOLO_POWER_USE = [
  "With a relevant power such as DETECTION, ENHANCED SENSES or TELEPATHY, an encounter check that rolls at least one 6 and no more than one 1 without triggering an encounter lets you choose one option instead of rolling the next check.",
  "Outmaneuver: if the presence is closing or worse, shift it one rank further away as you move to an adjacent zone.",
  "Prepare: if the presence is closing or near, shift straight to encountered and ignore the behaviour table — you automatically spot them and they must roll INTUITION to spot you.",
];

export const SOLO_COMBAT = [
  "Draw initiative as normal for your hero and any NPCs; a single card covers an NPC group.",
  "Roll for NPC actions as a GM would when they act against or aid your hero. Some push rolls and take stress for exploits; many won't.",
  "Choose the most sensible NPC action for the circumstances. If unsure, ask the Binary Engine.",
  "When an NPC does something that doesn't directly affect your hero, just decide whether it works — unless it's dramatic and dangerous.",
  "Most sentient NPCs value self-preservation: when things go badly they defend or flee. Check their willingness with the Binary Engine.",
  "When an NPC is broken you need not roll a critical injury — declare them knocked out or killed as fits the moment.",
];
