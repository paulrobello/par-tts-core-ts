# Contributing

Thanks for contributing to `@paulrobello/par-tts-core-ts`.

## Prerequisites

- Bun
- Node.js and npm
- `pre-commit`

This project uses Bun for dependency management and task running, ESLint for linting, Vitest for tests, and pre-commit with gitleaks for secret scanning.

## Setup

```bash
bun install
make pre-commit-install
```

You can also install the pre-commit hook through npm scripts:

```bash
bun run precommit:install
```

## Development commands

Prefer Makefile targets for local development and CI parity:

```bash
make lint          # ESLint
make typecheck     # TypeScript typecheck
make test          # Vitest
make build         # tsup build
make check         # lint, typecheck, tests, build, browser/CJS checks
make checkall      # make check plus npm pack dry-run
```

Equivalent Bun scripts are available in `package.json`.

## Required verification

Before opening a PR or pushing release changes, run:

```bash
make checkall
```

`make checkall` is also required by the publish workflow before npm publication.

For pre-commit checks across the full repo, run:

```bash
make pre-commit-run
```

## Testing expectations

- Add or update tests for behavior changes.
- Keep changes focused and avoid unrelated refactors.
- For provider behavior, prefer tests that assert the public pipeline/provider behavior rather than implementation details.
- For bug fixes, add a regression test when practical.

## Secrets

Do not commit API keys, tokens, credentials, or generated local config containing secrets.

The pre-commit hook runs gitleaks. If gitleaks flags a secret, remove the secret from the commit and rotate it if it was real.

## Release and publish flow

1. Update code and tests.
2. Bump `package.json` version when publishing a new package version.
3. Run:

   ```bash
   make checkall
   ```

4. Commit and push to `main`.
5. Run the manual GitHub Actions workflow: **Publish to npm**.

The publish workflow uses npm Trusted Publishing via GitHub OIDC. It does not require an `NPM_TOKEN` secret. The workflow checks whether the current `package.json` version already exists on npm and skips publishing if it is already published.

## Package notes

- The root export is browser-safe.
- Node-only helpers are exported from `/node` and `/playback`.
- Browser proxy helpers are exported from `/proxy`.
- Kokoro support is Node-only and uses the optional `kokoro-js` dependency.
