import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";

export const roles = pgEnum("roles", ["human", "assistant", "system"]);

/**
 * A known person, keyed by their platform JID (WhatsApp user id).
 * Rows are created lazily the first time Edwin sees them.
 */
export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  // Platform user id (JID for WhatsApp), e.g. "1234567890@s.whatsapp.net".
  platformId: varchar({ length: 255 }).notNull().unique(),

  // Last display name seen for this user.
  displayName: varchar({ length: 255 }),

  // Platform this user came from ("whatsapp", later "discord", ...).
  platform: varchar({ length: 50 }).notNull().default("whatsapp"),

  // Tier-1 owner (the person Edwin belongs to). Owners get private-data
  // handling and broader default permissions.
  isOwner: boolean().notNull().default(false),

  // ACL map. Keys: "chat.reply" (may trigger Edwin at all), "tools.*"
  // (tool access, e.g. "tools.order.*"), or "*" (everything).
  // Effects: "allow" | "deny". No entry for a key = denied for tools,
  // allowed for chat.reply (see handler default).
  permissions: jsonb().$type<Record<string, string>>().notNull().default({}),

  // Free-form per-user preferences (language, timezone, tone, etc.).
  preferences: jsonb().$type<Record<string, unknown>>().notNull().default({}),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * A group chat, keyed by its platform JID (e.g. "...@g.us" for WhatsApp).
 * Rows are created lazily when Edwin first sees the group.
 */
export const groupsTable = pgTable("groups", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  // Platform chat id, e.g. "120363...@g.us".
  platformId: varchar({ length: 255 }).notNull().unique(),

  // Group subject / display name.
  name: varchar({ length: 255 }),

  platform: varchar({ length: 50 }).notNull().default("whatsapp"),

  // Whether Edwin may participate in this group without an explicit ping.
  autoParticipate: boolean().notNull().default(false),

  // Group-level ACL map (additive union with each member's own map).
  // Same keys as users: "chat.reply", "tools.*", "*".
  permissions: jsonb().$type<Record<string, string>>().notNull().default({}),

  // Group preferences (e.g. {"language": "id", "quietHours": {...}}).
  preferences: jsonb().$type<Record<string, unknown>>().notNull().default({}),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  externalId: varchar({ length: 255 }).notNull().unique(),

  conversationId: varchar({ length: 255 }).notNull(),
  senderId: varchar({ length: 255 }).notNull(),
  senderName: varchar({ length: 255 }),
  role: roles().notNull().default("human"),

  content: text().notNull(),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),

  metadata: jsonb(),
});

export const notesTable = pgTable("notes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  content: text().notNull(),

  // WhatsApp JID of the person who created the note.
  recipientId: varchar({ length: 255 }),

  // Chat JID where the note was created. Notes are only visible in this chat.
  conversationId: varchar({ length: 255 }),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),

  metadata: jsonb(),
});

export const remindersTable = pgTable("reminders", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  content: text().notNull(),

  // When the reminder should fire. Null = unscheduled (no specific time yet).
  remindAt: timestamp({ withTimezone: true }),

  // Whether the reminder has been delivered to the user.
  completed: boolean().notNull().default(false),

  // WhatsApp JID of the person the reminder is for.
  recipientId: varchar({ length: 255 }),

  // Chat JID where the reminder was created (where it should be delivered).
  conversationId: varchar({ length: 255 }),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;

export type Note = typeof notesTable.$inferSelect;
export type NewNote = typeof notesTable.$inferInsert;

export type Reminder = typeof remindersTable.$inferSelect;
export type NewReminder = typeof remindersTable.$inferInsert;

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Group = typeof groupsTable.$inferSelect;
export type NewGroup = typeof groupsTable.$inferInsert;

export const orderTypeEnum = pgEnum("order_type", ["onsite", "delivery"]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);

export const ordersTable = pgTable("orders", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  status: orderStatusEnum().notNull().default("pending"),

  type: orderTypeEnum().notNull(),

  pickupDate: timestamp().notNull(),

  deliveryLocation: text(),

  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp()
    .notNull()
    .$default(() => new Date()),
});

export const orderItemsTable = pgTable("order_items", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  orderId: integer().notNull(),

  itemName: varchar({ length: 255 }).notNull(),

  priceAtSale: integer().notNull(),

  quantity: integer().notNull(),
});

export const productsTable = pgTable("products", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  name: varchar({ length: 255 }).notNull(),

  variant: varchar({ length: 50 }),

  price: integer().notNull(),
});

export type Order = typeof ordersTable.$inferSelect;
export type newOrder = typeof ordersTable.$inferInsert;

export type OrderItem = typeof orderItemsTable.$inferSelect;
export type NewOrderItem = typeof orderItemsTable.$inferInsert;
