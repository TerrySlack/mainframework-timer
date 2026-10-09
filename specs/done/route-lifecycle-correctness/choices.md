# Route Lifecycle Correctness Choices

## Sound

### Exercise stale messages through shared lifecycle fixtures

- **When:** React registration ownership pass, finalized in commit `da26825`.
- **The choice:** Share public-behavior fixtures instead of exposing hook internals.
- **Scenario:** One fixture changes duration, route, mode, or expiration and delivers the old Worker's message after React commits the new timer but before passive cleanup. Another walks A → B → A before the next commit, then delivers the original A message. A “generation” is the hook's private serial number for the configuration that owns a registration; returning to equal A values does not restore A's old serial number. The unbuilt alternative was exposing private state or copying a separate component for every field.
- **The gap:** The spec required commit-observing regressions but delegated the fixture structure.
- **The reach:** Future lifecycle cases should extend these public-behavior fixtures rather than inspect private state or duplicate effect-ordering machinery.
- **Verdict:** Sound — the fixtures exercise real React ordering and distinguish current ownership from coincidentally equal values.
- **Confidence:** High.

### Keep route admission at the registration boundary

- **When:** Authoritative route admission pass, finalized in commit `0f2595d`.
- **The choice:** Keep the admission rule inline at the Worker's registration boundary.
- **Scenario:** The Worker is told route B is active, then a delayed registration for route A arrives. One guard discards A before reading time, normalizing duration, storing a row, emitting a value, or starting the timer loop. A helper would move this one-caller rule away from the only place that needs it; a second registry would create another owner that could disagree.
- **The gap:** The contract fixed the admission behavior but left helper extraction open.
- **The reach:** The existing registration branch remains the only owner of admission; no parallel route registry or rejection protocol can drift from it.
- **Verdict:** Sound — the guard is smallest and clearest at the exact boundary where an inactive timer could otherwise come back.
- **Confidence:** High.

### Build consumer declarations before linting the usage fixture

- **When:** Verification and release pass, finalized in commit `01276ba`.
- **The choice:** Build consumer declarations before type-aware lint examines the usage fixture.
- **Scenario:** On a clean checkout, `pnpm verify` first runs the source check configured to disable compiler output and incremental state. The unit command then builds the declarations a package consumer receives, and lint runs afterward. The usage fixture imports `@mainframework/timer` by its published package name, so lint cannot resolve it before those declarations exist. Weakening type-aware linting or redirecting the fixture to source files would make the command pass by no longer testing the consumer boundary.
- **The gap:** The planned order placed lint before every build and assumed lint did not depend on generated declarations.
- **The reach:** Verification remains clean-checkout-safe without adding a second TypeScript configuration or changing what the consumer fixture imports.
- **Verdict:** Sound — command order satisfies the existing ownership boundaries without weakening a gate.
- **Confidence:** High.
