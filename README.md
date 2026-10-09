# @mainframework/timer

Countdown and count-up timers for browsers, backed by one shared Web Worker per loaded package instance.

## Runtime contract

The root `@mainframework/timer` entry is framework-free browser JavaScript. The optional `@mainframework/timer/react` entry adapts the same worker for React 19 or later.

The root `@mainframework/timer` entry requires `window` and `Worker`; calling `createWorker`, `getDefaultRouteKey`, or `setActiveRoute` during server execution throws an explicit error.

`useTimer` returns `0` when `window` is unavailable. On the server, pass an explicit `routeKey`: if it is omitted, render may throw while resolving the pathname default via `getDefaultRouteKey()`. When render completes, the returned value is still `0`. After mount in the browser, the first paint shows the raw `durationSeconds` for countdown mode (whole seconds still come from worker ticks); count-up starts at `0` until ticks arrive. When `routeKey` is omitted on the client, the pathname default applies from the first client render. The React bundle includes a `"use client"` directive for tools that understand React Server Components.

## Installation

```bash
npm install @mainframework/timer
```

React is an optional peer dependency. Install it only when using the React entry.

## React

```tsx
import { useTimer } from "@mainframework/timer/react";

export const Countdown = () => {
  const secondsLeft = useTimer(60);
  return <span>{secondsLeft}s</span>;
};

export const Stopwatch = () => {
  const secondsElapsed = useTimer(0, "stopwatch", "up");
  return <span>{secondsElapsed}s</span>;
};
```

`useTimer(durationSeconds, routeKey?, mode?)` returns remaining whole seconds in `"down"` mode and elapsed whole seconds in `"up"` mode.

- In the worker, countdown durations are floored to whole seconds; zero, negative, `NaN`, and infinite values register as zero. Until the first tick, the hook may still display the raw `durationSeconds` you passed (including fractions).
- Count-up mode ignores the duration and later duration changes.
- `routeKey` is an arbitrary grouping key. When omitted, it defaults to `window.location.pathname`. The key used for `register` is captured on the first render and does not change if the prop later changes; unmount sends `unregister` with the latest `routeKey` prop.

## Plain JavaScript

The root entry exposes the shared worker and its typed message protocol. Timer IDs must be unique across that worker.

```js
import { createWorker, getDefaultRouteKey } from "@mainframework/timer";

const worker = createWorker();
const id = crypto.randomUUID();
const routeKey = getDefaultRouteKey();

/** @param {MessageEvent<import("@mainframework/timer").TimerWorkerMessage>} event */
const handleMessage = (event) => {
  const message = event.data;
  if (!message || message.id !== id) return;
  if (message.type === "tick" && message.mode === "down") {
    console.log(message.secondsLeft);
  }
  if (message.type === "expired") console.log("done");
};

worker.addEventListener("message", handleMessage);

worker.postMessage({
  type: "register",
  routeKey,
  id,
  mode: "down",
  durationSeconds: 60,
});

// Remove both owners when the consumer is done.
worker.removeEventListener("message", handleMessage);
worker.postMessage({ type: "unregister", routeKey, id });
```

Count-up registration omits the duration:

```js
import { createWorker } from "@mainframework/timer";

const worker = createWorker();
worker.postMessage({
  type: "register",
  routeKey: "stopwatch",
  id: crypto.randomUUID(),
  mode: "up",
});
```

Use `addEventListener` rather than assigning `worker.onmessage`; the singleton may serve multiple consumers. The React entry sets `onmessage` once to dispatch ticks to hook instances—do not replace it if you mix the root and React entries in the same app.

## Group cleanup

`setActiveRoute(key)` is optional application-controlled cleanup despite its historical name. It keeps the named group and permanently removes timers in every other group. The package does not observe navigation or depend on a routing library.

After the worker processes the route change, the named group is authoritative: later registrations for other groups are silently discarded. Calling `setActiveRoute` again replaces that authority with the new key.

```js
import { setActiveRoute } from "@mainframework/timer";

setActiveRoute("current-workspace");
```

## Public API

### `@mainframework/timer`

| Export                       | Contract                                                          |
| ---------------------------- | ----------------------------------------------------------------- |
| `createWorker()`             | Returns the singleton browser `Worker`.                           |
| `getDefaultRouteKey()`       | Returns `window.location.pathname` as a convenience grouping key. |
| `setActiveRoute(key)`        | Keeps one timer group and purges the others.                      |
| `TimerMode`                  | `"down" \| "up"`                                                  |
| `TimerWorkerIncomingMessage` | Main thread to worker protocol.                                   |
| `TimerWorkerMessage`         | Worker to main thread protocol.                                   |

### `@mainframework/timer/react`

| Export                                        | Contract                                    |
| --------------------------------------------- | ------------------------------------------- |
| `useTimer(durationSeconds, routeKey?, mode?)` | Returns remaining or elapsed whole seconds. |

The exported protocol types are the source of truth for message payloads. Countdown registration requires `durationSeconds`; count-up registration does not accept it. Countdown completion emits `expired` once.

## License

MIT — see [package.json](./package.json).
