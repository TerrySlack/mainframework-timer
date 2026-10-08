# Choices Ledger

## Sound

### Keep the real-browser package check separate from the fast default test command

- **When:** Slice 01 — packaged worker and test seam.
- **The choice:** `pnpm test` builds the package and runs fast Node-side package assertions; `pnpm test:browser` separately rebuilds and loads the emitted module worker in headless Chromium. A developer changing ordinary timer logic gets a quick local signal, while release-facing passes still run the slower browser proof that catches an unloadable worker. The unbuilt alternative was making every unit-test invocation launch Chromium.
- **The gap:** The plan required Node and browser projects but did not decide whether the browser project belonged in the default command.
- **The reach:** Future slices and CI must run both commands when worker delivery or browser integration can change. Unit-only changes can use the faster command while iterating.
- **Verdict:** Sound — the commands keep distinct feedback loops without weakening the slice gate, which explicitly runs both.
- **Confidence:** High.

### Stop tracking TypeScript's incremental build cache

- **When:** Slice 01 — packaged worker and test seam.
- **The choice:** `tsconfig.tsbuildinfo` is now ignored and removed from version control. Every build rewrites this machine-generated cache, so keeping it tracked made an otherwise clean verification run appear to contain a source change. The unbuilt alternative was repeatedly committing a cache that TypeScript can regenerate.
- **The gap:** The plan did not say how to keep per-slice commits clean when the existing build rewrote a tracked cache.
- **The reach:** Builds no longer add unrelated cache churn to future slice commits. No runtime or declaration output changes.
- **Verdict:** Sound — generated incremental state has no durable source ownership.
- **Confidence:** High.

### Test the production worker module by replacing only its browser globals

- **When:** Slice 02 — worker contract and duration.
- **The choice:** Worker tests import the real `timer.worker.ts` module while a fake `self`, fake clock, and fake timers stand in for the browser. Messages still enter through the production `message` listener and leave through the production `postMessage` call. The unbuilt alternative was extracting a second runtime factory used mainly by tests, which would add another composition path that could drift from the worker entry.
- **The gap:** The plan allowed either an injected projector callback or internal assertions but did not fix the worker test boundary.
- **The reach:** Future worker tests should keep driving the actual message boundary. Pure helpers may still be tested directly when their result is the contract.
- **Verdict:** Sound — it provides deterministic time without bypassing production message handling.
- **Confidence:** High.

### Keep timer setup in a passive React effect

- **When:** Slice 03 — React lifecycle.
- **The choice:** `useTimer` now displays its normalized initial value during render and connects to the worker in `useEffect`, React's passive effect for synchronizing with external systems. It does not block browser painting with `useLayoutEffect`. The unbuilt alternative was retaining a layout effect even though no DOM measurement or before-paint correction remains.
- **The gap:** The plan delegated the effect type as long as setup and cleanup stayed symmetric.
- **The reach:** Worker registration happens after commit, while the hook's returned value is available immediately. Future lifecycle work should not move worker creation back into render to make registration earlier.
- **Verdict:** Sound — the rendered value no longer depends on synchronous effect state updates, so a paint-blocking effect has no job.
- **Confidence:** High.

### Key displayed state by the timer configuration

- **When:** Slice 03 — React lifecycle.
- **The choice:** State stores both the last worker value and the duration, group key, and mode that produced it. When props describe a new timer, the hook conditionally replaces that state during render with the new normalized initial value. This also prevents an A → B → A sequence from reviving A's old tick value. The unbuilt alternative was resetting inside the effect, which React flags as an avoidable cascading render and which can paint stale data.
- **The gap:** The plan required immediate resets but delegated the internal state representation.
- **The reach:** Prop changes cannot flash stale values, and count-up duration changes preserve elapsed state because their effective configuration does not change.
- **Verdict:** Sound — React supports guarded state adjustment during render, and one state record ties each value to the timer that owns it without adding another registration flag.
- **Confidence:** High.

### Make the type-check command read-only

- **When:** Slice 04 — public contract and release.
- **The choice:** `pnpm tscheck` now asks TypeScript to check without emitting files. Previously the command inherited declaration output settings and created a second declaration tree under `dist`, so running a verification command changed the package that would be published. The unbuilt alternative was teaching pack inspection to tolerate duplicated declarations.
- **The gap:** The plan required clean packed declarations but did not identify that the existing type-check command emitted them.
- **The reach:** Verification order can no longer change package contents. `pnpm build` is the only command that owns publishable declarations.
- **Verdict:** Sound — a command named type-check should report errors, not produce release artifacts.
- **Confidence:** High.

### Exercise the tarball through a plain HTTP server

- **When:** Whole-spec review.
- **The choice:** `pnpm test:package` creates the real package archive, extracts it, serves those extracted files directly, and loads the root entry plus its module worker in Chromium. The `tar` development dependency performs extraction consistently across operating systems. The unbuilt alternative was importing `dist` through Vitest's Vite server, which can rewrite worker URLs and does not prove that the archive includes every required file.
- **The gap:** The plan called the packed artifact the release oracle but delegated the package fixture details.
- **The reach:** Changes to `files`, emitted paths, package contents, or the worker's relative URL now fail at the same boundary consumers receive.
- **Verdict:** Sound — it tests the published unit rather than a friendlier development graph.
- **Confidence:** High.
