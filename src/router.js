// router.js — hash routing, bottom nav and conditional tab gating.

import { el, clear, $ } from "./core.js";
import { Settings } from "./settings.js";
import * as Screens from "./screens.js";
import * as Sheet from "./sheet.js";
import * as Combat from "./combat.js";
import * as Solo from "./solo.js";
import * as GM from "./gm.js";
import { startWizard, isActive as wizardActive } from "./wizard.js";

const ROUTES = [
  { path: "home", label: "Home", icon: "◆", render: (m) => Screens.renderHome(m) },
  { path: "sheet", label: "Sheet", icon: "▤", render: (m) => Sheet.renderSheet(m) },
  { path: "combat", label: "Action", icon: "✦", render: (m) => Combat.renderCombat(m) },
  { path: "rules", label: "Rules", icon: "❋", render: (m, arg) => Screens.renderRules(m, arg) },
  { path: "compendium", label: "NPCs", icon: "☰", render: (m) => Screens.renderCompendium(m) },
  { path: "solo", label: "Solo", icon: "◉", render: (m) => Solo.renderSolo(m), gate: () => Settings.soloMode() },
  { path: "gm", label: "GM", icon: "★", render: (m) => GM.renderGM(m), gate: () => Settings.gmScreen() },
  { path: "log", label: "Log", icon: "≡", render: (m) => Screens.renderRollLog(m), nav: false },
  { path: "settings", label: "Settings", icon: "⚙", render: (m) => Screens.renderSettings(m), nav: false },
  { path: "create", label: "Create", icon: "+", render: (m) => startWizard(m), nav: false },
];

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
  try {
    def.render(mount, currentArg());
  } catch (e) {
    console.error(e);
    mount.append(el("div", { class: "empty" }, el("h2", { text: "Something went wrong" }), el("p", { text: String(e.message || e) })));
  }
  const header = $("#resource-header");
  if (header) Sheet.renderResourceHeader(header);
  updateNavState(def.path);
  document.title = `${def.label} · Invincible Player`;
}

function renderNav() {
  if (!navHost) return;
  clear(navHost);
  for (const r of ROUTES) {
    if (r.nav === false) continue;
    if (r.gate && !r.gate()) continue;
    navHost.append(el("a", { class: "nav-item", href: `#/${r.path}`, "data-path": r.path },
      el("span", { class: "nav-icon", "aria-hidden": "true", text: r.icon }),
      el("span", { class: "nav-label", text: r.label })));
  }
  navHost.append(el("a", { class: "nav-item", href: "#/log", "data-path": "log" },
    el("span", { class: "nav-icon", "aria-hidden": "true", text: "≡" }), el("span", { class: "nav-label", text: "Log" })));
  navHost.append(el("a", { class: "nav-item", href: "#/settings", "data-path": "settings" },
    el("span", { class: "nav-icon", "aria-hidden": "true", text: "⚙" }), el("span", { class: "nav-label", text: "Settings" })));
  // Enabling Solo and/or GM pushes the bar to 8-9 tabs; tighten so nothing is clipped at 360px.
  navHost.classList.toggle("compact", navHost.querySelectorAll(".nav-item").length > 6);
}

function updateNavState(path) {
  for (const a of navHost ? navHost.querySelectorAll(".nav-item") : []) {
    if (a.dataset.path === path) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

export { ROUTES };
