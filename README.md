# @mainframework/timer

Countdown and count-up timers for the browser, backed by a shared Web Worker. Timers tick off the main thread so your UI stays responsive.

## Important: client-side only

This library is a **browser-only, client-side** package. It depends on `window`, `Worker`, and `window.location`.

- **Do not use** in Node.js, Express, or other server-side runtimes.
- **Not for SSR timer execution.** You may import it in SSR frameworks (e.g. Next.js), but timers only run after client hydration. On the server, `useTimer` returns the initial `durationSeconds` in `"down"` mode and `0` in `"up"` mode; it does not tick.
- `createWorker()` returns `null` when `window` is undefined, so imports are safe in isomorphic bundles — the timer simply does not run until the browser.

## Requirements

- A modern browser with Web Worker support
- An ESM-capable bundler that resolves worker URLs via `import.meta.url` (Vite, webpack 5, etc.)
- React >= 19 (only when using `@mainframework/timer/react`)

This package is **not** a drop-in for plain `<script>` tags without a bundler.

## Installation

```bash
npm install @mainframework/timer
```

```bash
yarn add @mainframework/timer
```

React is an optional peer dependency. Install React separately if you use the hook entry:

```bash
npm install react
```

## React usage

Import `useTimer` from the React entry point. The React entry ships with a `"use client"` directive, so it works in Next.js App Router without an extra directive on your component.

```tsx
import { useTimer } from "@mainframework/timer/react";

export function Countdown() {
  const secondsLeft = useTimer(60);
  return <span>{secondsLeft}s</span>;
}

export function Stopwatch() {
  const secondsElapsed = useTimer(0, undefined, "up");
  return <span>{secondsElapsed}s</span>;
}
```

### `useTimer(durationSeconds, routeKey?, mode?)`

| Parameter         | Type             | Description                                                                    |
| ----------------- | ---------------- | ------------------------------------------------------------------------------ |
| `durationSeconds` | `number`         | For `"down"`: countdown length. For `"up"`: ignored (pass `0`).                |
| `routeKey`        | `string?`        | Optional. Defaults to `window.location.pathname`. Scopes the timer to a route. |
| `mode`            | `"down" \| "up"` | Optional. Default `"down"`.                                                    |

Returns seconds remaining in `"down"` mode, or seconds elapsed in `"up"` mode. Emits ticks every second until the countdown reaches zero (`"down"` only).

## Vanilla JS usage

The main entry exports low-level utilities. You register timers, listen for messages, and unregister yourself.

### Countdown

```js
import { createWorker, getDefaultRouteKey } from "@mainframework/timer";

const worker = createWorker();
if (!worker) throw new Error("Timer requires a browser environment");

const timerId = crypto.randomUUID();
const routeKey = getDefaultRouteKey();

worker.onmessage = (e) => {
  const msg = e.data;
  if (msg.id !== timerId) return;
  if (msg.type === "tick" && msg.mode === "down") console.log(msg.secondsLeft);
  if (msg.type === "expired") console.log("done");
};

worker.postMessage({
  type: "register",
  routeKey,
  id: timerId,
  mode: "down",
  durationSeconds: 60,
});

// cleanup when done
worker.postMessage({ type: "unregister", routeKey, id: timerId });
```

### Count-up

```js
worker.onmessage = (e) => {
  const msg = e.data;
  if (msg.id !== timerId) return;
  if (msg.type === "tick" && msg.mode === "up") console.log(msg.secondsElapsed);
};

worker.postMessage({
  type: "register",
  routeKey,
  id: timerId,
  mode: "up",
});
```

### Route management (SPAs)

When navigating between routes, notify the worker of the active route to purge timers from inactive routes:

```js
worker.postMessage({ type: "route", activeRoute: "/dashboard" });
```

The `useTimer` hook does not send route messages today; use this directly when managing timers with `createWorker`.

## API reference

### `@mainframework/timer`

| Export                       | Description                                                              |
| ---------------------------- | ------------------------------------------------------------------------ |
| `createWorker()`             | Returns the singleton `Worker`, or `null` outside a browser environment. |
| `getDefaultRouteKey()`       | Returns `window.location.pathname`, or `""` on the server.               |
| `TimerMode`                  | Type: `"down" \| "up"`.                                                  |
| `TimerWorkerIncomingMessage` | Type for main thread → worker messages.                                  |
| `TimerWorkerMessage`         | Type for worker → main thread messages.                                  |

### `@mainframework/timer/react`

| Export                                        | Description                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `useTimer(durationSeconds, routeKey?, mode?)` | React hook returning seconds remaining (`"down"`) or elapsed (`"up"`). |

### Worker message protocol

**Main thread → worker (`TimerWorkerIncomingMessage`):**

| Type         | Payload                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `register`   | `{ routeKey, id, mode, durationSeconds? }` — `durationSeconds` required for `"down"`, omitted for `"up"` |
| `unregister` | `{ routeKey, id }`                                                                                       |
| `route`      | `{ activeRoute }`                                                                                        |

**Worker → main thread (`TimerWorkerMessage`):**

| Type          | Payload                              |
| ------------- | ------------------------------------ |
| `tick` (down) | `{ id, mode: "down", secondsLeft }`  |
| `tick` (up)   | `{ id, mode: "up", secondsElapsed }` |
| `expired`     | `{ id }` — countdown only            |

## License

MIT — see [package.json](./package.json).

- Repository: [github.com/TerrySlack/mainframework-timer](https://github.com/TerrySlack/mainframework-timer)
- Issues: [github.com/TerrySlack/mainframework-timer/issues](https://github.com/TerrySlack/mainframework-timer/issues)
