import { WASocket } from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import qrcode from "qrcode-terminal";
import { logger } from "../../../core/libs/logger";

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
    logger.success(`Connected to WhatsApp as ${sock.user?.name ?? "unknown"}`);

    await sock.sendPresenceUpdate("available");
  }

  if (connection === "close") {
    logger.warn(
      `WhatsApp connection closed: ${JSON.stringify(lastDisconnect)}`,
    );
  }
}
