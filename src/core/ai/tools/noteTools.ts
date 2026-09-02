import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "../../database";
import { notesTable } from "../../database/schema";
import { AgentTool, ToolContext } from "../types";

interface SaveNoteArgs {
  content: string;
}

export const saveNoteTool: AgentTool<SaveNoteArgs> = {
  permissionKey: "tools.notes.save",
  definition: {
    type: "function",
    function: {
      name: "save_note",
      description:
        "Saves a note for later. Use this when the user asks to remember, note down, or save something (e.g. 'note that the wifi password is X', 'remember Mom's birthday is June 3').",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The note content to save.",
          },
        },
        required: ["content"],
      },
    },
  },

  handler: async ({ content }, context) => {
    const result = await db
      .insert(notesTable)
      .values({
        content,
        recipientId: context.senderId,
        conversationId: context.conversationId,
      })
      .returning();

    return {
      saved: true,
      note: result[0],
    };
  },
};

interface SearchNotesArgs {
  query: string;
}

export const searchNotesTool: AgentTool<SearchNotesArgs> = {
  permissionKey: "tools.notes.search",
  definition: {
    type: "function",
    function: {
      name: "search_notes",
      description:
        "Searches saved notes by keyword. Use this when the user asks what is on a list, what was noted before, or to recall saved information (e.g. 'what's on the grocery list?', 'what did we note about the wifi?').",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Keyword or phrase to search for in notes.",
          },
        },
        required: ["query"],
      },
    },
  },

  handler: async ({ query }, context) => {
    // Notes are scoped to the chat they were created in.
    const results = await db
      .select()
      .from(notesTable)
      .where(
        and(
          eq(notesTable.conversationId, context.conversationId),
          ilike(notesTable.content, `%${query}%`),
        ),
      )
      .orderBy(desc(notesTable.updatedAt))
      .limit(10);

    return {
      count: results.length,
      notes: results.map((note) => ({
        id: note.id,
        content: note.content,
        recipientId: note.recipientId,
        updatedAt: note.updatedAt,
      })),
    };
  },
};

interface DeleteNoteArgs {
  id: number;
}

export const deleteNoteTool: AgentTool<DeleteNoteArgs> = {
  permissionKey: "tools.notes.delete",
  definition: {
    type: "function",
    function: {
      name: "delete_note",
      description:
        "Deletes a saved note by its ID. Get the ID from search_notes first.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "The ID of the note to delete.",
          },
        },
        required: ["id"],
      },
    },
  },

  handler: async ({ id }) => {
    const deleted = await db
      .delete(notesTable)
      .where(eq(notesTable.id, id))
      .returning();

    if (deleted.length === 0) {
      return { deleted: false, error: `Note with id ${id} not found.` };
    }

    return { deleted: true };
  },
};
