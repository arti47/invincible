// main.js — boot.

import { el, $ } from "./core.js";
import { applyTheme, Settings } from "./settings.js";
import { initRouter, route } from "./router.js";
import { renderResourceHeader } from "./sheet.js";
import { showToast } from "./ui.js";
import * as Store from "./store.js";

function boot() {
  applyTheme();
  const screen = $("#screen");
  const nav = $("#bottom-nav");
  const header = $("#resource-header");

  initRouter(screen, nav);
  renderResourceHeader(header);
  Store.onStoreChange(() => renderResourceHeader(header));

  const toggle = $("#theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const order = ["system", "light", "dark"];
      const next = order[(order.indexOf(Settings.theme()) + 1) % order.length];
      Settings.setTheme(next);
      showToast(`Theme: ${next === "system" ? "follow system" : next}`);
    });
  }

  registerServiceWorker();
  window.__invincibleReady = true;
  document.body.dataset.ready = "true";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol === "file:") return;
  navigator.serviceWorker.register("./service-worker.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          showToast("Update available", { timeout: 0, action: { label: "Reload", onClick: () => location.reload() } });
        }
      });
    });
  }).catch(() => { /* offline install is optional */ });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

export { boot, route };
