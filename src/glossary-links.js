// glossary-links.js — glossary words, explained where they are read.
//
// After a screen renders, the first mention of each glossary term inside a panel's prose gets a
// dotted underline; tapping it opens the term's definition (from D.GLOSSARY, unchanged) with a link
// to the full rule. The text itself is never altered — the word is only wrapped. Controls, headings,
// the player's own writing and the glossary itself are left alone.

import { el } from "./core.js";
import { D } from "./rules.js";
import { modal } from "./ui.js";

const SKIP = "a, button, label, input, textarea, select, option, h1, h2, h3, h4, summary, svg, .modal, .gloss-entry, .gloss-term, "
  + ".jr-text, .jr-note, .jr-compose, .log-text, .log-note, .notes, .res-pill, .chip, .tap-hint, .hud, .stat-line, .dice-row, [contenteditable]";
const HOSTS = ".card, .empty, .masthead";
const MAX_LINKS = 40;

let index = null;
function build() {
  const terms = D.GLOSSARY.map((g) => ({ g, name: g.term.replace(/\s*\(.*\)\s*$/, "").trim() }))
    .filter((t) => t.name.length >= 4)
    .sort((a, b) => b.name.length - a.name.length);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  index = {
    byName: new Map(terms.map((t) => [t.name.toLowerCase(), t.g])),
    re: new RegExp(`\\b(${terms.map((t) => esc(t.name)).join("|")})\\b`, "i"),
  };
}

function explain(g) {
  modal({ title: g.term, size: "help-sheet",
    body: el("div", {}, el("p", { text: g.def }),
      el("p", { class: "cite" }, el("a", { class: "rules-link", href: `#/rules/${g.rule}` }, "the full rule →"))),
    actions: [{ label: "Got it", variant: "primary" }] });
}

function termEl(text, g) {
  const span = el("span", { class: "gloss-term", role: "button", tabindex: "0", "aria-haspopup": "dialog", title: `What is “${g.term}”?`, text });
  span.addEventListener("click", (e) => { e.stopPropagation(); explain(g); });
  span.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); explain(g); } });
  return span;
}

/** Wrap the first mention of each glossary term in the screen's panel prose. */
export function linkGlossary(root) {
  if (!root || !D.GLOSSARY?.length) return;
  if (!index) build();
  const used = new Set(Array.from(root.querySelectorAll(".gloss-term")).map((s) => s.textContent.toLowerCase()));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || !n.nodeValue.trim() || p.closest(SKIP) || !p.closest(HOSTS)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  let made = used.size;
  for (const node of nodes) {
    if (made >= MAX_LINKS) break;
    const m = index.re.exec(node.nodeValue);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (used.has(key)) continue;
    const g = index.byName.get(key);
    if (!g) continue;
    used.add(key);
    made++;
    const after = node.splitText(m.index);
    after.nodeValue = after.nodeValue.slice(m[1].length);
    node.parentNode.insertBefore(termEl(m[1], g), after);
  }
}
