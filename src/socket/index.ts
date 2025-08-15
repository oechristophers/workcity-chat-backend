import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  verifyAccessToken,
} from "../utils/generateTokens.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";

interface ServerToClientEvents {
  "message:new": (data: any) => void;
  "message:read": (data: any) => void;
  typing: (data: {
    conversationId: string;
    userId: string;
    typing: boolean;
  }) => void;
  "unread:update": (data: {
    conversationId: string;
    userId: string;
    unreadDelta?: number;
    unreadCount?: number;
  }) => void;
}

interface ClientToServerEvents {
  join_conversation: (conversationId: string) => void;
  send_message: (data: { conversationId: string; content: string }) => void;
  mark_read: (data: { conversationId: string }) => void;
  typing: (data: { conversationId: string; typing: boolean }) => void;
}

interface InterServerEvents {}
interface SocketData {
  userId: string;
  role: string;
}

export const initSocket = (httpServer: any) => {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers["authorization"]
          ?.toString()
          .replace("Bearer ", "");
      if (!token) return next(new Error("Auth token required"));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch (e) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;

    socket.on("join_conversation", (conversationId) => {
      socket.join(conversationId);
    });

    socket.on("send_message", async ({ conversationId, content }) => {
      if (!content) return;
      const conv = await Conversation.findById(conversationId);
      if (!conv) return;
      if (!conv.participants.map((p) => p.toString()).includes(userId)) return;
      const msg = await Message.create({
        conversation: conversationId,
        sender: userId,
        content,
        status: "sent",
        readBy: [userId],
      });
      conv.lastMessage = msg._id as any; // _id is ObjectId, matches schema
      await conv.save();
      io.to(conversationId).emit("message:new", { message: msg });
      // Increment unread for other participants
      conv.participants.forEach((p) => {
        if (p.toString() !== userId) {
          io.to(conversationId).emit("unread:update", {
            conversationId,
            userId: p.toString(),
            unreadDelta: 1,
          });
        }
      });
    });

    socket.on("mark_read", async ({ conversationId }) => {
      const conv = await Conversation.findById(conversationId);
      if (!conv) return;
      if (!conv.participants.map((p) => p.toString()).includes(userId)) return;
      await Message.updateMany(
        { conversation: conversationId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId }, $set: { status: "read" } }
      );
      io.to(conversationId).emit("message:read", { conversationId, userId });
      io.to(conversationId).emit("unread:update", {
        conversationId,
        userId,
        unreadCount: 0,
      });
    });

    socket.on("typing", ({ conversationId, typing }) => {
      io.to(conversationId).emit("typing", { conversationId, userId, typing });
    });
  });

  return io;
};
