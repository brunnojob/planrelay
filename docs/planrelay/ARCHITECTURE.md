# PlanRelay review companion

The companion under `tools/planrelay` is a separate optional review surface. It does not change the inherited Plannotator Inbox, hook protocols, linked machines, renderers or agent adapters. Both products remain available in this repository. There is no automatic bridge between their stores or decisions.

## Data flow

1. A CLI import reads a UTF-8 file, stdin, or a tracked Git diff; the browser can also paste or load a file.
2. The portable state machine creates an immutable content snapshot with a SHA-256 digest.
3. Comments refer to a 1-based line in that snapshot. Diff anchors refer to **patch text lines**, not file-side GitHub review coordinates.
4. Adding or resolving feedback resets the current decision to pending. Open blockers prevent approval.
5. Re-importing different content under the same review ID appends a version, with its own comments and pending decision. Old comments remain attached to their original version; they are not automatically rebased.
6. Export produces structured feedback for the displayed revision. CLI `check` evaluates the latest **imported** revision; it does not watch files or enforce a remote branch policy.

## Modules

| File | Responsibility |
| --- | --- |
| `core.mjs` | Pure state transitions, validation, summaries and exports; reused in the browser demo |
| `store.mjs` | SHA-256, exclusive writer lock, atomic JSON replacement and schema check |
| `server.mjs` | Loopback HTTP, same-origin checks, token-protected writes, fixed static asset routes |
| `cli.mjs` | Import, read-only Git diff capture, serve, list, export, check |
| `public/` | Dependency-free UI; document text always rendered with `textContent` |
| `build-demo.mjs` | Reproducible static browser demo from the same UI and state machine |

## Storage and concurrency

Default: `.planrelay/state.json` relative to the process working directory. Every command supports `--store PATH`. Use the same path when the CLI and server run from different directories. Atomic replacement prevents partial JSON writes; exclusive `.lock` creation prevents overlapping writers; generation checks reject stale browser actions. No distributed or network filesystem guarantee is provided. A stale lock after a crash needs removal only after all writers have stopped. Back up the file before manual recovery. The JSON timeline is locally editable, **not** tamper-evident or a compliance record. Directory entry fsync and power-loss recovery are not guaranteed.

The static demo uses localStorage instead of files. Different browser tabs are independent views, with no multi-tab conflict control; use a single tab. Clearing browser data removes demo reviews. Exports contain feedback, not full workspace backups. The local state file is the full backup.

## Network and trust boundaries

The companion binds only to `127.0.0.1`; requests with unexpected Host or Origin are rejected. Every write requires a random per-process session token. Documents, patches and HTML are displayed as text; scripts and remote embeds are never executed. Content Security Policy disallows external assets and frames. There are no telemetry calls, external fonts, model APIs or automatic browser launches in the companion. Other applications on the same machine are outside this trust boundary. Do not expose it through a public reverse proxy without a separately designed authentication layer.

The imported Plannotator project has its own network, AI, telemetry and sharing features; the companion's guarantees do not describe those inherited components. See the upstream documentation for their settings.

## Limits

- Node.js 22+ for the companion, no package installation; the inherited suite requires Bun and its dependencies.
- HTTP bodies: 1.2 MB; document content: at most 1,000,000 characters; browser file picker: 1 MB. Multi-byte text can hit the HTTP byte limit first.
- UI renders the first 10,000 lines; the numeric anchor field supports later lines.
- Plan view is line-oriented Markdown source; HTML view shows source. Rich HTML annotation and rendered Markdown remain available through the inherited Plannotator tools.
- Version comparison shows full previous content above current content. It is not a semantic diff or line relocation engine.
- `diff` captures tracked working tree/index changes against a ref. It excludes untracked files and does not fetch remote PRs.
- JSON storage loads the workspace into memory; archive old workspaces externally for large histories. There is no multi-user collaboration or automatic agent delivery in the companion.
