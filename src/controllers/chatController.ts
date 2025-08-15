import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { ApiError } from "../utils/errorHandler.js";
import { RequestWithUser } from "../interfaces/RequestWithUser.js";
import mongoose from "mongoose";

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
    const limit = Math.min(100, Math.max(parseInt((req.query.limit as string) || "20", 10), 1));
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
                    { $not: [{ $in: [new mongoose.Types.ObjectId(userId), "$readBy"] }] },
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

    res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
      data: convs,
    });
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
    const { conversationId, content } = req.body as {
      conversationId: string;
      content: string;
    };
    if (!conversationId || !content)
      throw new ApiError(400, "conversationId & content required");
    const conv = await Conversation.findById(conversationId);
    if (!conv) throw new ApiError(404, "Conversation not found");
    if (!conv.participants.map((p) => p.toString()).includes(userId))
      throw new ApiError(403, "Forbidden");
    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content,
      status: "sent",
      readBy: [userId],
    });
    conv.lastMessage = message._id;
    await conv.save();
    res.status(201).json({ success: true, data: message });
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
