# @mainframework/timer

A countdown timer for the browser, backed by a shared Web Worker. Timers tick off the main thread so your UI stays responsive.

## Important: client-side only

This library is a **browser-only, client-side** package. It depends on `window`, `Worker`, and `window.location`.

- **Do not use** in Node.js, Express, or other server-side runtimes.
- **Not for SSR timer execution.** You may import it in SSR frameworks (e.g. Next.js), but countdowns only run after client hydration. On the server, `useTimer` returns the initial `durationSeconds` and does not tick.
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

Import `useTimer` from the React entry point:

```tsx
import { useTimer } from "@mainframework/timer/react";

export function Countdown() {
  const secondsLeft = useTimer(60);
  return <span>{secondsLeft}s</span>;
}
```

### `useTimer(durationSeconds, routeKey?)`

| Parameter          | Type     | Description                                                                 |
| ------------------ | -------- | --------------------------------------------------------------------------- |
| `durationSeconds`  | `number` | Countdown length in seconds                                                 |
| `routeKey`         | `string` | Optional. Defaults to `window.location.pathname`. Scopes the timer to a route. |

Returns the number of seconds remaining. Emits ticks every second until the timer reaches zero.

## Vanilla JS usage

The main entry exports low-level utilities. You register timers, listen for messages, and unregister yourself.

```js
import { createWorker, getDefaultRouteKey } from "@mainframework/timer";

const worker = createWorker();
if (!worker) throw new Error("Timer requires a browser environment");

const timerId = crypto.randomUUID();
const routeKey = getDefaultRouteKey();

worker.onmessage = (e) => {
  const msg = e.data;
  if (msg.id !== timerId) return;
  if (msg.type === "tick") console.log(msg.secondsLeft);
  if (msg.type === "expired") console.log("done");
};

worker.postMessage({
  type: "register",
  routeKey,
  id: timerId,
  durationSeconds: 60,
});

// cleanup when done
worker.postMessage({ type: "unregister", routeKey, id: timerId });
```

### Route management (SPAs)

When navigating between routes, notify the worker of the active route to purge timers from inactive routes:

```js
worker.postMessage({ type: "route", activeRoute: "/dashboard" });
```

The `useTimer` hook does not send route messages today; use this directly when managing timers with `createWorker`.

## API reference

### `@mainframework/timer`

| Export                    | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `createWorker()`          | Returns the singleton `Worker`, or `null` outside a browser environment.    |
| `getDefaultRouteKey()`    | Returns `window.location.pathname`, or `""` on the server.                  |
| `TimerWorkerIncomingMessage` | Type for main thread → worker messages.                                  |
| `TimerWorkerMessage`      | Type for worker → main thread messages.                                     |

### `@mainframework/timer/react`

| Export                                      | Description                          |
| ------------------------------------------- | ------------------------------------ |
| `useTimer(durationSeconds, routeKey?)`      | React hook returning seconds left.   |

### Worker message protocol

**Main thread → worker (`TimerWorkerIncomingMessage`):**

| Type         | Payload                                              |
| ------------ | ---------------------------------------------------- |
| `register`   | `{ routeKey, id, durationSeconds }`                  |
| `unregister` | `{ routeKey, id }`                                   |
| `route`      | `{ activeRoute }`                                    |

**Worker → main thread (`TimerWorkerMessage`):**

| Type      | Payload                    |
| --------- | -------------------------- |
| `tick`    | `{ id, secondsLeft }`      |
| `expired` | `{ id }`                   |

## License

MIT — see [package.json](./package.json).

- Repository: [github.com/TerrySlack/mainframework-timer](https://github.com/TerrySlack/mainframework-timer)
- Issues: [github.com/TerrySlack/mainframework-timer/issues](https://github.com/TerrySlack/mainframework-timer/issues)
