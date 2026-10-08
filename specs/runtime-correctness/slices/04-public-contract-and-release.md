# Slice 04 — Public Contract and Release

## Contract Unlocked

The README, package metadata, declarations, and packed files describe and deliver the same framework-neutral browser timer.

## Documentation Contract

Revise the root README around these principles:

- The root entry is plain browser JavaScript backed by a shared Web Worker.
- The React entry is optional and framework-agnostic.
- Browser-only means a consumer must execute timer APIs in a browser; do not claim universal server-prerender compatibility.
- `routeKey` is an arbitrary grouping key.
- `getDefaultRouteKey()` returns pathname only as a convenience.
- `setActiveRoute()` is optional application-controlled cleanup, not router integration.
- Count-up ignores duration and its changes.
- Countdown duration uses the shared whole-second normalization rule.
- Vanilla callers must use worker-wide unique timer IDs.

Remove the Next.js-specific promise and router-led framing. Keep `"use client"` as a package directive, not as the product's framework identity.

Update protocol examples to omit duration from count-up registration and require it for countdown registration. Point readers to exported protocol types instead of duplicating internal store details.

Correct the package description; this implementation is not a wrapper around `setInterval`.

## Release Surface

The final packed-package verification must prove:

- both public export targets and declaration targets exist;
- the root entry imports no React runtime;
- the React entry retains its leading `"use client"` directive;
- the emitted worker URL resolves to compiled JavaScript;
- no raw worker TypeScript is packed;
- README examples type-check against the packed declarations;
- public declarations expose protocol types but not internal worker store types.

Use the same browser package smoke established in Slice 01; do not create a second release harness.

## Verification

- `pnpm test`, `pnpm tscheck`, `pnpm lint`, and `pnpm build` pass.
- Browser package tests pass against a clean build.
- Pack inspection contains only intended runtime, source-map, and declaration artifacts.
- Searches find no claim that a router is required and no claim that `"use client"` alone guarantees server-prerender compatibility.
- Every documented public export exists in `src/index.ts` or `src/react.ts`.

## Must Stay Green

- Existing package name, ESM format, peer dependency strategy, and entry-point names.
- Browser-only explicit errors.
- All behavior established by Slices 01–03.

## Scope Firewalls

- No framework-specific setup guide.
- No router-specific examples.
- No exhaustive mirror of internal source files.
- No changelog narrative in the README.
- No new public API added only to simplify documentation.
- No unrelated metadata or dependency upgrades.

## Delegated Decisions

- Example names and concise prose.
- Whether a short framework note is useful, provided it does not make compatibility promises beyond the browser-only contract.
- Exact pack-file allowlist, derived from the final Rollup and declaration outputs.

## Feedback That Would Change This Slice

A named consumer environment with a proven extra setup requirement may justify a short framework note. It must remain secondary to the framework-neutral browser contract and must be verified before publication.
