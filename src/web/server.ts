import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createHmac, timingSafeEqual } from "node:crypto";
import { asc } from "drizzle-orm";

import { db } from "../core/database";
import { groupsTable, usersTable } from "../core/database/schema";
import {
  createNote,
  deleteNoteById,
  listNotes,
  updateNote,
} from "../core/database/repositories/notes.repository";
import { listConversations } from "../core/database/repositories/conversations.repository";
import { getRecentMessages } from "../core/database/repositories/messages.repository";
import {
  createReminder,
  deleteReminder,
  getUnscheduledReminders,
  getUpcomingReminders,
  updateReminder,
} from "../core/database/repositories/reminders.repository";
import { updateUser } from "../core/database/repositories/users.repository";
import { updateGroup } from "../core/database/repositories/groups.repository";
import { logger } from "../core/libs/logger";

const COOKIE_NAME = "edwin_session";
const SESSION_MAX_AGE = 7 * 24 * 3600;

function authEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function sessionToken() {
  return createHmac("sha256", process.env.ADMIN_PASSWORD!)
    .update("admin")
    .digest("hex");
}

function isValidSession(cookieValue: string | undefined) {
  if (!cookieValue || !authEnabled()) {
    return false;
  }

  const expected = Buffer.from(sessionToken(), "hex");
  const actual = Buffer.from(cookieValue, "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

const app = new Hono();

// ---------- Auth ----------

app.use("/api/*", async (c, next) => {
  if (!authEnabled() || c.req.method === "OPTIONS") {
    return next();
  }

  if (c.req.path === "/api/login" && c.req.method === "POST") {
    return next();
  }

  if (isValidSession(getCookie(c, COOKIE_NAME))) {
    return next();
  }

  return c.json({ error: "Unauthorized" }, 401);
});

app.post("/api/login", async (c) => {
  if (!authEnabled()) {
    return c.json({ error: "Auth not configured" }, 503);
  }

  const body = await c.req.json<{ password?: string }>().catch(() => null);

  if (!body?.password || body.password !== process.env.ADMIN_PASSWORD) {
    return c.json({ error: "Invalid password" }, 401);
  }

  setCookie(c, COOKIE_NAME, sessionToken(), {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return c.json({ ok: true });
});

app.post("/api/logout", (c) => {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

app.get("/api/me", (c) => {
  return c.json({
    authenticated: isValidSession(getCookie(c, COOKIE_NAME)),
    authEnabled: authEnabled(),
  });
});

// ---------- Users ----------

app.get("/api/users", async (c) => {
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(asc(usersTable.displayName));

  return c.json(users);
});

app.put("/api/users/:platformId", async (c) => {
  try {
    const platformId = decodeURIComponent(c.req.param("platformId"));
    const body = await c.req
      .json<{
        isOwner?: boolean;
        permissions?: Record<string, string>;
        preferences?: Record<string, unknown>;
      }>()
      .catch(() => null);

    if (!body) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const updates: Parameters<typeof updateUser>[1] = {};

    if (body.isOwner !== undefined) {
      updates.isOwner = Boolean(body.isOwner);
    }

    if (body.permissions !== undefined) {
      updates.permissions = body.permissions;
    }

    if (body.preferences !== undefined) {
      updates.preferences = body.preferences;
    }

    const user = await updateUser(platformId, updates);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(user);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// ---------- Groups ----------

app.get("/api/groups", async (c) => {
  const groups = await db
    .select()
    .from(groupsTable)
    .orderBy(asc(groupsTable.name));

  return c.json(groups);
});

app.put("/api/groups/:platformId", async (c) => {
  try {
    const platformId = decodeURIComponent(c.req.param("platformId"));
    const body = await c.req
      .json<{
        name?: string;
        autoParticipate?: boolean;
        permissions?: Record<string, string>;
        preferences?: Record<string, unknown>;
      }>()
      .catch(() => null);

    if (!body) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const updates: Parameters<typeof updateGroup>[1] = {};

    if (body.name !== undefined) {
      updates.name = body.name;
    }

    if (body.autoParticipate !== undefined) {
      updates.autoParticipate = Boolean(body.autoParticipate);
    }

    if (body.permissions !== undefined) {
      updates.permissions = body.permissions;
    }

    if (body.preferences !== undefined) {
      updates.preferences = body.preferences;
    }

    const group = await updateGroup(platformId, updates);

    if (!group) {
      return c.json({ error: "Group not found" }, 404);
    }

    return c.json(group);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// ---------- Conversations & messages ----------

app.get("/api/conversations", async (c) => {
  return c.json(await listConversations());
});

app.get("/api/messages/:conversationId", async (c) => {
  const conversationId = decodeURIComponent(c.req.param("conversationId"));
  const limit = Number(c.req.query("limit")) || 100;

  return c.json(await getRecentMessages(conversationId, limit));
});

// ---------- Notes ----------

app.get("/api/notes", async (c) => {
  const notes = await listNotes({
    conversationId: c.req.query("conversationId"),
    search: c.req.query("search"),
    limit: Number(c.req.query("limit")) || undefined,
  });

  return c.json(notes);
});

app.post("/api/notes", async (c) => {
  try {
    const body = await c.req
      .json<{ content?: string; conversationId?: string }>()
      .catch(() => null);

    if (!body?.content?.trim()) {
      return c.json({ error: "content is required" }, 400);
    }

    const note = await createNote({
      content: body.content,
      recipientId: null,
      conversationId: body.conversationId ?? null,
    });

    return c.json(note);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

app.put("/api/notes/:id", async (c) => {
  try {
    const body = await c.req.json<{ content?: string }>().catch(() => null);

    if (!body?.content?.trim()) {
      return c.json({ error: "content is required" }, 400);
    }

    const note = await updateNote(Number(c.req.param("id")), {
      content: body.content,
    });

    if (!note) {
      return c.json({ error: "Note not found" }, 404);
    }

    return c.json(note);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

app.delete("/api/notes/:id", async (c) => {
  try {
    const note = await deleteNoteById(Number(c.req.param("id")));

    if (!note) {
      return c.json({ error: "Note not found" }, 404);
    }

    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// ---------- Reminders ----------

app.get("/api/reminders", async (c) => {
  const [scheduled, unscheduled] = await Promise.all([
    getUpcomingReminders(),
    getUnscheduledReminders(),
  ]);

  return c.json({ scheduled, unscheduled });
});

app.post("/api/reminders", async (c) => {
  try {
    const body = await c.req
      .json<{ content?: string; remindAt?: string; conversationId?: string }>()
      .catch(() => null);

    if (!body?.content?.trim()) {
      return c.json({ error: "content is required" }, 400);
    }

    let remindAt: Date | null = null;

    if (body.remindAt) {
      remindAt = new Date(body.remindAt);

      if (Number.isNaN(remindAt.getTime())) {
        return c.json({ error: "Invalid remindAt datetime" }, 400);
      }
    }

    const result = await createReminder({
      content: body.content,
      remindAt,
      conversationId: body.conversationId ?? null,
      recipientId: null,
    });

    return c.json(result[0]);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

app.put("/api/reminders/:id", async (c) => {
  try {
    const body = await c.req
      .json<{
        content?: string;
        remindAt?: string | null;
        completed?: boolean;
      }>()
      .catch(() => null);

    if (!body) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const updates: Parameters<typeof updateReminder>[1] = {};

    if (body.content !== undefined) {
      updates.content = body.content;
    }

    if (body.remindAt !== undefined) {
      if (body.remindAt === null || body.remindAt === "") {
        updates.remindAt = null;
      } else {
        const date = new Date(body.remindAt);

        if (Number.isNaN(date.getTime())) {
          return c.json({ error: "Invalid remindAt datetime" }, 400);
        }

        updates.remindAt = date;
      }
    }

    if (body.completed !== undefined) {
      updates.completed = Boolean(body.completed);
    }

    const reminder = await updateReminder(Number(c.req.param("id")), updates);

    if (!reminder) {
      return c.json({ error: "Reminder not found" }, 404);
    }

    return c.json(reminder);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

app.delete("/api/reminders/:id", async (c) => {
  try {
    const reminder = await deleteReminder(Number(c.req.param("id")));

    if (!reminder) {
      return c.json({ error: "Reminder not found" }, 404);
    }

    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// ---------- Static SPA (after all API routes) ----------

app.use("*", serveStatic({ root: "./web/dist" }));
app.get("*", serveStatic({ path: "./web/dist/index.html" }));

export async function startWebServer() {
  const port = Number(process.env.WEB_PORT ?? 3001);

  if (!authEnabled()) {
    logger.warn(
      "Web UI auth is DISABLED - set ADMIN_PASSWORD to require a login",
    );
  }

  serve({ fetch: app.fetch, port }, (info) => {
    logger.success(`Web UI listening on http://localhost:${info.port}`);
  });
}
