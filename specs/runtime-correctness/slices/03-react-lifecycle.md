# Slice 03 — React Lifecycle

## Contract Unlocked

The optional React hook remains registered after React's setup-cleanup-setup stress cycle, resets only when meaningful timer inputs change, and never constructs the worker during render.

## API Seam and Ownership

Keep the public signature:

```ts
useTimer(durationSeconds: number, routeKey?: string, mode?: TimerMode): number
```

Replace `lastRegister` with a symmetric lifecycle:

1. Effect setup obtains the singleton worker.
2. Setup installs the hook's listener and posts one registration.
3. That setup's cleanup removes the listener and posts the matching unregistration.
4. Any later setup registers again. No ref may suppress setup after cleanup.

Generate an ID for each live effect registration from a module-owned counter or equivalent package-instance-unique source. Do not rely on `useId()` as the worker's global identity across independent React roots.

Use the shared duration normalizer:

- countdown initial and reset state uses the normalized value;
- count-up uses an effective duration of zero;
- changing only `durationSeconds` in count-up mode causes no reset, registration, or unregistration;
- changing countdown duration, mode, or effective group key tears down the old registration and starts the new one.

Keep the explicit browser-only execution error. Keep pathname as the default group key when no key is supplied. Do not call `setActiveRoute()` automatically.

## Runnable Review Surface

React browser tests mount a minimal component and inspect messages sent through a controllable Worker substitute.

Required cases:

- Strict Mode produces register, unregister, register and leaves the second registration active;
- final unmount removes the listener and unregisters the live ID;
- an unchanged rerender posts nothing;
- countdown `1.9` initially returns `1`, matching the worker;
- a countdown duration change resets and re-registers;
- a mode or group-key change unregisters the old registration before registering the new one;
- changing count-up duration alone does nothing;
- two independent React roots receive only their own timer messages.

Tests should assert observable values and worker messages, not hook implementation details.

## Verification

- The current `lastRegister` implementation fails the Strict Mode test before the fix.
- All React lifecycle tests pass after the fix.
- Slice 01's package smoke and Slice 02's protocol tests remain green.
- `pnpm test`, `pnpm tscheck`, `pnpm lint`, and `pnpm build` pass with React Compiler checks enabled.

## Must Stay Green

- One shared worker and one shared main-thread message listener.
- Countdown returns remaining whole seconds; count-up returns elapsed whole seconds.
- Browser-only hard failure outside `window`.
- React remains an optional peer and is absent from the root runtime graph.

## Scope Firewalls

- No provider, context, component wrapper, or options object.
- No router adapter or navigation listener.
- No SSR fallback.
- No automatic active-group cleanup.
- No worker recovery or error UI.

## Delegated Decisions

- `useEffect` or `useLayoutEffect`; symmetry and tests decide, not first-tick folklore.
- Internal listener-key format.
- The package-instance-unique ID prefix.

## Feedback That Would Change This Slice

An explicit requirement for count-up duration changes to restart the timer would change the dependency contract. Framework-specific lifecycle adapters would be separate features, not extensions of this hook.
