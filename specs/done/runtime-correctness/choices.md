# Choices Ledger

## Separate verification by boundary

`pnpm test` runs the fast unit project after building. React lifecycle checks remain in `pnpm test:browser`, while `pnpm test:package` verifies the packed release in Chromium. Keeping these boundaries separate preserves quick feedback without mistaking source-level or bundler-assisted tests for proof of the published worker.

## Ignore TypeScript incremental state

`tsconfig.tsbuildinfo` is generated machine state, so it is ignored rather than versioned. Builds can regenerate it without creating unrelated source-control changes.

## Test the production worker message boundary

Worker tests import the real worker module and replace only browser globals, the clock, and timers. Messages still pass through the production listener and `postMessage`; no test-only runtime factory duplicates worker behavior.

## Connect React in a passive effect

The hook synchronizes with the worker in `useEffect`. Its initial display value is available during render, and no DOM measurement or before-paint correction requires `useLayoutEffect`. Worker construction therefore stays out of render while setup and cleanup remain symmetric.

## Key displayed state by effective configuration

React state records both the displayed value and the duration, group key, and mode that own it. A changed effective configuration receives its normalized initial value immediately, including A → B → A transitions, while count-up duration changes preserve elapsed state because duration is irrelevant in that mode.

## Keep type checking non-emitting

`pnpm tscheck` checks types without producing files. `pnpm build` owns publishable declarations, so verification order cannot create a second declaration tree or change package contents.

## Test the real archive through plain HTTP

The package test creates and extracts the tarball, serves its files without Vite transformations, and loads the root entry and module worker in Chromium. This makes missing files, incorrect emitted paths, and broken worker-relative URLs fail at the boundary consumers receive.
