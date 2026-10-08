# Slice 03 — Verification and Release

## Contract Unlocked

One command proves the runtime, browser integration, packed package, and declarations, while the standalone type-check command creates no files.

## API Seam and Ownership

`package.json` remains the sole owner of repository commands.

Change `tscheck` to:

```text
tsc --noEmit --emitDeclarationOnly false --incremental false
```

Add `verify` with this existing-script sequence:

```text
pnpm lint && pnpm tscheck && pnpm test && pnpm test:browser && pnpm test:package && pnpm test:types
```

Do not disable incremental compilation in `tsconfig.json`; declaration builds may continue using it. Do not replace the existing test-project boundaries or add a wrapper script.

Update `README.md` only where the runtime contract changed: once a route message is processed, later registrations for other route keys are silently discarded. Keep route cleanup optional and application-controlled.

## Test and Release Oracle

### Sterile type check

From a state without generated files:

1. Confirm `tsconfig.tsbuildinfo` is absent.
2. Record source-adjacent `.js` and `.js.map` files.
3. Run `pnpm tscheck`.
4. Confirm `tsconfig.tsbuildinfo` remains absent.
5. Confirm no JavaScript, source map, declaration, declaration map, or other file was created.

The command is required to avoid creating files; it is not required to remove artifacts that existed before it ran.

### Complete verification

Run:

```text
pnpm verify
```

Confirm:

- lint passes without warnings;
- source type checking passes without output;
- unit and browser projects pass;
- the packed tarball loads its compiled Worker in Chromium;
- test sources and README usage compile against built declarations;
- no raw TypeScript enters `dist`;
- both public entries and their declaration paths remain valid.

### Compatibility audit

Compare the final change against the pre-slice public surface:

- package exports remain `.` and `./react`;
- root and React export names remain unchanged;
- `useTimer(durationSeconds, routeKey?, mode?)` and its numeric return remain unchanged;
- incoming and outgoing Worker unions remain unchanged;
- React stays an optional peer and the package stays ESM-only.

## Human Review Surface

The review artifact is the successful `pnpm verify` transcript plus a clean generated-file check after `pnpm tscheck`. No visual checkpoint applies.

## Must Stay Green

- `tests/unit/package-output.test.ts`
- `tests/unit/readme-examples.test.ts`
- `tests/package/packed-worker.test.ts`
- `tests/types/readme-usage.ts`
- Existing package `main`, `types`, and `exports` paths

## Scope Firewalls

- Do not combine or rewrite the existing test suites.
- Do not optimize repeated builds inside `verify`; command-graph performance is separate work.
- Do not change declaration ownership, Rollup output layout, package exports, dependencies, or peer requirements.
- Do not add CI configuration unless separately requested.
- Do not modify unrelated generated files or the deleted archived runtime-correctness spec.

## Delegated Decisions

The exact wording of the README clarification is delegated. Script order, zero-file semantics, included suites, and compatibility checks are fixed.

## Feedback That Would Change This Slice

Only an environment that cannot run the existing Chromium package test would change the all-in-one gate. In that case, record the concrete environment failure and reslice rather than silently dropping the package boundary.
