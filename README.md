# bun-overrides-probe

Mend SCA detection probe for the **`overrides`** pattern.

## Pattern

`overrides` — Bun (and npm-compatible) `package.json` field that forces a
transitive dependency to a specific version, overriding whatever the declaring
package originally specified.

## Why standalone

Override application is its own Mend code path, separate from basic lockfile
parsing. Bundling the override pattern with other Tier 1 probes (e.g. basic
registry) would obscure which failure mode triggered:

- "Override silently dropped" (Mend reports wrong version) would be masked if
  the dep is also tested at the correct version elsewhere in the same probe.
- "Override applied to wrong scope" (Mend pins a dep that should be free, or
  vice versa) requires a clean signal with exactly one overridden package.

Keeping this standalone means a single failing assertion in ReportPortal
localizes directly to the override code path.

## Mend config

No `.whitesource` is emitted for this probe.

`js-bun` is **Bucket C** in `whitesource-config.md` — Bun is not in Mend's
`install-tool` supported list. The `scanSettings.versioning` field cannot pin
a Bun toolchain version. Detection is entirely lockfile-driven: Mend must
parse `bun.lock` (text JSONC, Bun 1.2+ format) and apply the `overrides`
block from `package.json` during tree construction.

This limitation shortens reproducibility guarantees. If Mend's lockfile parser
is updated between scan runs, the detected tree may change without any change
to this probe. Document any such drift in the probe's ReportPortal history.

## Override applied

| Package | Natural version (from express@4.21.2) | Overridden version | Expected in Mend output |
|---|---|---|---|
| `qs` | `6.13.0` | `6.5.3` | **`6.5.3`** (overridden) |

The root `package.json` uses the **unscoped** override form:

```json
"overrides": {
  "qs": "6.5.3"
}
```

This applies globally — every edge in the dep graph that resolves `qs` must
use `6.5.3`. In this probe, `qs` is a child of both `express` and
`body-parser` (which is itself a child of `express`). Both edges must resolve
to `6.5.3`.

The scoped override form (`"express > qs": "6.5.3"`) is deliberately deferred
to Tier 3 paired probes #11 (`bun-overrides-1.0-flat-probe`) and #12
(`bun-overrides-1.1-scoped-probe`), which also test the Bun 1.0 vs 1.1
version boundary for override syntax support.

## Failure modes this probe detects

1. **Override ignored entirely** — Mend reports `qs@6.13.0`. The override
   field was not parsed or applied. This is the primary regression target.

2. **Override partially applied** — Mend reports `qs@6.5.3` as a child of
   `express` but `qs@6.13.0` as a child of `body-parser`. The unscoped form
   should apply to all edges; partial application is a sub-scope bug.

3. **Duplicate qs entries** — Mend reports both `qs@6.5.3` and `qs@6.13.0`
   in the tree. Combined override + deduplication failure.

4. **qs missing entirely** — Override caused a parsing error and `qs` was
   dropped from the tree. Silent false negative.

## Resolver knowledge note

Bun is NOT documented in the UA javascript.md resolver file. The UA resolver
handles `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml` — but not
`bun.lock`. The nearest analog is the npm NpmLockCollector path, which does
NOT include any `overrides`-field application logic. This means Mend's ability
to correctly handle Bun overrides is entirely driven by either:

- A dedicated `bun.lock` parser that reads `overrides` from `package.json`
  alongside the lockfile, OR
- The lockfile itself recording the post-override resolved version (which Bun
  does — `bun.lock` records `qs@6.5.3` directly).

If Mend reads `bun.lock` as a pure lockfile (trusting its resolved versions),
it WILL see `qs@6.5.3` and report correctly. If Mend tries to re-derive
versions from `package.json` dependency declarations without honoring
`overrides`, it will report `qs@6.13.0`. Both behaviors are worth observing.
This probe is exploratory for the "does Mend read bun.lock resolved versions
vs re-resolve from manifest?" question.

## Project structure

```
bun-overrides-probe/
├── package.json         direct dep: express@^4.21.2; overrides: qs→6.5.3
├── bun.lock             JSONC lockfile; qs@6.5.3 recorded (override applied)
├── index.ts             minimal express stub
├── expected-tree.json   ground truth: qs@6.5.3, warnings[] document override
└── README.md            this file
```

## Tracked in

`docs/BUN_COVERAGE_PLAN.md` §11.1 entry #3