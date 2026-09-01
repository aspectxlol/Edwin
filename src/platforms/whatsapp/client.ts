import makeWASocket, {
  Browsers,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import pino from "pino";

import { registerWhatsAppEvents } from "./handler/events";
import { WhatsAppMessagingPort } from "./port";

export interface WhatsAppClient {
  sock: WASocket;
  groupCache: NodeCache;
  port: WhatsAppMessagingPort;
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

  const port = new WhatsAppMessagingPort(sock, groupCache);

  registerWhatsAppEvents(port, sock, groupCache);

  return {
    sock,
    groupCache,
    port,
  };
}
