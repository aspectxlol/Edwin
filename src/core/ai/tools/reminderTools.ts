import {
  createReminder,
  deleteReminder,
  getUpcomingReminders,
  updateReminder,
} from "../../database/repositories/reminders.repository";
import { AgentTool, ToolContext } from "../types";

interface CreateReminderArgs {
  content: string;
  remindAt?: string;
  conversationId?: string;
}

export const createReminderTool: AgentTool<CreateReminderArgs> = {
  permissionKey: "tools.reminders.create",
  definition: {
    type: "function",
    function: {
      name: "create_reminder",
      description:
        "Creates a reminder. Use this when the user asks to be reminded about something (e.g. 'remind me to call the vet tomorrow at 3'). If a time is given, always call get_system_time first to resolve relative dates correctly.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "What to remind the user about.",
          },
          remindAt: {
            type: "string",
            description:
              "When the reminder should fire, in ISO 8601 format (e.g. '2026-09-02T15:30:00+07:00'). Omit for an unscheduled reminder.",
          },
          conversationId: {
            type: "string",
            description:
              "The chat JID where the reminder was created. Defaults to the current chat.",
          },
        },
        required: ["content"],
      },
    },
  },

  handler: async ({ content, remindAt, conversationId }, context) => {
    let remindAtDate: Date | null = null;

    if (remindAt) {
      remindAtDate = new Date(remindAt);

      if (Number.isNaN(remindAtDate.getTime())) {
        return { error: `Invalid remindAt datetime: '${remindAt}'.` };
      }
    }

    const result = await createReminder({
      content,
      remindAt: remindAtDate,
      recipientId: context.senderId,
      conversationId: conversationId ?? context.conversationId,
    });

    return {
      created: true,
      reminder: result[0],
    };
  },
};

interface ListRemindersArgs {
  conversationId?: string;
}

export const listRemindersTool: AgentTool<ListRemindersArgs> = {
  permissionKey: "tools.reminders.read",
  definition: {
    type: "function",
    function: {
      name: "list_reminders",
      description:
        "Lists upcoming (scheduled) and unscheduled reminders. Use this when the user asks what reminders exist or what they have coming up.",
      parameters: {
        type: "object",
        properties: {
          conversationId: {
            type: "string",
            description:
              "Optional chat JID to filter reminders by conversation.",
          },
        },
      },
    },
  },

  handler: async ({ conversationId }, context) => {
    // Reminders are scoped to the chat they were created in.
    const upcoming = await getUpcomingReminders(
      conversationId ?? context.conversationId,
    );

    return {
      count: upcoming.length,
      reminders: upcoming.map((reminder) => ({
        id: reminder.id,
        content: reminder.content,
        remindAt: reminder.remindAt,
        recipientId: reminder.recipientId,
        conversationId: reminder.conversationId,
      })),
    };
  },
};

interface UpdateReminderArgs {
  id: number;
  content?: string;
  remindAt?: string | null;
  completed?: boolean;
}

export const updateReminderTool: AgentTool<UpdateReminderArgs> = {
  permissionKey: "tools.reminders.update",
  definition: {
    type: "function",
    function: {
      name: "update_reminder",
      description:
        "Updates an existing reminder: change its text, reschedule it, or mark it as completed. Get the ID from list_reminders first.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "The ID of the reminder to update.",
          },
          content: {
            type: "string",
            description: "New reminder text.",
          },
          remindAt: {
            type: "string",
            description:
              "New fire time in ISO 8601 format. Pass an empty string to remove the schedule.",
          },
          completed: {
            type: "boolean",
            description: "Mark the reminder as done.",
          },
        },
        required: ["id"],
      },
    },
  },

  handler: async ({ id, content, remindAt, completed }) => {
    const updates: {
      content?: string;
      remindAt?: Date | null;
      completed?: boolean;
    } = {};

    if (content !== undefined) {
      updates.content = content;
    }

    if (remindAt !== undefined) {
      if (remindAt === null || remindAt === "") {
        updates.remindAt = null;
      } else {
        const date = new Date(remindAt);

        if (Number.isNaN(date.getTime())) {
          return { error: `Invalid remindAt datetime: '${remindAt}'.` };
        }

        updates.remindAt = date;
      }
    }

    if (completed !== undefined) {
      updates.completed = completed;
    }

    if (Object.keys(updates).length === 0) {
      return { error: "Nothing to update." };
    }

    const updated = await updateReminder(id, updates);

    if (!updated) {
      return { error: `Reminder with id ${id} not found.` };
    }

    return {
      updated: true,
      reminder: updated,
    };
  },
};

interface DeleteReminderArgs {
  id: number;
}

export const deleteReminderTool: AgentTool<DeleteReminderArgs> = {
  permissionKey: "tools.reminders.delete",
  definition: {
    type: "function",
    function: {
      name: "delete_reminder",
      description:
        "Deletes a reminder by its ID. Get the ID from list_reminders first.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "The ID of the reminder to delete.",
          },
        },
        required: ["id"],
      },
    },
  },

  handler: async ({ id }) => {
    const deleted = await deleteReminder(id);

    if (!deleted) {
      return { error: `Reminder with id ${id} not found.` };
    }

    return { deleted: true };
  },
};
