import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errorHandler.js";
import { RequestWithUser } from "../interfaces/RequestWithUser.js";
import mongoose from "mongoose";
import { ioInstance } from "../socket/index.js";

// Helper to assert user id
const getUserId = (req: RequestWithUser) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");
  return req.user.sub;
};

export const listConversations = asyncHandler(
  async (req: RequestWithUser, res: Response) => {
    const userId = getUserId(req);
    // Pagination params
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const limit = Math.min(
      100,
      Math.max(parseInt((req.query.limit as string) || "20", 10), 1)
    );
    const skip = (page - 1) * limit;

    // Count total conversations for this user
    const total = await Conversation.countDocuments({ participants: userId });

    const convs = await Conversation.aggregate([
      { $match: { participants: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "messages",
          let: { convId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$conversation", "$$convId"] },
                    { $ne: ["$sender", new mongoose.Types.ObjectId(userId)] },
                    {
                      $not: [
                        {
                          $in: [new mongoose.Types.ObjectId(userId), "$readBy"],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            { $count: "unread" },
          ],
          as: "unreadInfo",
        },
      },
      {
        $addFields: {
          unreadCount: { $ifNull: [{ $first: "$unreadInfo.unread" }, 0] },
        },
      },
      {
        $lookup: {
          from: "messages",
          localField: "lastMessage",
          foreignField: "_id",
          as: "lastMessageObj",
        },
      },
      { $addFields: { lastMessage: { $first: "$lastMessageObj" } } },
      { $project: { lastMessageObj: 0, unreadInfo: 0 } },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // Populate participant minimal fields and lastMessage sender info
    const userIds = Array.from(
      new Set(
        convs.flatMap((c: any) => [
          ...c.participants.map((p: any) => p.toString()),
          c.lastMessage?.sender?.toString?.(),
        ])
      )
    ).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } })
      .select("name username profilePicture role")
      .lean();
    const userMap = Object.fromEntries(
      users.map((u: any) => [u._id.toString(), u])
    );

    const enriched = convs.map((c: any) => ({
      ...c,
      participants: c.participants.map(
        (pid: any) => userMap[pid.toString()] || pid
      ),
      lastMessage: c.lastMessage
        ? {
            ...c.lastMessage,
            sender:
              userMap[c.lastMessage.sender?.toString()] || c.lastMessage.sender,
          }
        : null,
    }));

    res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
      data: enriched,
    });
  }
);

export const getConversation = asyncHandler(
  async (req: RequestWithUser, res: Response) => {
    const userId = getUserId(req);
    const { id } = req.params;
    const conv = await Conversation.findById(id).lean();
    if (!conv) throw new ApiError(404, "Conversation not found");
    if (!conv.participants.map((p: any) => p.toString()).includes(userId))
      throw new ApiError(403, "Forbidden");

    // Compute unread count for this conversation
    const unreadCount = await Message.countDocuments({
      conversation: id,
      sender: { $ne: userId },
      readBy: { $ne: userId },
    });

    // Populate lastMessage
    let lastMessageDoc: any = null;
    if (conv.lastMessage) {
      lastMessageDoc = await Message.findById(conv.lastMessage).lean();
    }

    const participantIds = conv.participants.map((p: any) => p.toString());
    const users = await User.find({ _id: { $in: participantIds } })
      .select("name username profilePicture role")
      .lean();
    const userMap: Record<string, any> = Object.fromEntries(
      users.map((u: any) => [u._id.toString(), u])
    );

    const enriched = {
      ...conv,
      participants: conv.participants.map(
        (pid: any) => userMap[pid.toString()] || pid
      ),
      unreadCount,
      lastMessage: lastMessageDoc,
    };

    res.json({ success: true, data: enriched });
  }
);

export const totalUnread = asyncHandler(
  async (req: RequestWithUser, res: Response) => {
    const userId = getUserId(req);
    const result = await Message.aggregate([
      {
        $match: {
          readBy: { $ne: new mongoose.Types.ObjectId(userId) },
          sender: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $lookup: {
          from: "conversations",
          localField: "conversation",
          foreignField: "_id",
          as: "conv",
        },
      },
      { $unwind: "$conv" },
      { $match: { "conv.participants": new mongoose.Types.ObjectId(userId) } },
      { $count: "total" },
    ]);
    res.json({ success: true, totalUnread: result[0]?.total || 0 });
  }
);

export const getConversationMessages = asyncHandler(
  async (req: RequestWithUser, res: Response) => {
    const userId = getUserId(req);
    const { id } = req.params;
    const conv = await Conversation.findById(id);
    if (!conv) throw new ApiError(404, "Conversation not found");
    if (!conv.participants.map((p) => p.toString()).includes(userId))
      throw new ApiError(403, "Forbidden");
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const limit = Math.min(
      100,
      Math.max(parseInt((req.query.limit as string) || "50", 10), 1)
    );
    const skip = (page - 1) * limit;
    const [total, messages] = await Promise.all([
      Message.countDocuments({ conversation: id }),
      Message.find({ conversation: id })
        .sort({ createdAt: -1 }) // newest first for pagination
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);
    // Return messages in chronological order within page
    messages.reverse();
    res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
      data: messages,
    });
  }
);

export const createConversation = asyncHandler(
  async (req: RequestWithUser, res: Response) => {
    const userId = getUserId(req);
    let { participants } = req.body as { participants: string[] };
    if (!participants || participants.length === 0)
      throw new ApiError(400, "participants required");
    if (!participants.includes(userId)) participants.push(userId);
    // remove duplicates
    participants = [...new Set(participants)];
    const conversation = await Conversation.create({ participants });
    res.status(201).json({ success: true, data: conversation });
  }
);

export const postMessage = asyncHandler(
  async (req: RequestWithUser, res: Response) => {
    const userId = getUserId(req);
    const { conversationId, content, attachments } = req.body as any;

    if (!conversationId) {
      throw new ApiError(400, "conversationId required");
    }

    // New validation check: Validate the attachments array and its contents
    const hasAttachments =
      attachments && Array.isArray(attachments) && attachments.length > 0;

    // Validate if either content or valid attachments exist (allow empty content when attachments supplied)
    if ((!content || !content.trim()) && !hasAttachments) {
      throw new ApiError(400, "content or attachments required");
    }

    // If attachments exist, validate each one
    if (hasAttachments) {
      const invalidAttachment = attachments.find((att: any) => !att.type);
      if (invalidAttachment) {
        throw new ApiError(400, "attachments must have a 'type'");
      }
    }

    const conv = await Conversation.findById(conversationId);
    if (!conv) {
      throw new ApiError(404, "Conversation not found");
    }

    if (!conv.participants.map((p) => p.toString()).includes(userId)) {
      throw new ApiError(403, "Forbidden");
    }

    // Create the message document
    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content: content?.trim() || undefined,
      status: "sent",
      readBy: [userId],
      attachments: hasAttachments ? attachments : [],
    });

    conv.lastMessage = message._id;
    await conv.save();

    const populatedSender = await User.findById(userId)
      .select("name username profilePicture role")
      .lean();

    res.status(201).json({
      success: true,
      data: { ...message.toObject(), sender: populatedSender },
    });

    // Emit real-time event if socket server initialized
    if (ioInstance) {
      ioInstance.to(conversationId).emit("message:new", {
        message: { ...message.toObject(), sender: userId },
      });
      // Also push a lightweight notification to each participant's personal room so they can refresh list if conversation not joined yet
      conv.participants.forEach((p: any) => {
        ioInstance?.to(`u:${p.toString()}`).emit("conversation:maybe_new", {
          conversationId,
          lastMessage: {
            content: message.content,
            createdAt: message.createdAt,
          },
        });
      });
    }
  }
);

export const markMessagesRead = asyncHandler(
  async (req: RequestWithUser, res: Response) => {
    const userId = getUserId(req);
    const { conversationId } = req.body as { conversationId: string };
    if (!conversationId) throw new ApiError(400, "conversationId required");
    const conv = await Conversation.findById(conversationId);
    if (!conv) throw new ApiError(404, "Conversation not found");
    if (!conv.participants.map((p) => p.toString()).includes(userId))
      throw new ApiError(403, "Forbidden");
    await Message.updateMany(
      { conversation: conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId }, $set: { status: "read" } }
    );
    res.json({ success: true, message: "Marked read" });
  }
);
