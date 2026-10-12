# actions

Shared release steps for vladkens' repos, as GitHub Actions used like
`vladkens/actions/release-check@v1`. Each repo keeps its own jobs (test, build) and its own
`permissions:`, and calls these actions for the steps that are the same everywhere. Agents carry
out each change end to end by following this file; plans live in `docs/plans/`.

Each fact has one source: an action's inputs and outputs are its `action.yml`, its usage its
`readme.md`, checks the `Makefile` and `.github/workflows/test.yml`.

## Scope

- Generalize only what the repos share. Build commands, asset sets, Docker, Homebrew and store
  uploads stay in each repo.
- Releases start from a squash-merged `release: vX.Y.Z (#N)` commit on `main`; the tag is always
  created here, in CI. No tag-push trigger.
- No runtime dependencies and no build step: each action is `runs.using: node24` with
  `main: index.ts`, run by the runner's Node through type stripping. Write erasable TypeScript
  only (no enums, namespaces, parameter properties), import with the `.ts` extension and
  `import type` for types. Shared code goes in `lib/`. Talk to GitHub through `gh` and `git`,
  both preinstalled on the hosted runners.
- A JavaScript action can't call another action: steps that need an official one stay in the
  caller's workflow (`actions/attest`, `rust-lang/crates-io-auth-action`) and pass their outputs
  in. Don't reimplement them.

## Code

- One directory per action: `action.yml`, `index.ts`, `readme.md` (inputs, outputs, required
  permissions, an example).
- Every action is safe to re-run: check what already exists (tag, release, asset, published
  version) and do only what is missing.
- Untrusted values (commit messages, inputs) reach commands only as arguments or env, never
  through string interpolation into a shell.
- Fail with one clear `::error::` line that says what was expected and what was found.
- Keep each action small and readable; no generic framework.

## Testing

- `make check` type-checks and runs the unit tests (`node --test`) on the fixtures in `tests/`.
- `test.yml` runs every action in this repo's CI, with `dry-run` for publishing.
- Never publish test packages to crates.io, npm or PyPI. Exercise releases only against this
  repo, with throwaway tags that the test deletes.

## Workflow

- Agree a plan with the person first. For multi-step work keep a checklist in
  `docs/plans/yyyymmdd-<name>.md` and during the work only tick its checkboxes, with no progress
  prose. When the last item is done, add a first line `Done: yyyy-mm-dd` and a short `## Result`,
  and move the plan to `docs/plans/completed/`. Plans stay; never delete them.
- Commit to `main` every step that passes `make check`: one short lowercase line, no body, docs
  updated in the same commit.
- Move the `v1` tag only with the person's approval: every repo using `@v1` picks it up at once.
- Adopting an action in another repo follows that repo's own `agents.md`.
- Report a blocker as soon as you hit it (a missing permission, a registry limitation, a failing
  service), say what can still be done without it, and keep doing that part.
- Keep docs to `readme.md`, each action's `readme.md` and `docs/plans/`. No progress journals or
  run logs.
