/**
 * Small ANSI logger with consistent prefixes and colors so it's easy to
 * tell chats, senders, and bot activity apart at a glance.
 */

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const MAGENTA = "\x1b[35m";
const RED = "\x1b[31m";
const GRAY = "\x1b[90m";

function ts() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

/** Shorten a WhatsApp JID to something readable, e.g. "…12345". */
export function shortJid(jid: string | null | undefined) {
  if (!jid) return "unknown";

  const bare = jid.split("@")[0].split(":")[0];
  return `…${bare.slice(-5)}`;
}

function line(color: string, tag: string, message: string) {
  console.log(
    `${color}${BOLD}[${tag}]${RESET} ${message} - ${GRAY}${ts()}${RESET} `,
  );
}

export const logger = {
  info: (message: string) => line(CYAN, "info", message),
  success: (message: string) => line(GREEN, "ok", message),
  warn: (message: string) => line(YELLOW, "warn", message),
  error: (message: string) => line(RED, "error", message),
  bot: (message: string) => line(MAGENTA, "edwin", message),
  agent: (message: string) => line(GREEN, "agent", message),
};

export interface IncomingMessageLog {
  // Chat display name, e.g. group subject or contact name.
  chat: string;

  // Whether this is a group chat.
  isGroup: boolean;

  // Sender display name (pushName) or fallback.
  sender: string;

  // Sender JID, shortened for disambiguation.
  senderId: string;

  // Message text or attachment placeholder.
  text: string;

  // Quoted message being replied to, if any.
  replyTo?: string | null;

  // Baileys upsert type (notify / history sync etc.).
  type: string;
}

/**
 * Print an incoming message as a compact, color-coded block:
 *
 *   14:32:05 ┌─ 📥 IN  Family Chat (group) · notify
 *            │ from  Mom (…87654)
 *            │ msg   What time is the vet appointment?
 *            │ ↳ replying to "Where is Max?"
 *            └──────────────────────────────
 */
export function logIncoming(entry: IncomingMessageLog) {
  const chatLabel = `${BOLD}${entry.chat}${RESET} ${DIM}(${entry.isGroup ? "group" : "private"})${RESET}`;
  const senderLabel = `${entry.sender} ${DIM}(${entry.senderId})${RESET}`;

  console.log(
    `${CYAN}┌─ 📥 IN  ${chatLabel} ${DIM}· ${entry.type}${RESET} - ${GRAY}${ts()}${RESET} `,
  );
  console.log(`${CYAN}│${RESET} from  ${senderLabel}`);
  console.log(
    `${CYAN}│${RESET} msg   ${entry.text || `${DIM}[attachment]${RESET}`}`,
  );

  if (entry.replyTo) {
    console.log(
      `${CYAN}│${RESET} ${DIM}↳ replying to "${entry.replyTo}"${RESET}`,
    );
  }

  console.log(`${CYAN}└${DIM}${"─".repeat(46)}${RESET}`);
}

/** Print an outgoing bot message. */
export function logOutgoing(chat: string, text: string) {
  console.log(
    `${MAGENTA}┌─ 📤 OUT ${BOLD}${chat}${RESET} - ${GRAY}${ts()}${RESET} `,
  );
  console.log(`${MAGENTA}│${RESET} ${text}`);
  console.log(`${MAGENTA}└${DIM}${"─".repeat(46)}${RESET}`);
}
