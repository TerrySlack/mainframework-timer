# Runtime Correctness

Make the published browser package, worker protocol, and optional React adapter agree on one small timer contract.

This plan supersedes the completed optimization plan that established the browser-only boundary and route-group cleanup. Those prior spec files are no longer present in the working tree; do not recreate or continue them. Their build and lifecycle checks did not exercise the published worker or React's setup/cleanup symmetry.

## Next Agent Prompt

You are implementing the runtime-correctness plan for `@mainframework/timer`.

- **Status:** Slices 01–03 complete on 2026-10-08.
- **Next pickup:** Implement [Slice 04](slices/04-public-contract-and-release.md).
- **Warning:** A successful Rollup build is not proof that the emitted worker loads. Test the published package surface.
- **Baseline:** Preserve the current browser-only hard cutover. Do not add SSR fallbacks, router integration, or compatibility shims.
- **Checklist:**
  - [x] [Slice 01 — Packaged worker and test seam](slices/01-packaged-worker-and-test-seam.md)
  - [x] [Slice 02 — Worker contract and duration](slices/02-worker-contract-and-duration.md)
  - [x] [Slice 03 — React lifecycle](slices/03-react-lifecycle.md)
  - [ ] [Slice 04 — Public contract and release](slices/04-public-contract-and-release.md)

- **Evidence:** The built root entry loads `dist/worker/timer.worker.js` in Chromium. Worker tests cover the protocol and timer cleanup. React browser tests cover Strict Mode symmetry, final unmount, stable rerenders, countdown changes, count-up duration changes, and independent roots. Unit tests, browser tests, test type-checking, lint, build, and pack inspection pass.

Update this section before ending every implementation pass.

## Product Contract

- The root package is a browser-only, framework-free Web Worker timer usable from plain JavaScript.
- React is an optional adapter exposed only by `@mainframework/timer/react`.
- `routeKey` is an opaque grouping string. `window.location.pathname` is only the default supplied by `getDefaultRouteKey()`.
- `setActiveRoute()` is optional, application-controlled group cleanup. It has no router dependency.
- The package remains ESM-only with the existing `.` and `./react` entry points.
- This is a hard cutover: fix inaccurate types and behavior directly, without deprecated overloads, dual protocols, or migration code.

## Confirmed Issue Ledger

### Must fix

1. `createWorker()` names `timer.worker.ts`. The asset plugin copies that source as raw TypeScript while Rollup separately emits an unused JavaScript worker. The packed browser entry therefore points at a worker browsers cannot parse.
2. `useTimer()` unregisters during effect cleanup but retains `lastRegister`. React Strict Mode's setup-cleanup-setup cycle then suppresses the second registration and leaves the hook disconnected.
3. The hook displays the raw countdown duration while the worker floors and clamps it. Fractions and negatives visibly disagree; `NaN` and infinities poison worker timing.
4. Count-up mode documents `durationSeconds` as ignored, but duration changes currently reset and re-register it.
5. The incoming protocol makes countdown duration optional even though countdown registration requires it.
6. No behavioral or packed-package test currently detects these failures.

### Simple optimizations included

1. Registration currently calls the all-timer `tickOnce()` scan. Registration should project only the row it just added.
2. Route cleanup treats `""` as “no active group” even though group keys are arbitrary strings.
3. The React adapter constructs the worker during render. Worker acquisition belongs to effect setup.

### Intentionally deferred

- The scheduler aligns wakes to wall-clock seconds, so a timer boundary can be reported up to roughly one second late. Correcting this requires a multi-timer scheduling policy rather than a local patch; keep it out of this simple correctness pass.
- Vanilla callers must keep timer IDs unique within the shared worker. Do not expand every worker response with routing metadata or redesign storage in this pass.
- Do not add pause, resume, reset, worker-recovery, CommonJS, or server execution.

## Ownership Invariants

- `src/utils/duration.ts` owns duration normalization. The hook and worker consume it instead of re-deriving the rule.
- Effect setup owns React registration; its paired cleanup owns unregistration. No second registration-memory ref exists.
- The compiled Rollup worker entry is the only worker artifact. No raw TypeScript worker is copied into `dist`.
- Public protocol types live in `src/types/index.ts`; worker store shapes remain internal and are not re-exported.
- The packed artifact is the release oracle for worker loading and package entry points.
- A successful change should replace stale ownership in the same slice, not add wrappers beside it.

## Slice Graph

```text
01 packaged worker + test seam
             |
             v
02 worker contract + duration
             |
             v
03 React lifecycle
             |
             v
04 docs + packed release gate
```

Each slice must leave a useful contract green. Test scaffolding is introduced with the first release-blocking fix rather than as a standalone infrastructure slice.

## Standing Verification

- Run focused tests for the slice, then the full test suite.
- Run `pnpm tscheck` and `pnpm lint`.
- Run `pnpm build` for packaging-facing slices.
- Run the browser project against the built package for Slices 01 and 04.
- Type-check tests separately; Vitest transforms TypeScript but does not replace TypeScript checking.

Use Vitest's current `test.projects` configuration, with a Node project for deterministic worker logic and a browser project only where real Worker or React browser behavior is the contract. Do not use the deprecated workspace configuration.

## Scope Firewalls

- No framework or router package.
- No automatic pathname observation or automatic `setActiveRoute()` calls.
- No SSR fallback or no-op worker.
- No public options object or new convenience timer API.
- No unrelated dependency upgrades or broad configuration cleanup.
- No scheduler redesign in this plan.
- No compatibility layer for inaccurate protocol types.

## Decisions Delegated to Implementers

- Test and fixture filenames.
- The smallest Vitest browser provider configuration that exercises the packed module worker.
- Internal helper names.
- `useEffect` versus `useLayoutEffect`, provided setup and cleanup remain symmetric and browser tests prove the behavior.

All public behavior, normalization rules, scope boundaries, and verification outcomes are fixed by the slice contracts.
