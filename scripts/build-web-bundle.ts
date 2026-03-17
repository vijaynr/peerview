import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const viteConfigFile = path.join(repoRoot, "packages/web/vite.config.ts");
const builtBundleFile = path.join(repoRoot, "packages/web/build/app.js");
const outputFile = path.join(repoRoot, "packages/web/src/generated/app-bundle.generated.js");

await build({
  configFile: viteConfigFile,
  logLevel: "error",
});

const builtBundle = Bun.file(builtBundleFile);
if (!(await builtBundle.exists())) {
  throw new Error(`Expected Vite output at ${builtBundleFile}.`);
}

await Bun.write(
  outputFile,
  `const bundledWebAppScript = ${JSON.stringify(await builtBundle.text())};\nexport default bundledWebAppScript;\n`
);

console.log(`Generated ${path.relative(repoRoot, outputFile)}`);
