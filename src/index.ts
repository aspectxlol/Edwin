import { startWhatsApp } from "./whatsapp/client";

async function main() {
  await startWhatsApp();
}

main().catch(console.error);
