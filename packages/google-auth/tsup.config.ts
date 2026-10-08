import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "react/index": "src/react/index.ts",
    "node/index": "src/node/index.ts",
    "client/index": "src/client/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  external: ["react", "react-dom", "react-router-dom", "express"],
  treeshake: true,
  minify: false,
});
