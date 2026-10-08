import { execFile } from "node:child_process";
import { readFile, readdir, rm, mkdtemp } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { chromium } from "playwright";
import { x } from "tar";
import { expect, test } from "vitest";

const execFileAsync = promisify(execFile);

test("the packed tarball loads its compiled worker in Chromium", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "mainframework-timer-"));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let serverStarted = false;
  const serveFile = async (url: string, response: ServerResponse): Promise<void> => {
    if (url === "/") {
      response.setHeader("content-type", "text/html");
      response.end("<!doctype html><title>timer package smoke</title>");
      return;
    }
    const file = join(temporaryDirectory, decodeURIComponent(new URL(url, "http://localhost").pathname));
    response.setHeader("content-type", "text/javascript");
    response.end(await readFile(file));
  };
  const server = createServer((request, response) => {
    void serveFile(request.url ?? "/", response).catch((error: unknown) => {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.message : String(error));
    });
  });

  try {
    const cwd = new URL("../../", import.meta.url);
    const packageManager = process.env.npm_execpath;
    if (!packageManager) throw new Error("pnpm did not expose its executable path.");
    const command = packageManager.endsWith(".exe") ? packageManager : process.execPath;
    const args = packageManager.endsWith(".exe")
      ? ["pack", "--pack-destination", temporaryDirectory]
      : [packageManager, "pack", "--pack-destination", temporaryDirectory];
    await execFileAsync(command, args, { cwd });
    const archive = (await readdir(temporaryDirectory)).find((file) => file.endsWith(".tgz"));
    if (!archive) throw new Error("pnpm pack did not produce an archive.");
    await x({ file: join(temporaryDirectory, archive), cwd: temporaryDirectory });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    serverStarted = true;
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("The package server did not expose a TCP port.");
    const origin = `http://127.0.0.1:${address.port}`;

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(origin);
    await page.addScriptTag({
      type: "module",
      content: `
import { createWorker } from ${JSON.stringify(`${origin}/package/dist/vanilla/index.js`)};
globalThis.__timerPackageSmoke = new Promise((resolve, reject) => {
  const worker = createWorker();
  const id = crypto.randomUUID();
  const observed = [];
  const timeoutId = window.setTimeout(() => {
    reject(new Error("The packed worker did not expire the countdown."));
  }, 3000);
  worker.addEventListener("error", (event) => {
    window.clearTimeout(timeoutId);
    reject(new Error(event.message));
  });
  worker.addEventListener("message", (event) => {
    if (event.data.id !== id) return;
    observed.push(event.data);
    if (event.data.type !== "expired") return;
    window.clearTimeout(timeoutId);
    resolve(observed);
  });
  worker.postMessage({
    type: "register",
    routeKey: "packed-smoke",
    id,
    mode: "down",
    durationSeconds: 1,
  });
});`,
    });
    await page.waitForFunction(() => "__timerPackageSmoke" in globalThis);
    type TimerMessage =
      { type: "tick"; id: string; mode: "down"; secondsLeft: number } | { type: "expired"; id: string };
    const messages = await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __timerPackageSmoke: Promise<TimerMessage[]>;
          }
        ).__timerPackageSmoke,
    );

    expect(messages.some((message) => message.type === "tick")).toBe(true);
    expect(messages.at(-1)?.type).toBe("expired");
  } finally {
    await browser?.close();
    if (serverStarted) await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
