# actions

Shared release steps for vladkens' repos, as GitHub Actions used like `vladkens/actions/rust-build@v1`: a Rust repo releases with rust-build and rust-publish, a Python repo with py-build and py-publish. These are composite actions; rust-build, rust-publish and py-publish chain the smaller JavaScript actions here, which also work on their own.

An action's inputs and outputs are in its `action.yml`, its usage in the top `readme.md` or the action's own `readme.md`, the checks in the `Makefile` and `.github/workflows/test.yml`, plans in `docs/plans/`. Docs stay in these places: no progress journals or run logs.

## Boundaries

- Generalize only what the repos share: test jobs, build commands, asset sets, Docker, Homebrew and store uploads stay in each repo.
- Releases start from a squash-merged `release: vX.Y.Z (#N)` commit on `main`, and its tag is always created by these actions in CI; no tag-push trigger.
- Move the `v1` tag only with the person's approval: every repo using `@v1` picks it up at once.
- Changes land on `main` through a PR; never push to `main` directly.
- No runtime dependencies and no build step: each JavaScript action is `runs.using: node24` with `main: index.ts`, run by the runner's Node through type stripping, and talks to GitHub only through `gh` and `git`, preinstalled on the hosted runners.
- A JavaScript action can't call another action: an official one (`actions/attest`, `rust-lang/crates-io-auth-action`) runs as a step of a composite action, or of the calling workflow when it can't run in a composite (`pypa/gh-action-pypi-publish`); never reimplement it.
- Composite actions call this repo's actions as `$/<action>`, so all run at one commit.
- rust-build and py-build run the project's build code and get no secrets or write token; rust-publish and py-publish write, never compile or run a build backend (rust-publish's `pack` only repackages rust-build's files), and trust nothing from the build's artifact but the files' bytes.
- Never publish test packages to crates.io, npm or PyPI; exercise releases only against this repo, crates.io only through `dry-run`, under throwaway tags the test deletes.
- Adopting an action in another repo follows that repo's `agents.md`.

## Conventions

- One directory per action: `action.yml` and a JavaScript action's `index.ts` with its helpers beside it; shared code goes in `lib/`, unit tests in `tests/<action>.test.ts` with fixtures in `tests/fixtures/`.
- An action gets its own `readme.md` (inputs, outputs, required permissions, an example) only when it has more to say than the top readme's table; the top readme documents the rest.
- Imports keep the `.ts` extension: `.js` passes tsc but fails in Node.
- Every action is safe to re-run: it checks what already exists (tag, release, asset, published version) and does only what is missing.
- Untrusted values (commit messages, inputs) reach commands only as arguments or env, never through string interpolation into a shell.
- Fail with one `::error::` line that says what was expected and what was found.
- Agree a plan with the person first. Multi-step work keeps a checklist in `docs/plans/yyyymmdd-<name>.md`, and during the work only its checkboxes are ticked, with no progress prose; when the last item is done, add `Done: yyyy-mm-dd` below the title and a short `## Result`, and move the plan to `docs/plans/completed/`. Never delete plans.
- `make check` and test.yml pass before a merge.
- A commit is one short lowercase line, prefixed with `<action>: ` or its area (`ci: `, `test: `, `readme: `) when it concerns one, with no body and with the docs updated in the same commit.
