# Slice 02 — Worker Contract and Duration

## Contract Unlocked

Worker registration has one duration rule, typed mode-specific payloads, deterministic immediate output, and route-group cleanup for every valid string key.

## API Seam and Ownership

Add one shared internal primitive:

```ts
normalizeDurationSeconds(value: number): number
```

Its fixed behavior is:

- finite positive fractions are floored;
- positive integers are unchanged;
- zero, negatives, `NaN`, and either infinity become `0`.

Both the worker and React adapter must consume this owner. Do not duplicate the arithmetic.

Tighten `TimerWorkerIncomingMessage` into mode-specific registration variants:

```ts
| { type: "register"; routeKey: string; id: string; mode: "down"; durationSeconds: number }
| { type: "register"; routeKey: string; id: string; mode: "up" }
```

Keep unregister and route messages unchanged. This is a hard type cutover; add no compatibility overload.

Extract the existing per-row projection from `tickOnce()` so:

- register adds or updates one row and immediately projects only that row;
- scheduled ticks continue projecting all live rows;
- countdown expiration still emits `expired` once and removes the row;
- count-up still emits integer elapsed seconds.

Route cleanup must distinguish `null` from the valid empty-string key.

## Runnable Review Surface

Deterministic fake-clock tests drive the worker message handler and record outgoing messages. They cover observable protocol behavior rather than private map structure.

Required cases:

- countdown normalization for `1.9`, `-1`, `NaN`, and infinities;
- zero-duration countdown expires once;
- count-up registration carries no duration and begins at zero;
- registering timer B emits for B only, even while timer A exists;
- unregistering the last timer stops pending work;
- purging with `activeRoute: ""` keeps the empty-key group and removes other groups;
- deleting or expiring a final row removes its empty group.

Add type tests proving countdown requires a duration and count-up rejects one.

## Verification

- Focused protocol and fake-clock tests pass.
- Slice 01's packaged worker smoke remains green.
- `pnpm test`, `pnpm tscheck`, `pnpm lint`, and `pnpm build` pass.

## Must Stay Green

- Existing output message shapes.
- Deferred deletion during all-store iteration.
- Absolute anchor-based elapsed and remaining calculations.
- Optional, application-controlled route cleanup.

## Scope Firewalls

- Do not redesign timer identity or add `routeKey` to outgoing messages.
- Do not redesign wake scheduling.
- Do not add protocol errors, validation messages, pause, or resume.
- Do not expose worker store types.
- Do not change the React hook beyond consuming the shared normalizer if compilation requires it; lifecycle belongs to Slice 03.

## Delegated Decisions

- Helper and test filenames.
- Whether the per-row projector returns a message or posts through an injected callback.
- Internal store assertions used only by tests.

## Feedback That Would Change This Slice

Only an explicit requirement to reject invalid countdowns instead of normalizing them to zero would change the duration contract. Supporting duplicate IDs across groups would require a separate protocol redesign and is not folded into this slice.
