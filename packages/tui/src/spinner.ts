import ora from "ora";

export type OraSpinner = ReturnType<typeof ora>;

export function createSpinner(text: string): OraSpinner {
  return ora({ text, spinner: "aesthetic" });
}
