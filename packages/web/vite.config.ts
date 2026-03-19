import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    lib: {
      entry: path.resolve(configDir, "src/app.ts"),
      formats: ["es"],
      fileName: () => "app.js",
    },
    outDir: path.resolve(configDir, "build"),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 10_000_000,
    // We need a single embeddable browser bundle for the compiled CLI binary.
    codeSplitting: false,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css") ? "app.css" : "[name][extname]",
      },
    },
  },
});
