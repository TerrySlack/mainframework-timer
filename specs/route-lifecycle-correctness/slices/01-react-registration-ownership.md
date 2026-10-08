# Slice 01 — React Registration Ownership

## Contract Unlocked

After React commits effective configuration B, no Worker message from registration generation A may alter B, even if A's passive-effect cleanup has not run. Current-generation messages continue to update the displayed timer normally.

## API Seam and Ownership

`src/hooks/useTimer.ts` owns one internal state record containing:

- normalized countdown duration, or `0` for count-up;
- active route key;
- mode;
- displayed value;
- a monotonically increasing configuration generation.

Render-time configuration reconciliation increments the generation whenever normalized duration, route key, or mode changes. A → B → A therefore produces three distinct generations even though the first and third configurations compare equal.

Each passive-effect setup captures the generation it registers. Its message callback uses a functional state update:

- mismatched generation: return the existing state object unchanged;
- matching generation: project `tick` or `expired` into the value while retaining the owning configuration and generation.

Worker creation, listener installation, registration, listener deletion, and unregistration remain inside the existing passive effect.

## Test Oracle

Extend `tests/browser/use-timer.test.tsx` with a test-only layout-phase race fixture:

1. Mount configuration A and capture its registration ID.
2. Render configuration B.
3. In a test-only layout effect after B commits but before A's passive cleanup, emit a message for A's ID.
4. Observe commit count as well as rendered text.
5. Prove the obsolete message causes no additional commit and cannot replace B's initial value.
6. After B's passive setup, emit a message for B's ID and prove it updates normally.

Cover these ownership transitions:

- countdown duration change;
- route-key change;
- countdown-to-count-up mode change;
- A → B → A generation identity;
- an obsolete `expired` message.

Retain the existing count-up test proving duration-only changes neither reset state nor register again.

The regression must fail on the current hook for the stale-update reason before production code changes. Do not accept a test that passes merely because a later render restores the expected text.

## Human Review Surface

Run:

```text
pnpm exec vitest run --project browser
```

Review the named race tests and their commit-count assertions. There is no visual checkpoint; rendered `<output>` text and lifecycle telemetry are the artifact.

## Verification

- New stale-registration tests pass.
- Existing Strict Mode setup → cleanup → setup behavior remains unchanged.
- An unchanged render does not register again.
- Count-up duration changes preserve elapsed state.
- Independent React roots remain isolated.
- Production code still imports and uses `useEffect`, not `useLayoutEffect`.
- Lint and test type checking remain green.

## Must Stay Green

- `tests/browser/use-timer.test.tsx`
- `tests/unit/timer-worker.test.ts`
- React Compiler lint rules for `src/hooks/**/*.ts`
- Existing `@mainframework/timer/react` signature and declaration output

## Scope Firewalls

- Do not add refs mutated during render.
- Do not move Worker creation or registration into render.
- Do not add a reducer or external store unless the existing keyed state cannot express generation ownership; stop and reslice before widening.
- Do not add route activation subscriptions or support still-mounted inactive hooks.
- Do not alter Worker messages, public types, hook arguments, or return values.
- Do not suppress Strict Mode's second setup.

## Delegated Decisions

The implementer may choose internal field and fixture names and may extract a small pure configuration comparator if it removes duplication. The generation semantics, state ownership, passive-effect boundary, and commit-observing oracle are fixed.

## Feedback That Would Change This Slice

Only a demonstrated React constraint that prevents a generation from living in the existing keyed state should change the seam. If found, record the failing fixture and reslice before introducing refs, layout effects, or an external store.
