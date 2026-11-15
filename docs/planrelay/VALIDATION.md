# Validation record

Date: 2026-11-15.

## Scope

New optional PlanRelay companion, based on upstream commit `47a2f0de686db71686794d3b46dbf7da68e56579`. The inherited Plannotator suite is preserved but has not been built or fully retested for this derivative.

## Checks

- Local Node.js 24: 12 behavior/integration tests covering revision invalidation, blocker lifecycle, stale generation/revision conflicts, input validation, exact feedback, durable storage, writer locks, corrupt state, HTTP origin/host/token protections, oversized requests, real CLI exit codes and tracked Git diff capture.
- Reproducible static demo generation from the same UI/core files.
- GitHub Actions configuration: Node.js 22/24 on Ubuntu, Windows and macOS. A configured matrix is not a claim that every hosted run has passed; inspect the workflow result for its current status.

## Remaining limits

- Companion JSON history is local and editable, not signed evidence.
- `check` validates the latest imported snapshot only. Reimport a changed source first.
- No automatic agent bridge or inherited plugin integration in the companion.
- Historical comments are retained; they are not rebased onto revised content.
- Static demo uses one browser tab and localStorage, not the server's writer lock.
