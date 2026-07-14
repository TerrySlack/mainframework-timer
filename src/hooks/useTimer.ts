import { useEffect, useId, useRef, useState } from "react";

import { createWorker } from "../worker/createWorker";
import { getDefaultRouteKey } from "../utils/routes";
import { TimerWorkerMessage } from "../types";

const worker = createWorker();
// One shared dispatcher so every hook instance gets its own messages
const listeners = new Map<string, (msg: TimerWorkerMessage) => void>();

if (worker && !worker.onmessage) {
  worker.onmessage = (e: MessageEvent<TimerWorkerMessage>): void => {
    const msg = e.data;
    if (!msg?.id) return;
    listeners.get(msg.id)?.(msg);
  };
}
/**
 * Counts down durationSeconds using ticks reported by the shared timer worker.
 * Returns seconds remaining.
 */
export const useTimer = (durationSeconds: number, routeKey?: string): number => {
  const id = useId();
  const lastRegister = useRef<{ durationSeconds: number; routeKey: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const keyRef = useRef<string>(routeKey ?? getDefaultRouteKey());

  if (worker) {
    listeners.set(id, (msg: TimerWorkerMessage): void => {
      if (msg.type === "tick") {
        setSecondsLeft(msg.secondsLeft);
      }
      if (msg.type === "expired") {
        setSecondsLeft(0);
      }
    });

    const prev = lastRegister.current;
    if (!prev || prev.durationSeconds !== durationSeconds || prev.routeKey !== keyRef.current) {
      lastRegister.current = { durationSeconds, routeKey: keyRef.current };
      worker.postMessage({
        type: "register",
        routeKey: keyRef.current,
        id,
        durationSeconds,
      });
    }
  }

  useEffect(() => {
    return () => {
      listeners.delete(id);
      worker?.postMessage({
        type: "unregister",
        routeKey: routeKey ?? getDefaultRouteKey(),
        id,
      });
    };
  }, [id, routeKey]);
  return secondsLeft;
};
// export const useTimer = (durationSeconds: number, routeKey?: string): number => {
//   const id = useId();

//   const [secondsLeft, setSecondsLeft] = useState(durationSeconds);

//   if (worker && !worker.onmessage) {
//     worker.onmessage = (e: MessageEvent<TimerWorkerMessage>): void => {
//       const msg = e.data;

//       if (!msg || msg.id !== id) return;

//       if (msg.type === "tick") {
//         setSecondsLeft(msg.secondsLeft);
//       }

//       if (msg.type === "expired") {
//         setSecondsLeft(0);
//       }
//     };
//   }

//   if (worker && secondsLeft === durationSeconds) {
//     worker.postMessage({
//       type: "register",
//       routeKey: routeKey ?? getDefaultRouteKey(),
//       id,
//       durationSeconds,
//     });
//   }

//   useEffect(() => {
//     return () => {
//       worker?.postMessage({
//         type: "unregister",
//         routeKey: routeKey ?? getDefaultRouteKey(),
//         id,
//       });
//     };
//   }, [id, routeKey]);

//   return secondsLeft;
// };
