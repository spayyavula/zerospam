# Fabro integration

This directory wires the repo into [Fabro](https://github.com/fabro-sh/fabro) — the
open-source workflow engine that runs AI coding agents through reviewable,
version-controlled graphs with verification gates.

## Layout

| Path | Purpose |
| --- | --- |
| `project.toml` | Default sandbox environment (Daytona), resources, PR settings, repo label. |
| `Dockerfile` | Sandbox image: Node 22, Flutter stable (+ Dart), JDK 17, `gh`, ripgrep. |
| `workflows/mobile-slice/` | Implement a plan for the mobile slice, then gate on the full verify suite. |
| `workflows/gh-implement-mobile/` | Read a GitHub issue → write `plan.md` → run `mobile-slice` as a sub-workflow → open a PR. |

## Workflows

### `mobile-slice`
`Start → Toolchain → Install deps → Preflight build → Implement → Simplify → Verify → Exit`,
with a `Fixup` loop off the verify gate (`max_visits=3`).

The **Verify** node is a `goal_gate` — the run fails unless this passes:

```
npm run build --workspace=server
npm test --workspace=server
cd apps/zerospam_flutter
flutter pub get
(cd lib/data/generated && dart pub get && dart run build_runner build --delete-conflicting-outputs)
flutter analyze
flutter test
```

### `gh-implement-mobile`
The GitHub entry point. Point it at an issue number/URL; it plans the change
(backend, Flutter, or both), then composes `mobile-slice` to implement and verify.
`workflow.toml` requests `issues: read` + `pull_requests: write`.

## Setup (one-time, interactive — not committed)

These steps run on your machine / Fabro server and are intentionally **not** part of
the repo:

1. Install Fabro and start the server (opens a browser wizard):
   ```bash
   brew install fabro-sh/tap/fabro-nightly   # or: curl -fsSL https://fabro.sh/install.sh | bash
   fabro server start
   ```
2. In the wizard, connect the **GitHub integration** and authorize this repo
   (`spayyavula/zerospam`) so the `gh-*` workflows can read issues and open PRs.
3. Configure a **Daytona** provider (the sandbox `provider` in `project.toml`) and
   set the model API keys referenced by the `model_stylesheet` (`claude-opus-4-7`;
   change it to whatever your Fabro instance has configured).

## Run

```bash
# Implement a GitHub issue end-to-end and open a PR:
fabro run .fabro/workflows/gh-implement-mobile/workflow.fabro --goal 123

# Or implement an existing plan file directly:
fabro run .fabro/workflows/mobile-slice/workflow.fabro --goal docs/plans/<plan>.md
```

> Models in each `workflow.fabro` `model_stylesheet` are placeholders matching
> Fabro's own examples. Edit them (one CSS-like line) to route nodes to whatever
> providers/models your Fabro instance has — e.g. a cheap model for `Fixup`, a
> frontier model for `Implement`.
