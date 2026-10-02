// router.js — hash routing, bottom nav and conditional tab gating.

import { el, clear, $ } from "./core.js";
import { Settings } from "./settings.js";
import * as Screens from "./screens.js";
import * as Sheet from "./sheet.js";
import * as Combat from "./combat.js";
import * as Solo from "./solo.js";
import * as GM from "./gm.js";
import { startWizard, isActive as wizardActive } from "./wizard.js";
import * as Learn from "./learn.js";
import * as Store from "./store.js";
import { icon } from "./icons.js";

// `nav` is where a route lives: "tab" in the bottom bar, "more" on the More screen, false only by
// link. The bar holds five tabs; Play is Solo or Action depending on the mode being played.
const ROUTES = [
  { path: "home", label: "Home", icon: "home", nav: "tab", render: (m) => Screens.renderHome(m) },
  { path: "sheet", label: "Hero", icon: "hero", nav: "tab", render: (m) => Sheet.renderSheet(m) },
  { path: "combat", label: "Action", icon: "combat", nav: "more", desc: "Initiative, combatants and challenges", render: (m) => Combat.renderCombat(m) },
  { path: "rules", label: "Rules", icon: "rules", nav: "more", desc: "Glossary and the full rules library", render: (m, arg) => Screens.renderRules(m, arg) },
  { path: "compendium", label: "NPCs", icon: "npcs", nav: "more", desc: "Profiles, creatures, adversaries, heroes", render: (m) => Screens.renderCompendium(m) },
  { path: "solo", label: "Solo", icon: "solo", nav: "more", desc: "Crisis Mode: your GM when there is none", render: (m) => Solo.renderSolo(m), gate: () => Settings.soloMode() },
  { path: "gm", label: "GM", icon: "gm", nav: "more", desc: "Party panel and every rollable table", render: (m) => GM.renderGM(m), gate: () => Settings.gmScreen() },
  { path: "learn", label: "Learn", icon: "learn", nav: "more", desc: "Tutorials and a worked solo session", render: (m) => Learn.renderLearn(m) },
  { path: "journal", label: "Journal", icon: "journal", nav: "tab", render: (m, arg) => Screens.renderJournal(m, arg) },
  { path: "log", label: "Log", icon: "journal", nav: false, render: (m) => Screens.renderJournal(m, "dice") },
  { path: "settings", label: "Settings", icon: "settings", nav: "more", desc: "Theme, features, backup, multiplayer", render: (m) => Screens.renderSettings(m) },
  { path: "create", label: "Create", icon: "create", nav: "more", desc: "Build a new hero", render: (m) => startWizard(m) },
  { path: "more", label: "More", icon: "more", nav: "tab", render: (m) => renderMore(m) },
];

/** Play is the one surface a session is played on: Crisis Mode when solo, the action scene otherwise. */
const playPath = () => (Settings.soloMode() ? "solo" : "combat");

let mount = null;
let navHost = null;

export function initRouter(screenMount, navMount) {
  mount = screenMount;
  navHost = navMount;
  window.addEventListener("hashchange", route);
  document.addEventListener("store-changed", () => { if (currentPath() !== "create") route(); });
  document.addEventListener("nav-refresh", () => { renderNav(); route(); });
  renderNav();
  route();
}

function currentPath() {
  const raw = location.hash.replace(/^#\/?/, "");
  return raw.split("/")[0] || "home";
}
function currentArg() {
  const raw = location.hash.replace(/^#\/?/, "");
  return raw.split("/")[1] || null;
}

export function route() {
  if (!mount) return;
  const path = currentPath();
  const def = ROUTES.find((r) => r.path === path) || ROUTES[0];
  if (def.gate && !def.gate()) { location.hash = "#/home"; return; }
  clear(mount);
  mount.scrollTop = 0;
  // Wide screens lay these out in columns; reading screens stay one measure wide.
  mount.classList.toggle("cols", ["home", "sheet", "solo", "gm", "more"].includes(def.path));
  try {
    def.render(mount, currentArg());
  } catch (e) {
    console.error(e);
    mount.append(el("div", { class: "empty" }, el("h2", { text: "Something went wrong" }), el("p", { text: String(e.message || e) })));
  }
  const header = $("#resource-header");
  if (header) Sheet.renderResourceHeader(header);
  document.body.dataset.route = def.path;
  updateNavState(def.path);
  updateFab();
  document.title = `${def.label} · Invincible Player`;
}

function navLink(r, cls = "nav-item", label = r.label) {
  return el("a", { class: cls, href: `#/${r.path}`, "data-path": r.path },
    el("span", { class: "nav-icon" }, icon(r.icon, { size: 22 })),
    el("span", { class: "nav-label", text: label }));
}

function renderNav() {
  if (!navHost) return;
  clear(navHost);
  const by = (p) => ROUTES.find((r) => r.path === p);
  const play = by(playPath());
  navHost.append(
    navLink(by("home")), navLink(by("sheet")),
    el("span", { class: "nav-gap", "aria-hidden": "true" }),
    el("a", { class: "nav-item", href: `#/${play.path}`, "data-path": play.path, "data-tab": "play" },
      el("span", { class: "nav-icon" }, icon("play", { size: 22 })), el("span", { class: "nav-label", text: "Play" })),
    navLink(by("journal")), navLink(by("more")));
  ensureFab();
}

/** The More screen: every route that is not one of the five tabs, gated ones included when on. */
function renderMore(mount) {
  const current = playPath();
  const tiles = ROUTES.filter((r) => r.nav === "more" && (!r.gate || r.gate()) && r.path !== current);
  mount.append(el("section", { class: "masthead span" },
    el("h1", { text: "More" }),
    el("p", { class: "muted", text: "Every other part of the app." })));
  mount.append(el("nav", { class: "more-grid span", "aria-label": "More" },
    ...tiles.map((r) => el("a", { class: "more-tile", href: `#/${r.path}`, "data-path": r.path },
      el("span", { class: "nav-icon" }, icon(r.icon, { size: 22 })),
      el("strong", { text: r.label }),
      el("span", { class: "small", text: r.desc || "" })))));
}

/* The floating Roll button: "which one do I roll?", from anywhere a hero exists. */
let fab = null;
function ensureFab() {
  if (fab && fab.isConnected) return;
  fab = el("button", { class: "fab", type: "button", "aria-label": "Roll — which attribute do I roll?", title: "Roll",
    onclick: () => Sheet.openAttributeGuide() }, icon("die", { size: 32 }));
  document.body.append(fab);
  updateFab();
}
function updateFab() {
  if (!fab) return;
  const path = document.body.dataset.route;
  fab.hidden = !Store.activeCharacter() || path === "create";
}

function updateNavState(path) {
  const moreSet = ROUTES.filter((r) => r.nav === "more").map((r) => r.path);
  for (const a of navHost ? navHost.querySelectorAll(".nav-item") : []) {
    const on = a.dataset.path === path || (a.dataset.path === "more" && moreSet.includes(path) && path !== playPath())
      || (a.dataset.path === "journal" && path === "log");
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

export { ROUTES };
