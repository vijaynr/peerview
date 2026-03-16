import { printHelpView } from "@cr/tui";

export async function runHelpCommand(): Promise<void> {
  printHelpView();
}
