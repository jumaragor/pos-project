import { ensureQzConnected } from "@/lib/qz/client";

export async function findPrinter(preferredPrinterName?: string) {
  const qz = await ensureQzConnected();
  const name = preferredPrinterName?.trim();

  if (name) {
    const found = await qz.printers.find(name);
    if (typeof found === "string") {
      return found;
    }
    if (found && typeof found === "object" && "name" in found && typeof found.name === "string") {
      return found.name;
    }
    return name;
  }

  const defaultPrinter = await qz.printers.getDefault();
  if (!defaultPrinter) {
    throw new Error("No default printer is available.");
  }
  return defaultPrinter;
}
