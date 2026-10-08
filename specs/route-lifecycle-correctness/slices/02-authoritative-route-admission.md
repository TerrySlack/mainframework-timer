# Slice 02 — Authoritative Route Admission

## Contract Unlocked

After the Worker processes `{ type: "route", activeRoute }`, a later registration for another route is silently discarded and cannot recreate a timer, emit an initial projection, or restart scheduled work.

## API Seam and Ownership

`src/worker/timer.worker.ts` remains the sole owner of route admission.

At the start of the existing `register` branch:

- accept every route while `activeRoute === null`;
- after activation, continue only when `data.routeKey === activeRoute`;
- otherwise return before duration normalization, `addTimer()`, `tickTimer()`, or `startLoop()`.

The route handler already removes every inactive bucket. Because the admission guard prevents subsequent inactive insertion, no second cleanup mechanism or rejection record is needed. “Ignore and remove” means the incoming registration is discarded and no inactive row survives.

## Test Oracle

Extend `tests/unit/timer-worker.test.ts` through the production Worker message listener and fake clock.

Add deterministic cases proving:

1. An inactive zero-duration countdown emits no `expired`.
2. An inactive count-up emits no initial tick.
3. An inactive registration creates no scheduled timer.
4. An ignored registration followed by `unregister` remains an idempotent no-op.
5. A registration matching the active route still projects and schedules normally.
6. Registrations before the first route message retain current unrestricted behavior.
7. An empty-string active route accepts `""` and rejects other keys.
8. A timer purged by a route change cannot be revived by a delayed registration carrying its old route key and ID.

Do not add test-only Worker APIs or inspect private store state. Outgoing messages and fake-timer counts are the behavioral oracle.

## Human Review Surface

Run:

```text
pnpm exec vitest run --project unit
```

Review the route-admission cases as message sequences. There is no visual checkpoint.

## Verification

- Rejected registrations produce no outgoing message.
- Rejected registrations leave no scheduled work.
- Active-route registrations retain countdown and count-up behavior.
- Existing route purge, expiry, normalization, projection, and idle-loop tests remain green.
- `TimerWorkerIncomingMessage` and `TimerWorkerMessage` remain unchanged.

## Must Stay Green

- `tests/unit/timer-worker.test.ts`
- `tests/package/packed-worker.test.ts`
- The empty-string route contract
- Timer-count and idle-loop invariants
- Existing plain-JavaScript Worker usage documented in `README.md`

## Scope Firewalls

- Do not add a rejection, purge, acknowledgement, or error message.
- Do not add route epochs, tombstones, a second registry, or a main-thread subscription.
- Do not change `setActiveRoute()` return type or make it wait for Worker cleanup.
- Do not remove an active-route row when rejecting an inactive registration.
- Do not observe navigation or integrate with a router.
- Do not change scheduling, anchor calculation, or duration normalization.

## Delegated Decisions

The implementer may use an inline guard or a small private predicate. The guard's position, `null` compatibility state, silent behavior, and no-row/no-work result are fixed.

## Feedback That Would Change This Slice

Only evidence that existing supported consumers intentionally register inactive routes after calling `setActiveRoute()` would reopen the admission policy. Such evidence requires a spec decision because the selected contract deliberately treats the active route as authoritative.
