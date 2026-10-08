import { readFile, rm, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { expect, test } from "vitest";

test("the documented JavaScript and React examples type-check", async () => {
  const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
  const readme = await readFile(join(repositoryRoot, "README.md"), "utf8");
  const examples = [...readme.matchAll(/```(js|tsx)\r?\n([\s\S]*?)```/gu)];
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "mainframework-timer-readme-"));

  try {
    const files = await Promise.all(
      examples.map(async ([, language, source], index) => {
        if (!language || source === undefined) throw new Error("README example parsing failed.");
        const path = join(temporaryDirectory, `example-${index}.${language === "tsx" ? "tsx" : "js"}`);
        await writeFile(path, source, "utf8");
        return path;
      }),
    );
    const program = ts.createProgram(files, {
      allowJs: true,
      checkJs: true,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      paths: {
        "@mainframework/timer": [join(repositoryRoot, "dist/types/index.d.ts")],
        "@mainframework/timer/react": [join(repositoryRoot, "dist/types/react.d.ts")],
        "react/jsx-runtime": [join(repositoryRoot, "node_modules/@types/react/jsx-runtime.d.ts")],
      },
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ESNext,
      typeRoots: [join(repositoryRoot, "node_modules/@types")],
      types: ["react"],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length > 0) {
      throw new Error(
        ts.formatDiagnosticsWithColorAndContext(diagnostics, {
          getCanonicalFileName: (file) => file,
          getCurrentDirectory: () => repositoryRoot,
          getNewLine: () => "\n",
        }),
      );
    }

    expect(diagnostics).toHaveLength(0);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
