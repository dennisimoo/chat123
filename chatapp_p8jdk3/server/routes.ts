import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { db } from "@db";
import { messages, users, friends } from "@db/schema";
import { eq, and, or } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Get user profile
  app.get("/api/profile", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId),
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  });

  // Get friends list
  app.get("/api/friends", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userFriends = await db.query.friends.findMany({
      where: or(
        eq(friends.userId, req.session.userId),
        eq(friends.friendId, req.session.userId)
      ),
      with: {
        user: true,
        friend: true,
      },
    });

    res.json(userFriends);
  });

  // Get messages with a specific user
  app.get("/api/messages/:recipientId", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const recipientId = parseInt(req.params.recipientId);
    
    const msgs = await db.query.messages.findMany({
      where: or(
        and(
          eq(messages.senderId, req.session.userId),
          eq(messages.receiverId, recipientId)
        ),
        and(
          eq(messages.senderId, recipientId),
          eq(messages.receiverId, req.session.userId)
        )
      ),
      orderBy: messages.createdAt,
    });

    res.json(msgs);
  });

  // Send a message
  app.post("/api/messages", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const schema = z.object({
      content: z.string().min(1),
      recipientId: z.number(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const { content, recipientId } = result.data;

    const message = await db.insert(messages).values({
      content,
      senderId: req.session.userId,
      receiverId: recipientId,
    });

    res.json(message);
  });

  return httpServer;
}
