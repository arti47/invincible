// sync.js — Firebase auth, campaigns, join codes and live party/combat sync.
// Runs entirely in local-only mode until real keys are dropped into firebase-config.js.

import { el, uid } from "./core.js";
import { showToast, modal, promptModal, confirmModal } from "./ui.js";
import * as Store from "./store.js";
import { FIREBASE_ENABLED, firebaseConfig } from "../firebase-config.js";

const WORDS_A = ["red", "blue", "black", "golden", "silver", "iron", "storm", "night", "solar", "cosmic"];
const WORDS_B = ["dragon", "titan", "comet", "phoenix", "sentinel", "viper", "falcon", "atlas", "meteor", "warden"];
const WORDS_C = ["sword", "shield", "fist", "beacon", "engine", "crown", "signal", "anchor", "spark", "bastion"];

export function makeJoinCode() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return `${pick(WORDS_A)}-${pick(WORDS_B)}-${pick(WORDS_C)}`;
}

let app = null;
let db = null;
let auth = null;
let user = null;
let listeners = [];

export function isEnabled() { return !!FIREBASE_ENABLED; }
export function currentUser() { return user; }

/** Lazily load the Firebase SDK only when the app is actually configured. */
export async function init() {
  if (!FIREBASE_ENABLED) return { enabled: false };
  if (app) return { enabled: true, user };
  try {
    const [{ initializeApp }, authMod, dbMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js"),
    ]);
    app = initializeApp(firebaseConfig);
    auth = authMod.getAuth(app);
    db = dbMod.getDatabase(app);
    await authMod.signInAnonymously(auth);
    user = auth.currentUser;
    window.__invincibleFirebase = { authMod, dbMod, auth, db };
    return { enabled: true, user };
  } catch (e) {
    console.warn("Firebase unavailable, staying in local mode:", e);
    return { enabled: false, error: e };
  }
}

function mods() { return window.__invincibleFirebase; }

export async function createCampaign(name) {
  const res = await init();
  if (!res.enabled) { showToast("Add Firebase keys to firebase-config.js to sync.", { variant: "warn" }); return null; }
  const { dbMod, db: database } = mods();
  const joinCode = makeJoinCode();
  const campaignId = uid("camp");
  await dbMod.set(dbMod.ref(database, `campaigns/${campaignId}/meta`), {
    name, joinCode, createdAt: Date.now(), ownerUid: user.uid,
  });
  await dbMod.set(dbMod.ref(database, `campaigns/${campaignId}/members/${user.uid}`), {
    displayName: name, characterId: Store.activeCharacterId(), role: "gm",
  });
  Store.saveCampaign({ campaignId, joinCode, name, role: "gm" });
  showToast(`Campaign created. Join code: ${joinCode}`, { variant: "good", timeout: 9000 });
  return { campaignId, joinCode };
}

export async function joinCampaign(joinCode) {
  const res = await init();
  if (!res.enabled) { showToast("Add Firebase keys to firebase-config.js to sync.", { variant: "warn" }); return null; }
  const { dbMod, db: database } = mods();
  const snap = await dbMod.get(dbMod.query(dbMod.ref(database, "campaigns"), dbMod.orderByChild("meta/joinCode"), dbMod.equalTo(joinCode)));
  if (!snap.exists()) { showToast("No campaign with that join code.", { variant: "warn" }); return null; }
  const [campaignId, data] = Object.entries(snap.val())[0];
  const c = Store.activeCharacter();
  await dbMod.set(dbMod.ref(database, `campaigns/${campaignId}/members/${user.uid}`), {
    displayName: c?.identity?.heroName || "Player", characterId: c?.id || null, role: "player",
  });
  Store.saveCampaign({ campaignId, joinCode, name: data.meta.name, role: "player" });
  showToast(`Joined ${data.meta.name}.`, { variant: "good" });
  await publishCharacter();
  return { campaignId };
}

/** Push the active character to the campaign so the party panel and GM screen can see it. */
export async function publishCharacter() {
  const campaign = Store.getCampaign();
  const c = Store.activeCharacter();
  if (!campaign || !c || !FIREBASE_ENABLED) return false;
  const res = await init();
  if (!res.enabled) return false;
  const { dbMod, db: database } = mods();
  await dbMod.set(dbMod.ref(database, `characters/${c.id}`), { ...c, owner: user.uid, campaignId: campaign.campaignId });
  return true;
}

export async function pushRoll(entry) {
  const campaign = Store.getCampaign();
  if (!campaign || !FIREBASE_ENABLED) return false;
  const res = await init();
  if (!res.enabled) return false;
  const { dbMod, db: database } = mods();
  await dbMod.push(dbMod.ref(database, `campaigns/${campaign.campaignId}/rollLog`), entry);
  return true;
}

export function subscribeParty(onUpdate) {
  const campaign = Store.getCampaign();
  if (!campaign || !FIREBASE_ENABLED) return () => {};
  init().then((res) => {
    if (!res.enabled) return;
    const { dbMod, db: database } = mods();
    const r = dbMod.ref(database, `campaigns/${campaign.campaignId}/members`);
    const unsub = dbMod.onValue(r, (snap) => onUpdate(snap.val() || {}));
    listeners.push(unsub);
  });
  return () => { listeners.forEach((u) => u && u()); listeners = []; };
}

export async function linkGoogle() {
  const res = await init();
  if (!res.enabled) { showToast("Firebase is not configured.", { variant: "warn" }); return; }
  const { authMod, auth: a } = mods();
  try {
    const provider = new authMod.GoogleAuthProvider();
    await authMod.linkWithPopup(a.currentUser, provider);
    showToast("Google account linked — your data now syncs across devices.", { variant: "good" });
  } catch (e) {
    showToast(`Could not link: ${e.message}`, { variant: "danger" });
  }
}

/* ---------------------------------------------------------------- settings panel */

export function renderSyncPanel() {
  const campaign = Store.getCampaign();
  const wrap = el("div", { class: "sync-panel" });

  if (!FIREBASE_ENABLED) {
    wrap.append(el("p", { class: "muted small", text: "Local-only mode: everything works on this device with no configuration. To share a party and a combat tracker, add your Firebase keys to firebase-config.js and set FIREBASE_ENABLED to true — see the README." }));
    wrap.append(el("button", { class: "btn ghost", onclick: () => modal({
      title: "Enable multiplayer",
      body: el("div", {},
        el("p", { text: "1. Create a Firebase project and enable Realtime Database, Storage and anonymous authentication." }),
        el("p", { text: "2. Copy the web app config into firebase-config.js and set FIREBASE_ENABLED to true." }),
        el("p", { text: "3. Deploy database.rules.json as your Realtime Database rules." }),
        el("p", { class: "muted small", text: "Never commit real keys to a public repository." })),
      actions: [{ label: "Close", variant: "ghost" }] }) }, "How do I enable it?"));
    return wrap;
  }

  if (campaign) {
    wrap.append(el("p", { class: "stat-line", text: `${campaign.name} — join code ${campaign.joinCode} (${campaign.role})` }));
    wrap.append(el("div", { class: "row-actions" },
      el("button", { class: "btn", onclick: () => publishCharacter().then(() => showToast("Character published to the party.")) }, "Publish my hero"),
      el("button", { class: "btn ghost", onclick: linkGoogle }, "Link a Google account"),
      el("button", { class: "btn danger", onclick: async () => {
        if (await confirmModal("Leave this campaign on this device?", { title: "Leave campaign" })) { Store.clearCampaign(); showToast("Left the campaign."); }
      } }, "Leave campaign")));
  } else {
    wrap.append(el("div", { class: "row-actions" },
      el("button", { class: "btn primary", onclick: async () => {
        const name = await promptModal("Name your campaign.", { title: "New campaign" });
        if (name) createCampaign(name);
      } }, "Create a campaign"),
      el("button", { class: "btn", onclick: async () => {
        const code = await promptModal("Enter the join code (e.g. red-dragon-sword).", { title: "Join a campaign" });
        if (code) joinCampaign(code.trim().toLowerCase());
      } }, "Join with a code")));
  }
  return wrap;
}
