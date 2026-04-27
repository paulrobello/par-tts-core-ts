# Project Rename Design

## Goal
Rename this TypeScript text-to-speech package and GitHub repository from `@parcom/tts` / `paulrobello/par-tts` to `@paulrobello/par-tts-core-ts` / `paulrobello/par-tts-core-ts`, verify the package, and publish it publicly to npm.

## Scope

### In scope
- Update package metadata in `package.json`:
  - `name` to `@paulrobello/par-tts-core-ts`
  - repository, bugs, and homepage URLs to `paulrobello/par-tts-core-ts`
  - keep `publishConfig.access` as `public`
- Update lockfile package identity in `bun.lock`.
- Update all documentation and examples that mention the old package or repository:
  - root `README.md`
  - `docs/**`
  - `examples/**`
  - `.pi/extensions/**`
  - workflow labels and user-facing strings
- Update package import examples from `@parcom/tts` to `@paulrobello/par-tts-core-ts`, including subpath imports such as `/node`, `/playback`, and `/proxy`.
- Update old repository references from `paulrobello/par-tts` to `paulrobello/par-tts-core-ts`.
- Preserve runtime behavior, public exports, version `0.1.0`, license, author, and dependency choices.
- Run verification before external publication:
  - old-name grep inventory
  - `bun run check`
  - `npm pack --dry-run --json`
- Rename the GitHub repository using `gh` when authenticated, then update local `origin` to `git@github.com:paulrobello/par-tts-core-ts.git`.
- Publish publicly to npm as `@paulrobello/par-tts-core-ts` using `npm publish --access public`.

### Out of scope
- Creating a compatibility shim or deprecating `@parcom/tts`.
- Changing the package API, provider implementation, build output shape, or version number unless npm publication requires a version adjustment.
- Rebranding provider behavior beyond package/repository names.

## Approach
Perform a clean, single-step rename. First inventory old references, then make surgical text and metadata edits. Verify the package locally with the repository's canonical check command and an npm dry-run package inspection. Only after local verification succeeds, perform external GitHub and npm operations.

## Risks and mitigations
- **Missed old-name references:** Run targeted grep searches for `@parcom/tts`, `par-tts`, `paulrobello/par-tts`, and `parcom` before and after edits.
- **npm scoped public package gotcha:** Keep `publishConfig.access: public` and publish with `--access public`.
- **Trusted publishing / passkey interaction:** If npm requires an interactive browser/passkey flow, stop and surface the exact command/output needed instead of guessing.
- **GitHub repo rename redirects:** After rename, verify the canonical repo and update local `origin`. The old repo name only redirects while not reused.

## Success criteria
- No intended documentation, example, workflow, or package metadata references remain for `@parcom/tts` or `paulrobello/par-tts`.
- `bun run check` exits successfully.
- `npm pack --dry-run --json` exits successfully and shows the expected package name.
- GitHub origin points at `git@github.com:paulrobello/par-tts-core-ts.git` after repository rename.
- npm package `@paulrobello/par-tts-core-ts` is published or, if interactive auth blocks publication, the next manual command is clearly reported.
