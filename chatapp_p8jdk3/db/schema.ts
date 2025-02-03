import { pgTable, text, serial, timestamp, boolean, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  avatarUrl: text("avatar_url"),
  status: varchar("status", { length: 20 }).default("offline"),
  theme: text("theme").default("light"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const friends = pgTable("friends", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  friendId: integer("friend_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userRelations = relations(users, ({ many }) => ({
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
  friends: many(friends, { relationName: "userFriends" }),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

export const friendRelations = relations(friends, ({ one }) => ({
  user: one(users, {
    fields: [friends.userId],
    references: [users.id],
    relationName: "userFriends",
  }),
  friend: one(users, {
    fields: [friends.friendId], 
    references: [users.id],
    relationName: "friendUser",
  }),
}));

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
