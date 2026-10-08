# Route Lifecycle Correctness Choices

## Sound

### Use one transition matrix and one A → B → A fixture

- **When:** Slice 01 — React registration ownership.
- **The choice:** The browser regression uses one shared layout-phase fixture for duration, route, mode, and expiration transitions, plus a small state-machine fixture for A → B → A. The first fixture proves an obsolete message cannot add a commit after a new configuration commits. The second commits B and returns to A before passive cleanup, proving the original A registration cannot become valid merely because its configuration values match again.
- **The gap:** The slice fixed the required transitions and commit-based oracle but left the fixture structure open.
- **The reach:** Future lifecycle cases should extend these behavioral fixtures rather than expose hook internals or duplicate one fixture per field.
- **Verdict:** Sound — it exercises the public hook and real effect ordering while keeping the distinct generation-identity case explicit.
- **Confidence:** High.
