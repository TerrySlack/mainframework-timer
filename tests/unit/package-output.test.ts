import { access, readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const distUrl = new URL("../../dist/", import.meta.url);

describe("package output", () => {
  it("references only the compiled worker from the framework-free entry", async () => {
    const indexUrl = new URL("vanilla/index.js", distUrl);
    const workerUrl = new URL("worker/timer.worker.js", distUrl);
    const indexSource = await readFile(indexUrl, "utf8");
    const files = await readdir(distUrl, { recursive: true });
    const rawTypeScript = files.filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"));
    const unexpectedFiles = files.filter(
      (file) => file.includes(".") && !/(?:\.js(?:\.map)?|\.d\.ts(?:\.map)?)$/u.test(file),
    );

    await expect(access(workerUrl)).resolves.toBeUndefined();
    expect(indexSource).toContain("../worker/timer.worker.js");
    expect(indexSource).not.toMatch(/\breact\b/iu);
    expect(rawTypeScript).toEqual([]);
    expect(unexpectedFiles).toEqual([]);
  });

  it("ships both public entries with their intended declarations", async () => {
    const reactSource = await readFile(new URL("react.js", distUrl), "utf8");
    const rootTypes = await readFile(new URL("types/index.d.ts", distUrl), "utf8");
    const reactTypes = await readFile(new URL("types/react.d.ts", distUrl), "utf8");

    expect(reactSource.startsWith('"use client";')).toBe(true);
    expect(rootTypes).toContain("TimerWorkerIncomingMessage");
    expect(rootTypes).not.toMatch(/TimerRow|RouteTimerState|TimerStore/u);
    expect(reactTypes).toContain("useTimer");
    await expect(access(new URL("index.d.ts", distUrl))).rejects.toThrow();
  });
});
