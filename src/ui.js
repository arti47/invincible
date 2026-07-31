// ui.js — themed modal / toast / confirm / prompt primitives. No native dialogs anywhere.

import { el, $, clear } from "./core.js";

let openModals = 0;
let lastFocus = null;

function trapFocus(container, e) {
  const focusables = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/**
 * Open a themed modal.
 * @returns {{close:(v?:any)=>void, body:HTMLElement, promise:Promise<any>}}
 */
export function modal({ title, body, actions = [], dismissible = true, size = "" }) {
  lastFocus = document.activeElement;
  const backdrop = el("div", { class: "modal-backdrop" });
  const bodyWrap = el("div", { class: "modal-body" });
  if (typeof body === "string") bodyWrap.innerHTML = body;
  else if (body) bodyWrap.append(body);

  const footer = el("div", { class: "modal-actions" });
  let resolveFn;
  const promise = new Promise((res) => { resolveFn = res; });

  const close = (value) => {
    if (!backdrop.isConnected) return;
    backdrop.remove();
    openModals = Math.max(0, openModals - 1);
    if (!openModals) document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", onKey, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    resolveFn(value);
  };

  const dialog = el("div", { class: `modal ${size}`, role: "dialog", "aria-modal": "true", "aria-label": title || "Dialog" },
    el("div", { class: "modal-head" },
      el("h2", { class: "modal-title", text: title || "" }),
      dismissible ? el("button", { class: "icon-btn", "aria-label": "Close", onclick: () => close(null) }, "✕") : null),
    bodyWrap, footer);

  for (const a of actions) {
    footer.append(el("button", {
      class: `btn ${a.variant || ""}`,
      onclick: () => { const r = a.onClick ? a.onClick(close) : undefined; if (!a.keepOpen) close(r === undefined ? a.value : r); },
    }, a.label));
  }

  function onKey(e) {
    if (e.key === "Escape" && dismissible) { e.stopPropagation(); close(null); }
    else if (e.key === "Tab") trapFocus(dialog, e);
  }

  backdrop.addEventListener("click", (e) => { if (e.target === backdrop && dismissible) close(null); });
  document.addEventListener("keydown", onKey, true);
  backdrop.append(dialog);
  document.body.append(backdrop);
  openModals++;
  document.body.classList.add("modal-open");
  const focusTarget = dialog.querySelector("input, select, textarea, button.btn") || dialog.querySelector("button");
  if (focusTarget) focusTarget.focus();
  return { close, body: bodyWrap, promise, dialog };
}

export function showToast(message, { variant = "", timeout = 3200, action } = {}) {
  let host = $("#toasts");
  if (!host) { host = el("div", { id: "toasts", class: "toasts", "aria-live": "polite" }); document.body.append(host); }
  const t = el("div", { class: `toast ${variant}` }, el("span", { text: message }));
  if (action) t.append(el("button", { class: "toast-action", onclick: () => { action.onClick(); t.remove(); } }, action.label));
  host.append(t);
  if (timeout) setTimeout(() => t.remove(), timeout);
  return t;
}

export async function confirmModal(message, { title = "Are you sure?", confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "primary" } = {}) {
  const m = modal({
    title,
    body: el("p", { text: message }),
    actions: [
      { label: cancelLabel, value: false, variant: "ghost" },
      { label: confirmLabel, value: true, variant },
    ],
  });
  return (await m.promise) === true;
}

export async function promptModal(message, { title = "Enter a value", value = "", placeholder = "", multiline = false } = {}) {
  const input = multiline
    ? el("textarea", { class: "input", rows: 5, placeholder })
    : el("input", { class: "input", type: "text", placeholder });
  input.value = value;
  const m = modal({
    title,
    body: el("div", {}, el("p", { text: message }), input),
    actions: [
      { label: "Cancel", value: null, variant: "ghost" },
      { label: "OK", variant: "primary", onClick: () => input.value },
    ],
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !multiline) { e.preventDefault(); m.close(input.value); } });
  return m.promise;
}

/** A list-of-choices modal. options: [{label, value, hint}] */
export async function chooseModal(title, options, { allowCancel = true } = {}) {
  const list = el("div", { class: "choice-list" });
  const m = modal({ title, body: list, actions: allowCancel ? [{ label: "Cancel", value: null, variant: "ghost" }] : [] });
  options.forEach((o) => {
    list.append(el("button", { class: "choice", onclick: () => m.close(o.value) },
      el("span", { class: "choice-label", text: o.label }),
      o.hint ? el("span", { class: "choice-hint", text: o.hint }) : null));
  });
  return m.promise;
}

/**
 * Collapsed-by-default explainer for a panel: what it is for and how to drive it.
 * Every major panel carries one so nothing on screen is unexplained.
 */
export function helpPanel(body, { title = "What is this panel for?" } = {}) {
  const lines = Array.isArray(body) ? body : [body];
  return el("details", { class: "help" },
    el("summary", { text: title }),
    ...lines.map((t) => el("p", { class: "small", text: t })));
}

/** Announce to screen readers without opening anything. */
export function announce(text) {
  let live = $("#live-region");
  if (!live) { live = el("div", { id: "live-region", class: "sr-only", "aria-live": "polite", role: "status" }); document.body.append(live); }
  clear(live);
  live.append(el("span", { text }));
}
