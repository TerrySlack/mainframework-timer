# Route Lifecycle Correctness

## Next Agent Prompt

**Status:** Slice 01 completed on 2026-10-08. React registrations now accept Worker messages only while their configuration generation still owns the hook state.

Continue with [Slice 02 — Authoritative route admission](slices/02-authoritative-route-admission.md). Keep its Worker admission boundary independent from the React generation ownership completed in Slice 01.

Warnings:

- Route components unmount on every route change. Supporting still-mounted inactive hooks or later reactivation is out of scope.
- `setActiveRoute()` cleanup may complete asynchronously.
- Existing deletions under `specs/done/runtime-correctness/` are unrelated and must remain untouched.
- The repository's package-manager supply-chain policy currently rejects recently published locked Rollup binaries. Slice 01 verification used the already-installed pinned tools directly.

Slice 01 evidence: the browser project passed 12 tests, the focused Worker unit file passed 10 tests, focused lint passed with zero warnings, and production plus test type checks passed after building package declarations.

Global checklist:

- [x] [Slice 01](slices/01-react-registration-ownership.md): reject messages from obsolete React registrations while retaining passive effects.
- [ ] [Slice 02](slices/02-authoritative-route-admission.md): make the worker reject registrations outside the active route.
- [ ] [Slice 03](slices/03-verification-and-release.md): make type checking sterile and add the complete verification gate.

## Goal

Make timer ownership explicit at the two boundaries where delayed work can cross a lifecycle transition:

1. A mounted React hook accepts a Worker message only when the message belongs to its current registration generation.
2. After the Worker processes a route message, only that route may create timer rows.

The work also makes `pnpm tscheck` create no files and provides one `pnpm verify` command for every release-relevant check.

## Context

`useTimer` resets displayed state when normalized duration, route key, or mode changes, but the old passive-effect listener remains installed until cleanup. A queued message can therefore invoke an obsolete callback after the new configuration commits.

The Worker purges inactive route buckets when it receives `{ type: "route" }`, but a later registration for an inactive route is currently accepted. That allows delayed work to recreate a timer after the route boundary that was meant to destroy it.

TypeScript compilation is incremental in `tsconfig.json`. The current non-emitting command suppresses JavaScript and declarations but can still create `tsconfig.tsbuildinfo`.

Current official guidance supports the intended boundaries:

- [React `useEffect`](https://react.dev/reference/react/useEffect): passive effects synchronize with external systems, and cleanup precedes the next setup.
- [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect): state derived from props should be reconciled during rendering rather than by a state-reset effect.
- [TypeScript `noEmit`](https://www.typescriptlang.org/tsconfig/noEmit.html): suppresses JavaScript, source maps, and declarations.
- [TypeScript `incremental`](https://www.typescriptlang.org/tsconfig/incremental.html): incremental compilation writes build-information state unless disabled.

## Slice Graph

Slices 01 and 02 are independent runtime seams. Slice 03 closes the package only after both are green.

```text
01 React registration ownership ─┐
                                 ├──> 03 Verification and release
02 Authoritative route admission ┘
```

## Contracts

### React registration ownership

- Production registration remains in passive `useEffect`.
- Each effective configuration transition receives a new internal registration generation.
- Worker callbacks capture that generation.
- A callback whose generation is no longer current returns the existing state unchanged.
- Effective configuration remains normalized duration, route key, and mode.
- Count-up duration remains normalized to `0`, so changing its duration does not create a new generation.
- Effect setup and cleanup remain symmetric, including React Strict Mode.

### Worker route authority

- Before the first route message, registration behavior remains unrestricted.
- Once `activeRoute` is set, only a matching `routeKey` may create or update a row.
- An inactive registration is discarded before normalization, insertion, projection, or loop startup.
- Discarding an inactive registration emits no message and leaves no row or scheduled work.
- Route cleanup remains asynchronous from the caller's perspective.
- Empty-string route keys remain valid.

### Verification

- `pnpm tscheck` creates no JavaScript, declarations, maps, or build-information files.
- `pnpm verify` runs lint, sterile type checking, unit tests, browser tests, packed-package tests, and type tests.
- Build commands may retain incremental declaration output; sterility applies specifically to `tscheck`.

## Ownership

- `src/hooks/useTimer.ts` is the sole owner of React registration generation and message acceptance.
- `src/worker/timer.worker.ts` is the sole owner of active-route admission and timer rows.
- `package.json` is the sole owner of command orchestration.
- Existing public protocol types remain the sole description of cross-thread messages and do not change.

No route subscription, router adapter, secondary listener registry, compatibility wrapper, or parallel state machine is introduced.

## Review Map

- Review React concurrency and lifecycle behavior in Slice 01 through a deterministic commit-to-passive-cleanup fixture.
- Review Worker state authority in Slice 02 through the production message boundary and fake time.
- Review consumer compatibility and repository cleanliness in Slice 03 through the packed package, declarations, and generated-file checks.

## Decision Ledger

- Keep passive `useEffect`; `useLayoutEffect` is test-fixture-only.
- Identify ownership with a generation, not configuration equality alone, so A → B → A cannot revive an old A registration.
- Route components unmount on every route change; inactive mounted-hook reactivation is not supported.
- Route cleanup need not be synchronous when `setActiveRoute()` returns.
- Inactive registrations are silently discarded.
- Do not add a `purged`, rejection, acknowledgement, or generation message.
- Preserve all existing exports, hook parameters, return types, entry points, peer requirements, and protocol unions.
- Public exports, signatures, entry points, and protocol shapes remain compatible.
- Rejecting inactive registrations after `setActiveRoute()` is an intentional behavioral change; no migration or compatibility shim is provided.
- Add one comprehensive verification command even though its existing component scripts rebuild more than once.

## Scope Firewalls

- No router observation or automatic call to `setActiveRoute()`.
- No support for still-mounted inactive hooks or route reactivation.
- No scheduler, duration-normalization, Worker-singleton, packaging-layout, or server-behavior redesign.
- No production `useLayoutEffect`, render-time ref mutation, new dependency, or public type.
- No synchronous main-thread purge registry.
- No unrelated cleanup and no restoration or modification of the deleted archived runtime-correctness spec.

## Known Risks

- A configuration-only comparison accepts an obsolete A callback after A → B → A; generation identity is required.
- A visual-value assertion can miss the React race because render-time reconciliation may restore the right text after an extra commit. The test must observe commits.
- The inactive-route guard must run before `addTimer()` and `tickTimer()` or a rejected registration can emit once.
- `activeRoute === null` is a compatibility state and must not be treated as an inactive route.
- `verify` launches Chromium and package packing; it is intentionally a complete gate rather than a fast inner loop.

## Completion

The feature is complete when all slice contracts pass, `pnpm verify` succeeds, `pnpm tscheck` leaves a clean generated-file surface, public exports and protocol declarations are unchanged, and the implementation reads as two existing owners enforcing their boundaries rather than a compatibility layer added beside them.
