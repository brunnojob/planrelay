# Validation record

Date: 2026-11-15.

## Scope

New optional PlanRelay companion, based on upstream commit `47a2f0de686db71686794d3b46dbf7da68e56579`. The inherited Plannotator suite is preserved but has not been built or fully retested for this derivative.

## Checks

- Local Node.js 24: 12 behavior/integration tests covering revision invalidation, blocker lifecycle, stale generation/revision conflicts, input validation, exact feedback, durable storage, writer locks, corrupt state, HTTP origin/host/token protections, oversized requests, real CLI exit codes and tracked Git diff capture.
- Reproducible static demo generation from the same UI/core files.
- GitHub Actions: **all six jobs passed** on Node.js 22/24 across Ubuntu, Windows and macOS. [Run 43696119632](https://github.com/brunnojob/planrelay/actions/runs/43696119632), commit `83cea547401e51d44f54cdc3a7b953b1e9e18a65`.
- The first hosted matrix exposed a Windows writable-handle requirement for fsync and a Node 22 oversized-request transport issue. Both were fixed before the successful run; the oversized-request test also verifies a subsequent valid import succeeds.
- GitHub Pages build/deployment passed. Live browser checks verified blocker resolution, approval, changed-content import resetting the decision, historical versions remaining read-only, adding an anchored suggestion, PT-BR translation, and light/dark theme changes. A real browser capture is embedded in the README.

## Remaining limits

- Companion JSON history is local and editable, not signed evidence.
- `check` validates the latest imported snapshot only. Reimport a changed source first.
- No automatic agent bridge or inherited plugin integration in the companion.
- Historical comments are retained; they are not rebased onto revised content.
- Static demo uses one browser tab and localStorage, not the server's writer lock.
