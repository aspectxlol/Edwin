import makeWASocket, {
  Browsers,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import qrcode from "qrcode-terminal";
import pino from "pino";

import { registerWhatsAppEvents } from "./events";

export interface WhatsAppClient {
  sock: WASocket;
  groupCache: NodeCache;
}

export async function createWhatsAppClient(): Promise<WhatsAppClient> {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const groupCache = new NodeCache({
    stdTTL: 5 * 60,
    useClones: false,
  });

  const sock = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu("Chrome"),

    cachedGroupMetadata: async (jid) => {
      return groupCache.get(jid);
    },

    logger: pino({
      level: "silent",
    }),
  });

  sock.ev.on("creds.update", saveCreds);

  registerWhatsAppEvents(sock, groupCache);

  return {
    sock,
    groupCache,
  };
}

export async function startWhatsApp() {
  const client = await createWhatsAppClient();

  return client;
}
