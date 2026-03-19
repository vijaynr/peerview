import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const viteConfigFile = path.join(repoRoot, "packages/web/vite.config.ts");
const builtBundleFile = path.join(repoRoot, "packages/web/build/app.js");
const builtStylesFile = path.join(repoRoot, "packages/web/build/app.css");
const outputScriptFile = path.join(repoRoot, "packages/web/src/generated/app-bundle.generated.js");
const outputStylesFile = path.join(repoRoot, "packages/web/src/generated/app-styles.generated.js");

await build({
  configFile: viteConfigFile,
  logLevel: "error",
});

const builtBundle = Bun.file(builtBundleFile);
const builtStyles = Bun.file(builtStylesFile);
if (!(await builtBundle.exists())) {
  throw new Error(`Expected Vite output at ${builtBundleFile}.`);
}
if (!(await builtStyles.exists())) {
  throw new Error(`Expected Vite output at ${builtStylesFile}.`);
}

await Promise.all([
  Bun.write(
    outputScriptFile,
    `const bundledWebAppScript = ${JSON.stringify(await builtBundle.text())};\nexport default bundledWebAppScript;\n`
  ),
  Bun.write(
    outputStylesFile,
    `const bundledWebAppStyles = ${JSON.stringify(await builtStyles.text())};\nexport default bundledWebAppStyles;\n`
  ),
]);

console.log(`Generated ${path.relative(repoRoot, outputScriptFile)}`);
console.log(`Generated ${path.relative(repoRoot, outputStylesFile)}`);
