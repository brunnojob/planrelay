# Contributing to PlanRelay

Thank you for improving developer review workflows. This is an independent derivative of Plannotator; keep upstream attribution and licensing intact.

## Review companion

Use Node.js 22+. No dependencies need installing:

```bash
node tools/planrelay/cli.mjs serve --port 4387
node --test tools/planrelay/test/review.test.mjs
node tools/planrelay/build-demo.mjs
```

Before opening a PR, test the behavior you changed, regenerate the demo, and describe the problem, resulting behavior and checks. Use a temporary `--store` when experimenting. Never commit private review data or secrets. Keep changes to the companion under `tools/planrelay/` and its docs under `docs/planrelay/`. Browser demo output under `docs/planrelay-demo/` is generated; edit the source first.

## Inherited Plannotator code

Read [AGENTS.md](AGENTS.md) and the applicable guide under `docs/agent-guides/`. Preserve both runtime paths where required. The full suite uses Bun and its own sandbox runner. Do not assume passing companion tests validates the inherited suite.

## Useful contributions

- Reproducible bug reports with OS, Node version and minimal redacted input.
- Keyboard and screen-reader accessibility improvements.
- Tests around concurrent editing and revision changes.
- A separately designed, explicitly enabled bridge for inherited agent integrations.

Discuss architectural changes before implementing them. Contribution of original companion code is under MIT; inherited code follows its original dual license. Security issues should be reported privately to the maintainer using the repository's private vulnerability reporting feature when available. Do not include credentials in issues.
