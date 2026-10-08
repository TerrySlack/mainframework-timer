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

    await expect(access(workerUrl)).resolves.toBeUndefined();
    expect(indexSource).toContain("../worker/timer.worker.js");
    expect(indexSource).not.toMatch(/\breact\b/iu);
    expect(rawTypeScript).toEqual([]);
  });
});
