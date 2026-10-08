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
