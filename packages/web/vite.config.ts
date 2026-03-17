import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(configDir, "src/app.ts"),
      formats: ["es"],
      fileName: () => "app.js",
    },
    outDir: path.resolve(configDir, "build"),
    emptyOutDir: true,
    cssCodeSplit: false,
    // We need a single embeddable browser bundle for the compiled CLI binary.
    codeSplitting: false,
  },
});
