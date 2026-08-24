// coverage.js — does the app actually implement the source document?
//
// The inverse of tests/reachability.js. Reachability walks code -> user and catches shipped
// surface nobody can reach. This walks source document -> code and catches a documented feature
// that was never built. A reachability suite stays green on an app missing half its rulebook,
// because an unimplemented feature leaves no artefact to detect.
//
// Read docs/coverage.json's `caveats` before believing any number this prints. In short: it
// proves a MAPPING exists, not that the implementation is correct, and its entries are seeded
// from CLAUDE.md rather than read off the book, so it detects regression but not omission.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const COVERAGE = path.join(ROOT, "docs", "coverage.json");

/** A marker is `file#exportedSymbol` or `file::test name substring`. Both must genuinely resolve. */
function markerResolves(marker) {
  if (marker === "-") return { ok: true, why: "no marker required for an omitted entry" };

  if (marker.includes("::")) {
    const [file, name] = marker.split("::");
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) return { ok: false, why: `${file} does not exist` };
    const src = fs.readFileSync(full, "utf8");
    // Match the test's own name as it is registered, not a passing mention in a comment.
    const re = new RegExp(`ok\\(\\s*(["'\`])[^"'\`]*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    return re.test(src) ? { ok: true } : { ok: false, why: `no test named like "${name}" in ${file}` };
  }

  const [file, symbol] = marker.split("#");
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return { ok: false, why: `${file} does not exist` };
  const src = fs.readFileSync(full, "utf8");
  const re = new RegExp(`export\\s+(?:const|let|async\\s+function|function|class)\\s+${symbol}\\b`);
  return re.test(src) ? { ok: true } : { ok: false, why: `${file} exports no ${symbol}` };
}

export function runCoverage(ok, section) {
  section("Source coverage");

  if (!fs.existsSync(COVERAGE)) {
    ok("docs/coverage.json exists", false, "the coverage map is missing entirely");
    return;
  }
  const doc = JSON.parse(fs.readFileSync(COVERAGE, "utf8"));
  const entries = doc.entries || [];

  ok("the coverage map records which edition of the source it was built from",
    !!doc.sourceDocument?.title && !!doc.sourceDocument?.edition,
    JSON.stringify(doc.sourceDocument?.edition || null));

  ok("the coverage map states its own limits",
    Array.isArray(doc.caveats) && doc.caveats.length >= 3,
    `${(doc.caveats || []).length} caveats`);

  // Every entry must be traceable back to the document, or it is decoration.
  const noSource = entries.filter((x) => !x.source || !String(x.source).trim()).map((x) => x.id);
  ok("every entry cites where in the source it comes from", noSource.length === 0, noSource.join(", "));

  const noMarker = entries.filter((x) => !x.marker || !String(x.marker).trim()).map((x) => x.id);
  ok("every entry names a marker", noMarker.length === 0, noMarker.join(", "));

  const ids = entries.map((x) => x.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  ok("entry ids are unique", dupes.length === 0, dupes.join(", "));

  // Anything not plainly implemented owes an explanation.
  const owed = entries.filter((x) => x.status !== "implemented" && !String(x.note || "").trim()).map((x) => x.id);
  ok("every partial, omitted or unknown entry explains itself", owed.length === 0, owed.join(", "));

  const badStatus = entries
    .filter((x) => !["implemented", "partial", "deliberately-omitted", "unknown"].includes(x.status))
    .map((x) => `${x.id}=${x.status}`);
  ok("every status is one of the four defined values", badStatus.length === 0, badStatus.join(", "));

  // The load-bearing check: a feature marked implemented whose implementation has gone.
  const broken = [];
  for (const x of entries) {
    if (x.status !== "implemented" && x.status !== "partial") continue;
    const r = markerResolves(x.marker);
    if (!r.ok) broken.push(`${x.id} (${x.marker}): ${r.why}`);
  }
  ok("every implemented feature's marker still exists in the source",
    broken.length === 0, broken.join(" | "));

  // Omitted entries must NOT carry a live marker — that would mean the omission is a lie.
  const contradictory = entries
    .filter((x) => x.status === "deliberately-omitted" && x.marker !== "-" && markerResolves(x.marker).ok)
    .map((x) => x.id);
  ok("nothing marked deliberately-omitted secretly has an implementation",
    contradictory.length === 0, contradictory.join(", "));

  // Coverage is a re-derived number, never a sentence in prose someone forgot to update.
  const byStatus = entries.reduce((o, x) => { o[x.status] = (o[x.status] || 0) + 1; return o; }, {});
  const byProv = entries.reduce((o, x) => { o[x.provenance || "unset"] = (o[x.provenance || "unset"] || 0) + 1; return o; }, {});
  const counted = Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(" · ");
  console.log(`  → ${entries.length} requirements: ${counted}`);
  console.log(`  → provenance: ${Object.entries(byProv).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  console.log("  → seeded from CLAUDE.md, not the book: regression detection is live, omission detection is not.");

  ok("the map is not empty", entries.length >= 50, `${entries.length} entries`);

  // Guard the honesty of the seeding path itself. If entries start claiming to come from the
  // source, the extracts must be available to have read them.
  const claimSource = entries.filter((x) => x.provenance === "source").length;
  ok("no entry claims to be source-verified while the source is unavailable",
    doc.sourceDocument?.availableToThisRepo === true || claimSource === 0,
    `${claimSource} entries claim provenance "source"`);
}
