import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");

export async function runCli(
  args: string[],
  env: Record<string, string | undefined>,
  options?: { stdinText?: string },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", "src/cli.ts", ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdin: options?.stdinText !== undefined ? "pipe" : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  if (options?.stdinText !== undefined && proc.stdin) {
    proc.stdin.write(options.stdinText);
    proc.stdin.end();
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}
