import { printHelpView } from "../ui/console.js";

export async function runHelpCommand(): Promise<void> {
  printHelpView();
}
