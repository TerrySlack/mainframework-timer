# Runtime Correctness

**Shipped:** 2026-10-08

## Purpose

`@mainframework/timer` is a browser-only timer package whose plain JavaScript and optional React entries share one Web Worker. This work makes the package archive—not the source tree or a bundler-assisted development graph—the release boundary that proves the published worker can load and run.

The public contract is framework- and router-neutral. `routeKey` is an opaque grouping string, pathname is only a convenience default, and `setActiveRoute()` is optional application-controlled cleanup despite its historical name.

## Why This Shape

### The worker is a compiled package asset

The worker must remain executable after publication without asking a consumer's bundler to compile package source. `src/worker/createWorker.ts` therefore resolves the JavaScript worker emitted by `rollup.config.mjs`. The package test archives, extracts, serves, and executes that exact output in Chromium.

Copying `timer.worker.ts` as an import-meta asset was rejected because the resulting archive contained browser-invalid TypeScript beside an unused compiled worker.

### Duration has one owner

Countdown state used to disagree between React and the worker because each normalized input differently. `normalizeDurationSeconds` in `src/utils/duration.ts` is now the single policy consumed by both. Public registration types distinguish countdown from count-up so only countdown accepts a duration.

Invalid countdown values normalize to zero rather than adding a second error protocol. Count-up treats duration as irrelevant, including later duration changes.

### React lifecycle owns registration symmetrically

Each committed React effect setup registers one live timer, and that setup's cleanup unregisters the same timer. There is no parallel “already registered” ref: React Strict Mode may run setup, cleanup, and setup again, so suppressing the second setup disconnects the hook.

Worker creation belongs to the passive effect rather than render. Displayed state is keyed by duration, group, and mode so a changed configuration renders its own initial value without reviving an older timer's tick.

### Release checks use consumer boundaries

Fast tests drive the real worker message listener with fake browser globals and time. Browser tests exercise React lifecycle behavior. The package test uses the real tarball through a plain HTTP server, avoiding Vite worker rewriting. README code fences and separate typed usage fixtures compile against built declarations.

`pnpm tscheck` is deliberately non-emitting. Only `pnpm build` owns publishable declarations; verification order must not alter package contents.

## Invariants

- `@mainframework/timer` remains browser-only and contains no React runtime.
- `@mainframework/timer/react` remains optional and carries the `"use client"` directive without promising server execution.
- The package stays ESM-only with the existing `.` and `./react` entry points.
- The archive contains compiled worker JavaScript and no raw worker TypeScript.
- Countdown duration is a finite, non-negative whole-second value after normalization; other values become zero.
- Count-up duration changes do not restart the timer.
- Effect setup and cleanup remain symmetric; worker construction never moves back into render.
- Callers keep timer IDs unique within the shared worker; registering the same ID updates the existing row.
- `routeKey` remains an opaque string, including the empty string; no router observes or owns it.
- Public protocol types are exported from the root barrel. Worker store interfaces remain outside that root public surface.
- Both public entries share the root module's worker singleton; the React bundle does not create a parallel worker.
- Browser globals are required at use time, and server execution fails explicitly.
- The wall-clock-aligned scheduler remains intentionally unchanged; anchor-relative multi-timer scheduling is separate work.

## Code and Evidence

- Worker delivery: `src/worker/createWorker.ts`, `rollup.config.mjs`
- Worker protocol and projection: `src/worker/timer.worker.ts`, `src/types/index.ts`
- Shared duration policy: `src/utils/duration.ts`
- React adapter: `src/hooks/useTimer.ts`
- Package and declaration assertions: `tests/unit/package-output.test.ts`
- Worker behavior: `tests/unit/timer-worker.test.ts`, `tests/unit/duration.test.ts`
- React behavior: `tests/browser/use-timer.test.tsx`
- Published tarball smoke: `tests/package/packed-worker.test.ts`
- Documentation examples: `tests/unit/readme-examples.test.ts`, `tests/types/readme-usage.ts`

The durable implementation choices are recorded in [`choices.md`](choices.md).
