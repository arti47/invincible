# Coverage map — how to read and extend it

`docs/coverage.json` maps the source rulebook onto this codebase. `tests/coverage.js` turns that
map into a failing build when the mapping breaks.

## What it does and does not prove

It proves **a named code artefact exists** for each listed requirement. That is all.

It does **not** prove the implementation is correct. A constant can exist holding wrong numbers;
a function can exist computing the wrong thing. Where correctness matters, the entry's marker
points at a *behavioural test* in `tests/run.js` rather than at the implementation — that is what
every `A-*` entry does, one per closed rules-audit finding in CLAUDE.md §10.

## The honesty problem, stated plainly

The eight markdown chapter extracts were supplied in conversation and are **not in this
repository** — they are the user's own book (§11). Entries were **seeded from CLAUDE.md's
extraction ledger and System Profile**, written while the extracts were in hand, and the project
owner has **attested that the extraction (`data*.js`, `src/`) is reliable**.

### Correctness and completeness are different properties

The attestation covers the first, not the second, and only the second closes the gap:

| property | meaning | attested? |
|---|---|---|
| **Correctness** | the extracted numbers and rules are right | ✅ by the owner |
| **Completeness** | no rule in the book went unextracted | ❌ unknowable from here |

An unextracted rule leaves **no artefact anywhere in this repository** — not in `data.js`, not in
`src/`, not in the ledger. So no degree of confidence in the code can reveal one. That is why
trusting the implementation does not substitute for reading the book.

| | detected today | needs the extracts |
|---|---|---|
| **Regression** — an implemented feature losing its implementation | ✅ | |
| **Drift** — a stated count disagreeing with the data | ✅ | |
| **Omission** — a rule in the book nobody ever noticed | | ❌ |

### Why the list is not built from `data.js`

`data.js` looks like source material: 289 KB of paraphrased rulebook content with `// Ch.N`
citations throughout. Building the checklist from it would be the circularity trap — a list
derived from the implementation maps perfectly onto the implementation and passes forever while
proving nothing. **`data.js` cannot testify that `data.js` is complete.**

### The three provenance levels

| level | means | supports omission detection? |
|---|---|---|
| `project-ledger` | seeded from CLAUDE.md alone | no |
| `owner-attested` | the owner, who holds the book, vouches for correctness | no |
| `source` | someone read the cited chapter against this entry | **yes** |

The spec **fails** if an entry claims `source` while `sourceDocument.availableToThisRepo` is
false, so the top level cannot be claimed by assertion.

## Promoting an entry to source-verified

1. Get the chapter extract in hand.
2. Read the cited section. Confirm the requirement exists and that `summary` states it in the
   *document's* terms, not the code's.
3. Add or correct entries for anything in that section the ledger missed — this is the step that
   actually buys omission detection.
4. Set `provenance: "source"` on what you verified. Owner attestation is not a substitute for
   this step — it speaks to correctness, and this step is about completeness.
5. When every entry for a chapter is promoted, that chapter is genuinely covered.
6. Set `sourceDocument.availableToThisRepo: true` only while the extracts are actually present.

**Never** promote an entry without doing step 2. That is how the circularity trap re-enters.

## Fields

| field | rule |
|---|---|
| `id` | Stable slug. Never renumbered — `T-*` mirrors the extraction ledger, `B-*` is behaviour, `A-*` is a closed audit finding, `X-*` is a recorded exclusion. |
| `source` | Chapter or section, so a reader can go check. Required. |
| `summary` | One line in the document's terms. |
| `marker` | `file#exportedSymbol` or `file::test name`. Required (`-` only for omissions). |
| `status` | `implemented` · `partial` · `deliberately-omitted` · `unknown` |
| `note` | Required for anything not `implemented`. |
| `provenance` | `project-ledger` · `owner-attested` · `source`. See the table above. |
| `count` | Optional. Expected number of rows; checked against the live module, so CLAUDE.md's figures and the data cannot drift apart. |

## Choosing a marker

The most specific artefact that would **genuinely disappear** if the feature were removed.

- Too coarse (a whole file, a broad module) → always present, never fails, useless.
- Too brittle (a line number, a string of prose) → fails on unrelated edits, gets muted, ignored.
- Right: the named export or test that *is* the feature. If deleting the feature would leave the
  marker behind, pick a different marker.

## `partial` is not a parking space

`partial` means implemented in part, with a note saying **what is missing**. Work you have not
checked is `unknown`, not `partial`.

## Still unknown

- **Starter-set pregens (Metro Mayhem)** — never supplied; contents unknown (`X-pregens-metro`).
- **Every chapter, for omission purposes** — no entry is source-verified yet. The ledger's view of
  the book is the denominator, so the counts printed by `npm test` mean "everything we wrote down
  is implemented", which is a weaker claim than it looks.

All 22 counts stated in CLAUDE.md were checked against the live data when the `count` field was
introduced, and all 22 agreed. That establishes the ledger and the data are consistent with each
other — it says nothing about either against the book.

## Related

`tests/reachability.js` is the inverse spec: it walks code → user and catches shipped surface
nobody can reach. Coverage alone passes on an app whose features are all unreachable; reachability
alone passes on an app missing half the rulebook. Run both.
