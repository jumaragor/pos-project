import { ensureQzConnected } from "@/lib/qz/client";
import { findPrinter } from "@/lib/qz/printers";

export async function printRawCommands(rawData: string, preferredPrinterName?: string) {
  const qz = await ensureQzConnected();
  const printer = await findPrinter(preferredPrinterName);
  const config = qz.configs.create(printer, { encoding: "Cp437" });

  await qz.print(config, [
    {
      type: "raw",
      format: "plain",
      data: rawData
    }
  ]);

  return printer;
}
