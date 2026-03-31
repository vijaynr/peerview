import { printHelpView } from "@pv/tui";

export async function runHelpCommand(): Promise<void> {
  printHelpView();
}
