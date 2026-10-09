import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

import type { TimerMode, TimerWorkerMessage } from "../../src/types";

export interface WorkerPost {
  type: string;
  routeKey: string;
  id: string;
  mode?: TimerMode;
  durationSeconds?: number;
}

export class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];

  messages: WorkerPost[] = [];

  onmessage: ((event: MessageEvent<TimerWorkerMessage>) => void) | null = null;

  constructor() {
    super();
    FakeWorker.instances.push(this);
  }

  postMessage(message: WorkerPost): void {
    this.messages.push(message);
  }

  emit(message: TimerWorkerMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<TimerWorkerMessage>);
  }
}

export const installFakeWorker = (): void => {
  FakeWorker.instances.length = 0;
  vi.stubGlobal("Worker", FakeWorker);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
};

export const loadUseTimer = async (): Promise<typeof import("../../src/hooks/useTimer").useTimer> => {
  vi.resetModules();
  FakeWorker.instances.length = 0;
  const mod = await import("../../src/hooks/useTimer");
  return mod.useTimer;
};

export const getFakeWorker = (): FakeWorker => {
  const worker = FakeWorker.instances[0];
  if (!worker) throw new Error("Expected the hook to create a worker.");
  return worker;
};

const mounts: Array<{ root: Root; container: HTMLDivElement }> = [];

export const mount = (element: ReactNode) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounts.push({ root, container });
  act(() => {
    root.render(element);
  });
  return { root, container };
};

export const clearMounts = (): void => {
  for (const mounted of mounts) {
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  mounts.length = 0;
};
