import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  pgEnum,
} from "drizzle-orm/pg-core";

export const roles = pgEnum("roles", ["human", "assistant", "system"]);

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

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),

  metadata: jsonb(),
});

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;

export type Note = typeof notesTable.$inferSelect;
export type NewNote = typeof notesTable.$inferInsert;

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
