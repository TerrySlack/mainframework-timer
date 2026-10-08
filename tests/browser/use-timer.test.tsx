import { StrictMode, act, useLayoutEffect, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useTimer } from "../../src/hooks/useTimer";
import type { TimerMode, TimerWorkerMessage } from "../../src/types";

interface ProbeProps {
  duration: number;
  routeKey?: string;
  mode?: TimerMode;
}

interface RaceProbeProps extends ProbeProps {
  onCommit: (value: number) => void;
  staleMessage?: TimerWorkerMessage;
}

interface ReturnToInitialProbeProps {
  enabled: boolean;
  onCommit: (value: number) => void;
  staleMessage?: TimerWorkerMessage;
}

interface WorkerPost {
  type: "register" | "unregister";
  routeKey: string;
  id: string;
  mode?: TimerMode;
  durationSeconds?: number;
}

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];

  messages: WorkerPost[] = [];

  constructor() {
    super();
    FakeWorker.instances.push(this);
  }

  postMessage(message: WorkerPost): void {
    this.messages.push(message);
  }

  emit(message: TimerWorkerMessage): void {
    this.dispatchEvent(new MessageEvent("message", { data: message }));
  }
}

const Probe = ({ duration, routeKey, mode }: ProbeProps) => {
  const value = useTimer(duration, routeKey, mode);
  return <output>{value}</output>;
};

const RaceProbe = ({ duration, routeKey, mode, onCommit, staleMessage }: RaceProbeProps) => {
  const value = useTimer(duration, routeKey, mode);

  useLayoutEffect(() => {
    onCommit(value);
  });
  useLayoutEffect(() => {
    if (staleMessage) getWorker().emit(staleMessage);
  }, [staleMessage]);

  return <output>{value}</output>;
};

const ReturnToInitialProbe = ({ enabled, onCommit, staleMessage }: ReturnToInitialProbeProps) => {
  const [phase, setPhase] = useState(0);
  const configuration = phase === 1 ? "b" : "a";
  const value = useTimer(configuration === "a" ? 10 : 20, configuration);

  useLayoutEffect(() => {
    onCommit(value);
  });
  useLayoutEffect(() => {
    if (!enabled) return;
    if (phase === 0) {
      setPhase(1);
      return;
    }
    if (phase === 1) {
      if (staleMessage) getWorker().emit(staleMessage);
      setPhase(2);
    }
  }, [enabled, phase, staleMessage]);

  return <output>{value}</output>;
};

const mounts: Array<{ root: Root; container: HTMLDivElement; mounted: boolean }> = [];

const mount = (element: ReactNode) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const mounted = { root, container, mounted: true };
  mounts.push(mounted);
  act(() => {
    root.render(element);
  });
  return mounted;
};

const unmount = (mounted: (typeof mounts)[number]): void => {
  if (!mounted.mounted) return;
  act(() => {
    mounted.root.unmount();
  });
  mounted.mounted = false;
};

const getWorker = (): FakeWorker => {
  const worker = FakeWorker.instances[0];
  if (!worker) throw new Error("Expected the hook to create a worker.");
  return worker;
};

beforeAll(() => {
  vi.stubGlobal("Worker", FakeWorker);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  const worker = FakeWorker.instances[0];
  if (worker) worker.messages = [];
});

afterEach(() => {
  for (const mounted of mounts) {
    unmount(mounted);
    mounted.container.remove();
  }
  mounts.length = 0;
});

describe("useTimer", () => {
  it("registers again after the Strict Mode cleanup cycle and unregisters the live timer", () => {
    const mounted = mount(
      <StrictMode>
        <Probe duration={10} routeKey="strict" />
      </StrictMode>,
    );
    const worker = getWorker();

    expect(worker.messages.map(({ type }) => type)).toEqual(["register", "unregister", "register"]);
    const liveRegistration = worker.messages.at(-1);
    expect(liveRegistration?.type).toBe("register");

    unmount(mounted);

    expect(worker.messages.at(-1)).toEqual({
      type: "unregister",
      routeKey: "strict",
      id: liveRegistration?.id,
    });
  });

  it("does not register again for an unchanged render", () => {
    const mounted = mount(<Probe duration={10} routeKey="stable" />);
    const worker = getWorker();
    const messageCount = worker.messages.length;

    act(() => {
      mounted.root.render(<Probe duration={10} routeKey="stable" />);
    });

    expect(worker.messages).toHaveLength(messageCount);
  });

  it("normalizes and restarts countdown changes", () => {
    const mounted = mount(<Probe duration={1.9} routeKey="countdown" />);
    const worker = getWorker();
    const output = mounted.container.querySelector("output");

    expect(output?.textContent).toBe("1");

    act(() => {
      mounted.root.render(<Probe duration={4.8} routeKey="changed" />);
    });

    expect(output?.textContent).toBe("4");
    expect(worker.messages.slice(-2).map(({ type, routeKey }) => ({ type, routeKey }))).toEqual([
      { type: "unregister", routeKey: "countdown" },
      { type: "register", routeKey: "changed" },
    ]);

    act(() => {
      mounted.root.render(<Probe duration={4.8} routeKey="changed" mode="up" />);
    });

    expect(output?.textContent).toBe("0");
    expect(worker.messages.at(-1)).toMatchObject({ type: "register", routeKey: "changed", mode: "up" });
    expect(worker.messages.at(-1)).not.toHaveProperty("durationSeconds");
  });

  it("does not revive an old value when a previous configuration returns", () => {
    const mounted = mount(<Probe duration={10} routeKey="a" />);
    const worker = getWorker();
    const firstRegistration = worker.messages.at(-1);
    const output = mounted.container.querySelector("output");

    act(() => {
      worker.emit({
        type: "tick",
        id: firstRegistration?.id ?? "",
        mode: "down",
        secondsLeft: 5,
      });
    });
    expect(output?.textContent).toBe("5");

    act(() => {
      mounted.root.render(<Probe duration={20} routeKey="b" />);
    });
    expect(output?.textContent).toBe("20");

    act(() => {
      mounted.root.render(<Probe duration={10} routeKey="a" />);
    });
    expect(output?.textContent).toBe("10");
  });

  it.each([
    {
      name: "duration",
      initial: { duration: 10, routeKey: "same", mode: "down" as const },
      next: { duration: 20, routeKey: "same", mode: "down" as const },
      stale: { type: "tick", mode: "down", secondsLeft: 3 } as const,
      expected: 20,
    },
    {
      name: "route",
      initial: { duration: 10, routeKey: "a", mode: "down" as const },
      next: { duration: 10, routeKey: "b", mode: "down" as const },
      stale: { type: "tick", mode: "down", secondsLeft: 3 } as const,
      expected: 10,
    },
    {
      name: "mode",
      initial: { duration: 10, routeKey: "same", mode: "down" as const },
      next: { duration: 10, routeKey: "same", mode: "up" as const },
      stale: { type: "tick", mode: "down", secondsLeft: 3 } as const,
      expected: 0,
    },
    {
      name: "expired",
      initial: { duration: 10, routeKey: "same", mode: "down" as const },
      next: { duration: 20, routeKey: "same", mode: "down" as const },
      stale: { type: "expired" } as const,
      expected: 20,
    },
  ])("rejects an obsolete registration during a $name transition", ({ initial, next, stale, expected }) => {
    const commits: number[] = [];
    const recordCommit = (value: number): void => {
      commits.push(value);
    };
    const mounted = mount(<RaceProbe {...initial} onCommit={recordCommit} />);
    const worker = getWorker();
    const oldRegistration = worker.messages.at(-1);
    const staleMessage = { ...stale, id: oldRegistration?.id ?? "" } satisfies TimerWorkerMessage;
    commits.length = 0;

    act(() => {
      mounted.root.render(<RaceProbe {...next} onCommit={recordCommit} staleMessage={staleMessage} />);
    });

    expect(commits).toEqual([expected]);
    expect(mounted.container.querySelector("output")?.textContent).toBe(String(expected));
  });

  it("distinguishes a returned configuration from its obsolete registration", () => {
    const commits: number[] = [];
    const recordCommit = (value: number): void => {
      commits.push(value);
    };
    const mounted = mount(<ReturnToInitialProbe enabled={false} onCommit={recordCommit} />);
    const worker = getWorker();
    const oldRegistration = worker.messages.at(-1);
    const staleMessage = {
      type: "tick",
      id: oldRegistration?.id ?? "",
      mode: "down",
      secondsLeft: 3,
    } satisfies TimerWorkerMessage;
    commits.length = 0;

    act(() => {
      mounted.root.render(<ReturnToInitialProbe enabled onCommit={recordCommit} staleMessage={staleMessage} />);
    });

    expect(commits).toEqual([10, 20, 10]);
    expect(mounted.container.querySelector("output")?.textContent).toBe("10");
  });

  it("accepts messages from the current registration generation", () => {
    const commits: number[] = [];
    const recordCommit = (value: number): void => {
      commits.push(value);
    };
    const mounted = mount(<RaceProbe duration={10} routeKey="current" onCommit={recordCommit} />);
    const worker = getWorker();
    const oldRegistration = worker.messages.at(-1);
    const staleMessage = {
      type: "tick",
      id: oldRegistration?.id ?? "",
      mode: "down",
      secondsLeft: 3,
    } satisfies TimerWorkerMessage;
    commits.length = 0;

    act(() => {
      mounted.root.render(
        <RaceProbe duration={20} routeKey="current" onCommit={recordCommit} staleMessage={staleMessage} />,
      );
    });
    const currentRegistration = worker.messages.at(-1);
    act(() => {
      worker.emit({
        type: "tick",
        id: currentRegistration?.id ?? "",
        mode: "down",
        secondsLeft: 18,
      });
    });

    expect(commits).toEqual([20, 18]);
    expect(mounted.container.querySelector("output")?.textContent).toBe("18");
  });

  it("ignores duration changes in count-up mode", () => {
    const mounted = mount(<Probe duration={0} routeKey="up" mode="up" />);
    const worker = getWorker();
    const registration = worker.messages.at(-1);
    const output = mounted.container.querySelector("output");

    act(() => {
      worker.emit({ type: "tick", id: registration?.id ?? "", mode: "up", secondsElapsed: 5 });
    });
    const messageCount = worker.messages.length;

    act(() => {
      mounted.root.render(<Probe duration={99} routeKey="up" mode="up" />);
    });

    expect(worker.messages).toHaveLength(messageCount);
    expect(output?.textContent).toBe("5");
  });

  it("keeps independent React roots isolated", () => {
    const first = mount(<Probe duration={10} routeKey="roots" />);
    const worker = getWorker();
    const firstRegistration = worker.messages.at(-1);
    const second = mount(<Probe duration={10} routeKey="roots" />);
    const secondRegistration = worker.messages.at(-1);

    expect(firstRegistration?.id).not.toBe(secondRegistration?.id);

    act(() => {
      worker.emit({
        type: "tick",
        id: firstRegistration?.id ?? "",
        mode: "down",
        secondsLeft: 8,
      });
    });

    expect(first.container.querySelector("output")?.textContent).toBe("8");
    expect(second.container.querySelector("output")?.textContent).toBe("10");
  });
});
