// rollup.config.mjs
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import babel from "@rollup/plugin-babel";
import terser from "@rollup/plugin-terser";

const reactCompilerOptions = {
  target: "19",
  sources: (filename) => {
    const f = filename.replace(/\\/g, "/");
    return f.includes("/src/hooks/") ? "all" : "none";
  },
};

const workerUrlFromChunk = (fileName) => {
  const depth = fileName.split("/").length - 1;
  const prefix = depth === 0 ? "./" : "../".repeat(depth);
  return `${prefix}worker/timer.worker.js`;
};

const rewriteWorkerUrl = {
  name: "rewrite-worker-url",
  renderChunk: (code, chunk) => {
    if (chunk.fileName === "worker/timer.worker.js" || !code.includes("./timer.worker.js")) return null;
    return {
      code: code.replaceAll("./timer.worker.js", workerUrlFromChunk(chunk.fileName)),
      map: null,
    };
  },
};

export default {
  input: ["src/index.ts", "src/react.ts", "src/worker/timer.worker.ts"],
  external: (id) => id === "react" || id.startsWith("react/"),
  output: {
    dir: "dist",
    format: "esm",
    sourcemap: true,
    entryFileNames: (chunk) => {
      if (chunk.name.includes("worker")) return "worker/timer.worker.js";
      if (chunk.name === "index") return "vanilla/index.js";
      if (chunk.name === "react") return "react.js";
      return "chunks/[name].js"; // fallback for anything unexpected, not a public entry
    },
    chunkFileNames: "chunks/[name]-[hash].js",
    banner: (chunk) => (chunk.name === "react" ? '"use client";' : ""),
  },
  preserveEntrySignatures: "strict",
  plugins: [
    resolve({ browser: true, extensions: [".ts", ".js"] }),
    babel({
      babelHelpers: "bundled",
      extensions: [".ts", ".tsx"],
      include: ["src/hooks/**"],
      inputSourceMap: false,
      sourceMaps: true,
      plugins: [["babel-plugin-react-compiler", reactCompilerOptions]],
      presets: ["@babel/preset-typescript"],
    }),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "dist/types",
      rootDir: "src",
      exclude: ["src/hooks/**"],
      outputToFilesystem: true,
    }),
    terser({
      // Preserve "use client" / other directives — terser strips unknown
      // leading string-literal statements by default.
      format: { comments: false },
      compress: { directives: false },
    }),
    rewriteWorkerUrl,
  ],
};