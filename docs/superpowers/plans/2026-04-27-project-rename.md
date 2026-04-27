# Project Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the project, package, repository metadata, docs, and publish target from `@parcom/tts` / `paulrobello/par-tts` to `@paulrobello/par-tts-core-ts` / `paulrobello/par-tts-core-ts`.

**Architecture:** This is a metadata/documentation rename only. Runtime API and build output structure remain unchanged except user-facing strings that reference package names.

**Tech Stack:** Bun, TypeScript, tsup, Vitest, npm, GitHub CLI.

---

### Task 1: Rename package metadata and docs

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `README.md`
- Modify: `.github/workflows/publish.yml`
- Modify: `examples/pi-extension/package.json`
- Modify: `examples/pi-extension/README.md`
- Modify: `examples/pi-extension/index.ts`
- Modify: `.pi/extensions/tts/package.json`
- Modify: `src/core/provider-factory.ts`
- Inspect/update: `docs/**` if present

- [ ] **Step 1: Replace package name and repository metadata**

Set `package.json` fields:
```json
{
  "name": "@paulrobello/par-tts-core-ts",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/paulrobello/par-tts-core-ts.git"
  },
  "bugs": {
    "url": "https://github.com/paulrobello/par-tts-core-ts/issues"
  },
  "homepage": "https://github.com/paulrobello/par-tts-core-ts#readme",
  "publishConfig": {
    "access": "public"
  }
}
```

- [ ] **Step 2: Replace package import/documentation references**

Replace all `@parcom/tts` references in README, examples, extension package files, workflow labels, and user-facing strings with `@paulrobello/par-tts-core-ts`, preserving subpaths:
```text
@parcom/tts/node     -> @paulrobello/par-tts-core-ts/node
@parcom/tts/playback -> @paulrobello/par-tts-core-ts/playback
@parcom/tts/proxy    -> @paulrobello/par-tts-core-ts/proxy
```

- [ ] **Step 3: Replace repository name references**

Replace `paulrobello/par-tts` and `par-tts.git` repository metadata references with `paulrobello/par-tts-core-ts` and `par-tts-core-ts.git`.

- [ ] **Step 4: Regenerate/update lockfile identity**

Run:
```bash
bun install --lockfile-only
```
Expected: `bun.lock` root package name is `@paulrobello/par-tts-core-ts`.

- [ ] **Step 5: Verify old-name inventory**

Run:
```bash
rg -n '@parcom/tts|paulrobello/par-tts|git@github.com:paulrobello/par-tts|git\+https://github.com/paulrobello/par-tts|Publish @parcom/tts' --glob '!node_modules/**' --glob '!dist/**'
```
Expected: no matches except historical committed design/plan files if present.

### Task 2: Verify package locally

**Files:**
- Inspect generated `dist/**` via build command only

- [ ] **Step 1: Run full project check**

Run:
```bash
bun run check
```
Expected: typecheck, tests, build, browser check, and CJS check all exit 0.

- [ ] **Step 2: Run npm dry-run packaging check**

Run:
```bash
npm pack --dry-run --json
```
Expected: JSON output contains `"name": "@paulrobello/par-tts-core-ts"` and expected files only.

### Task 3: Rename GitHub repo and publish npm package

**External systems:**
- GitHub repository
- npm registry

- [ ] **Step 1: Rename GitHub repository if still old**

Run:
```bash
gh repo view paulrobello/par-tts-core-ts --json nameWithOwner || gh repo rename par-tts-core-ts --repo paulrobello/par-tts --yes
```
Expected: `paulrobello/par-tts-core-ts` exists.

- [ ] **Step 2: Update local origin**

Run:
```bash
git remote set-url origin git@github.com:paulrobello/par-tts-core-ts.git
git remote -v
```
Expected: fetch and push origin both point at `git@github.com:paulrobello/par-tts-core-ts.git`.

- [ ] **Step 3: Push commits to renamed repo**

Run:
```bash
git push origin main
```
Expected: push succeeds.

- [ ] **Step 4: Publish public scoped package**

Run:
```bash
npm publish --access public
```
Expected: npm publishes `@paulrobello/par-tts-core-ts@0.1.0`, or npm requests interactive authentication/passkey action.

- [ ] **Step 5: Verify publication**

Run:
```bash
npm view @paulrobello/par-tts-core-ts name version repository.url --json
```
Expected: package name, version `0.1.0`, and repository URL match the renamed project.
