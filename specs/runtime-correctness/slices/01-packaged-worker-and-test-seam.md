# Slice 01 — Packaged Worker and Test Seam

## Contract Unlocked

A browser can import the built root entry, create the shared module worker, and receive timer messages from compiled JavaScript. The test seam must fail if the package again points at raw TypeScript.

## API Seam and Ownership

- Keep `createWorker(): Worker` and the singleton behavior.
- Keep the compiled `src/worker/timer.worker.ts` Rollup entry.
- Change the runtime URL so `dist/vanilla/index.js` resolves the emitted `dist/worker/timer.worker.js`.
- Remove `@web/rollup-plugin-import-meta-assets`; it must not copy the worker source as an asset.
- Do not inline the worker or create a Blob fallback.
- Add Vitest using current `test.projects` configuration:
  - a Node project for deterministic logic;
  - a browser project with a Playwright-backed Chromium instance for real package loading.
- Add the minimum scripts needed to run unit tests and the packed browser smoke test.

The output graph, not the source URL alone, is the acceptance surface.

## Runnable Review Surface

The browser smoke test imports the built root entry over HTTP, calls `createWorker()`, registers a short countdown, and observes a tick followed by one expiration.

The package assertion also proves:

- the worker URL ends in JavaScript;
- the referenced worker file exists;
- no non-declaration `.ts` worker ships under `dist`;
- the root entry does not import React.

## Verification

1. Demonstrate that the current build fails the worker-loading smoke test.
2. Make the same smoke test pass through the built package.
3. Run `pnpm test`, `pnpm tscheck`, `pnpm lint`, and `pnpm build`.
4. Inspect the pack list and reject raw worker source or an unused copied asset.
5. Keep the existing `.` and `./react` export targets resolvable.

## Must Stay Green

- Browser-only runtime errors outside `window`.
- Singleton worker behavior.
- Existing public export names.
- ESM-only package shape.

## Scope Firewalls

- No worker protocol changes in this slice.
- No React hook changes.
- No scheduler or store refactor.
- No bundler matrix; one direct browser package smoke test is sufficient.
- No declaration-pipeline cleanup unless it is required to make the existing export targets resolve.

## Delegated Decisions

- Test directory names.
- Static server helper and temporary package fixture details.
- Exact browser-provider configuration.

The implementer must not choose a different worker delivery architecture without reslicing the plan.

## Feedback That Would Change This Slice

Evidence that supported consumers cannot load the emitted relative module-worker URL would reopen the delivery architecture. A preference for extra bundler fixtures alone would not; add them only after a real compatibility failure.
