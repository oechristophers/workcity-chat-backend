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
  presence?: (data: { userId: string; online: boolean }) => void;
  "conversation:maybe_new"?: (data: {
    conversationId: string;
    lastMessage?: any;
  }) => void;
}

interface ClientToServerEvents {
  join_conversation: (conversationId: string) => void;
  send_message: (data: { conversationId: string; content: string }) => void;
  mark_read: (data: { conversationId: string }) => void;
  typing: (data: { conversationId: string; typing: boolean }) => void;
  check_presence?: (data: { userIds: string[] }) => void;
  heartbeat?: () => void;
}

interface InterServerEvents {}
interface SocketData {
  userId: string;
  role: string;
}

export let ioInstance: Server | null = null;

export const initSocket = (httpServer: any) => {
  const defaultOrigins = ["http://localhost:3000"]; // keep in sync with app.ts
  const envOrigin = process.env.CLIENT_URL;
  const allowedOrigins = [...defaultOrigins, envOrigin].filter(
    Boolean
  ) as string[];
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    },
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

  ioInstance = io;

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    // Track online presence
    (socket.data as any)._connectedAt = Date.now();
    (socket.data as any)._lastActiveAt = Date.now();
    const roomName = `u:${userId}`;
    socket.join(roomName);
    const socketsForUser = io.sockets.adapter.rooms.get(roomName);
    if (socketsForUser && socketsForUser.size === 1) {
      io.emit("presence", { userId, online: true });
    }
    const touch = () => {
      (socket.data as any)._lastActiveAt = Date.now();
    };

    // Heartbeat keeps user marked active
    socket.on("heartbeat", () => {
      touch();
    });

    socket.on("join_conversation", (conversationId) => {
      socket.join(conversationId);
    });

    socket.on("send_message", async ({ conversationId, content }) => {
      touch();
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
      // Notify all participants (including those not in the room yet) so they can refresh conversation list if needed
      conv.participants.forEach((p) => {
        io.to(`u:${p.toString()}`).emit("conversation:maybe_new", {
          conversationId,
          lastMessage: { content: msg.content, createdAt: msg.createdAt },
        });
      });
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
      touch();
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
      touch();
      io.to(conversationId).emit("typing", { conversationId, userId, typing });
    });

    socket.on("check_presence", ({ userIds = [] }) => {
      userIds.forEach((uid) => {
        const r = io.sockets.adapter.rooms.get(`u:${uid}`);
        socket.emit("presence", { userId: uid, online: !!r && r.size > 0 });
      });
    });

    socket.on("disconnect", () => {
      setTimeout(() => {
        const r = io.sockets.adapter.rooms.get(roomName);
        if (!r || r.size === 0) {
          io.emit("presence", { userId, online: false });
        }
      }, 100); // slight delay to account for quick reconnects
    });
  });

  // Idle checker: mark users offline (idle) if no activity for threshold while still connected
  const IDLE_THRESHOLD_MS = parseInt(
    process.env.CHAT_IDLE_THRESHOLD_MS || "300000"
  ); // default 5m
  setInterval(() => {
    const now = Date.now();
    const toFlag: string[] = [];
    io.sockets.sockets.forEach((s) => {
      const uid = (s.data as any).userId;
      const last = (s.data as any)._lastActiveAt || 0;
      if (now - last > IDLE_THRESHOLD_MS) {
        // If user currently considered online by room presence, emit offline (idle)
        const room = io.sockets.adapter.rooms.get(`u:${uid}`);
        if (room && room.size > 0) {
          toFlag.push(uid);
        }
      }
    });
    if (toFlag.length) {
      toFlag.forEach((uid) =>
        io.emit("presence", { userId: uid, online: false })
      );
    }
  }, 60000); // run each minute

  return io;
};
