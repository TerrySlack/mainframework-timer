# Route Lifecycle Correctness Choices

## Sound

### Use one transition matrix and one A → B → A fixture

- **When:** Slice 01 — React registration ownership.
- **The choice:** The browser regression uses one shared layout-phase fixture for duration, route, mode, and expiration transitions, plus a small state-machine fixture for A → B → A. The first fixture proves an obsolete message cannot add a commit after a new configuration commits. The second reconciles through B and back to A before the next commit, then delivers the original A registration's message before passive cleanup. This proves matching configuration values do not make the obsolete registration current again.
- **The gap:** The slice fixed the required transitions and commit-based oracle but left the fixture structure open.
- **The reach:** Future lifecycle cases should extend these behavioral fixtures rather than expose hook internals or duplicate one fixture per field.
- **Verdict:** Sound — it exercises the public hook and real effect ordering while keeping the distinct generation-identity case explicit.
- **Confidence:** High.

### Keep route admission at the registration boundary

- **When:** Slice 02 — authoritative route admission.
- **The choice:** The Worker rejects an inactive registration with one inline guard at the start of its existing registration branch.
- **The gap:** The slice fixed the admission behavior but left helper extraction open.
- **The reach:** Registration remains the only owner of admission; no second route registry or rejection protocol exists.
- **Verdict:** Sound — the one-caller condition is clearest where it prevents time reads, normalization, insertion, projection, and loop startup.
- **Confidence:** High.
