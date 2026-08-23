import { WASocket } from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import qrcode from "qrcode-terminal";

export async function handleConnectionUpdate(
  sock: WASocket,
  update: {
    connection?: "open" | "close" | "connecting";
    qr?: string;
    lastDisconnect?: unknown;
  },
  groupCache: NodeCache,
) {
  const { connection, qr, lastDisconnect } = update;

  if (qr) {
    qrcode.generate(qr, {
      small: true,
    });
  }

  if (connection === "open") {
    console.log("Connected to WhatsApp");

    await sock.sendPresenceUpdate("available");
  }

  if (connection === "close") {
    console.log("WhatsApp connection closed");
    console.log(lastDisconnect);
  }
}
