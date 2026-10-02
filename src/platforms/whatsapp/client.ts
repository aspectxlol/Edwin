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

  let sock!: WASocket;
  let reconnecting = false;

  let port!: WhatsAppMessagingPort;

  const connect = async () => {
    sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu("Chrome"),

      cachedGroupMetadata: async (jid) => {
        return groupCache.get(jid);
      },

      logger: pino({
        level: "silent",
      }),
    });

    if (port) {
      port.setSocket(sock);
    } else {
      port = new WhatsAppMessagingPort(sock, groupCache);
    }
    sock.ev.on("creds.update", saveCreds);

    registerWhatsAppEvents(port, sock, groupCache, async () => {
      if (reconnecting) return;

      reconnecting = true;
      try {
        await connect();
      } finally {
        reconnecting = false;
      }
    });
  };

  await connect();

  return {
    sock,
    groupCache,
    port,
  };
}
