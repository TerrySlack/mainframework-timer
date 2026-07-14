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

export default {
  input: [
    "src/index.ts",
    "src/react.ts",
    "src/worker/timer.worker.ts",
  ],
  external: (id) => id === "react" || id.startsWith("react/"),
  output: {
    dir: "dist",
    format: "esm",
    sourcemap: true,
    entryFileNames: (chunk) => {
      if (chunk.name.includes("worker")) return "worker/timer.worker.js";
      if (chunk.name === "index") return "vanilla/index.js";
      return "[name].js";
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
    }),
    terser({
      // Preserve "use client" / other directives — terser strips unknown
      // leading string-literal statements by default.
      format: { comments: false },
      compress: { directives: false },
    }),
  ],
};