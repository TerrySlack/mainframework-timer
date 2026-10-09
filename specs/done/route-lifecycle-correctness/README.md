# Route Lifecycle Correctness

**Shipped:** 2026-10-08

## Purpose

Timer ownership must survive asynchronous boundaries without letting obsolete work become current again. React commits and Worker messages do not share one lifecycle, and route cleanup does not make delayed registrations impossible. This work gives each boundary one authority:

- the React hook decides whether a message still belongs to its current registration;
- the Worker decides whether a route may register a timer;
- the verification command preserves every release boundary while keeping standalone source type checking free of generated files.

Public exports and protocol shapes are preserved. Rejecting registrations outside the active route is an intentional behavioral correction after `setActiveRoute()` has established route authority.

## Why This Shape

### Registration identity is stronger than equal configuration

Duration, route key, and mode describe a timer but do not identify the effect setup that registered it. A timer can move A → B → A while an old A message is still queued. Comparing values alone would make that obsolete message look current again.

`useTimer` therefore treats each effective configuration transition as a new private generation. The generation belongs to React state rather than a render-mutated ref, and Worker synchronization remains in the passive effect. Returning to the same values creates a new owner rather than reviving the previous one.

### Active route is an admission boundary

Purging current rows is insufficient when a delayed registration can arrive afterward. Once the Worker processes a route message, that route remains authoritative until another route message replaces it. Registrations for other keys are discarded before they can project a value or schedule work.

Before the first route message, registration remains unrestricted. This preserves the optional nature of `setActiveRoute()` and keeps the package independent of routing libraries.

### Consumer declarations precede type-aware lint

The typed README usage fixture imports the package through its published name, not through source aliases. On a clean checkout, type-aware lint cannot resolve that consumer boundary until package declarations exist.

`pnpm verify` therefore runs the sterile source check first, lets the unit command build declarations, and then runs lint before the remaining browser, package, and type gates. Redirecting the fixture to source or weakening lint would make the gate easier by ceasing to test what consumers receive.

## Invariants

- Worker creation and registration stay in passive `useEffect`; production code does not use a layout effect for timer synchronization.
- A Worker message updates hook state only while its captured generation owns that state.
- Effective configuration is normalized countdown duration, route key, and mode. Count-up duration remains irrelevant.
- Every committed effect setup unregisters its own timer and removes its own listener during cleanup.
- `activeRoute === null` means no route authority has been announced.
- After route authority exists, only the matching route may create or update timer rows.
- Empty-string route keys remain valid for both purge preservation and later admission.
- Inactive registrations emit no rejection, expiry, or purge message and create no scheduled work.
- Route components unmount on route change; supporting still-mounted inactive hooks or automatic reactivation is outside this contract.
- `setActiveRoute()` remains application-controlled and asynchronous from its caller's perspective.
- Public exports, entry points, hook signatures, peer requirements, and Worker message unions remain unchanged.
- `pnpm tscheck` disables both compiler output and incremental state; publishable output remains owned by `pnpm build`.
- `pnpm verify` retains every existing unit, browser, packed-package, lint, and type boundary.

## Rejected Alternatives

- **Configuration equality alone:** fails when an obsolete A registration arrives after A → B → A.
- **Production `useLayoutEffect`:** cleanup timing is not ownership; timer synchronization does not require before-paint DOM work.
- **Render-mutated refs:** would move lifecycle mutation into render and fight React purity.
- **A public `purged` message:** changes the exported protocol for a lifecycle that route unmounting already owns.
- **A second main-thread route registry:** duplicates Worker authority and adds reactivation semantics the package does not support.
- **Lint first on a clean checkout:** the consumer fixture has no declarations to resolve at that point. Weakening lint or redirecting imports would hide the boundary instead of satisfying it.

## Code and Evidence

- React ownership: `src/hooks/useTimer.ts`
- Worker route authority: `src/worker/timer.worker.ts`
- Route API: `src/utils/routes.ts`
- Public protocol: `src/types/index.ts`
- React lifecycle regressions: `tests/browser/use-timer.test.tsx`
- Worker admission and purge regressions: `tests/unit/timer-worker.test.ts`
- Packed package boundary: `tests/package/packed-worker.test.ts`
- Consumer type boundary: `tests/types/readme-usage.ts`
- Verification commands: `package.json`

The implementation choices made beyond the agreed contract are recorded in [`choices.md`](choices.md).
