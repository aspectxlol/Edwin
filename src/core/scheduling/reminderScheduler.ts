import {
  getDueReminders,
  updateReminder,
} from "../database/repositories/reminders.repository";
import {
  getRecentMessages,
  messageExists,
  saveMessage,
} from "../database/repositories/messages.repository";
import { runAssistant } from "../ai/assistant";
import { Message } from "../database/schema";
import { logOutgoing, logger } from "../libs/logger";
import { MessagingPort } from "../ports/messaging";

const CHECK_INTERVAL_MS = 30_000;

interface ReminderLike {
  id: number;
  content: string;
  recipientId: string | null;
}

/**
 * Build the synthetic message that prompts the AI to deliver a reminder.
 * Persisted with a deterministic externalId so retries never duplicate it.
 */
function buildReminderTrigger(
  reminder: ReminderLike,
  recipientName: string | null,
): Message {
  const who = recipientName ?? "the person";

  return {
    id: 0,
    externalId: `reminder-trigger-${reminder.id}`,
    conversationId: "",
    senderId: "SYSTEM",
    senderName: "Reminder",
    role: "system",
    content:
      `A reminder is now due${recipientName ? ` for ${who}` : ""}: "${reminder.content}". ` +
      `Deliver it naturally in your own voice: address ${who} by name, state what the reminder is about, and keep it brief. ` +
      `Do not mention that this is a scheduled system trigger.`,
    createdAt: new Date(),
    metadata: { isReminderTrigger: true, reminderId: reminder.id },
  };
}

/**
 * Periodically checks for due reminders and delivers them to the chat
 * they were created in. A reminder is delivered once, then marked completed.
 */
export function startReminderScheduler(
  port: MessagingPort,
  applyMentionsFn: (
    text: string,
    conversationId: string,
  ) => Promise<{
    text: string;
    mentionIds: string[];
  }>,
) {
  const tick = async () => {
    try {
      const due = await getDueReminders();

      for (const reminder of due) {
        if (!reminder.conversationId) {
          // Nowhere to deliver it; mark it so we don't retry forever.
          await updateReminder(reminder.id, { completed: true });
          continue;
        }

        try {
          // Look up who the reminder is for, so the AI can address them.
          const recipientName = await getRecipientName(
            reminder.conversationId,
            reminder.recipientId,
          );

          const response = await deliverViaAI(
            port,
            applyMentionsFn,
            reminder,
            recipientName,
          );

          await updateReminder(reminder.id, { completed: true });

          logger.success(
            `Delivered reminder #${reminder.id} to ${reminder.conversationId}`,
          );

          if (response) {
            logOutgoing(reminder.conversationId, response);
          }
        } catch (error) {
          logger.error(`Failed to deliver reminder #${reminder.id}: ${error}`);
        }
      }
    } catch (error) {
      logger.error(`Reminder scheduler tick failed: ${error}`);
    }
  };

  const interval = setInterval(tick, CHECK_INTERVAL_MS);

  // Run once shortly after startup so reminders that came due while the
  // bot was offline are delivered too.
  setTimeout(tick, 5_000);

  return () => clearInterval(interval);
}

/**
 * Find the display name of the reminder's recipient from chat history.
 */
async function getRecipientName(
  conversationId: string,
  recipientId: string | null,
): Promise<string | null> {
  if (!recipientId || recipientId === "SYSTEM") {
    return null;
  }

  const recent = await getRecentMessages(conversationId, 50);
  const match = recent.find((m) => m.senderId === recipientId && m.senderName);

  return match?.senderName ?? null;
}

/**
 * Deliver a reminder by prompting the AI with recent chat history plus a
 * synthetic system message describing the reminder. Falls back to a plain
 * canned message if the AI fails or returns nothing.
 */
async function deliverViaAI(
  port: MessagingPort,
  applyMentionsFn: (
    text: string,
    conversationId: string,
  ) => Promise<{
    text: string;
    mentionIds: string[];
  }>,
  reminder: Awaited<ReturnType<typeof getDueReminders>>[number],
  recipientName: string | null,
) {
  const history = await getRecentMessages(reminder.conversationId!, 20);

  const trigger = buildReminderTrigger(reminder, recipientName);

  // Persist the trigger so the AI's reply has it in context next turn,
  // and so a retried delivery never double-fires.
  if (!(await messageExists(trigger.externalId))) {
    await saveMessage({
      ...trigger,
      conversationId: reminder.conversationId!,
    });
  }

  let response: string | null = null;

  try {
    response = await runAssistant([...history, trigger], {
      senderId: reminder.recipientId ?? "unknown",
      senderName: recipientName ?? "Reminder",
      conversationId: reminder.conversationId!,
    });
  } catch (error) {
    logger.error(`AI delivery failed for reminder #${reminder.id}: ${error}`);
  }

  const raw = response?.trim() || `⏰ Reminder: ${reminder.content}`;

  // Convert "@Name" into real platform mentions so pings actually work.
  const mentioned = await applyMentionsFn(raw, reminder.conversationId!);

  await port.send(reminder.conversationId!, {
    text: mentioned.text,
    mentionIds: mentioned.mentionIds,
  });

  return raw;
}
