import asyncHandler from "express-async-handler";
import { Response } from "express";
import { RequestWithUser } from "../interfaces/RequestWithUser.js";
import { User } from "../models/User.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { ApiError } from "../utils/errorHandler.js";

export const getMetrics = asyncHandler(
  async (_req: RequestWithUser, res: Response) => {
    const [users, conversations, messages, attachments] = await Promise.all([
      User.countDocuments(),
      Conversation.countDocuments(),
      Message.countDocuments(),
      Message.aggregate([
        { $match: { attachments: { $exists: true, $ne: [] } } },
        { $unwind: "$attachments" },
        { $count: "count" },
      ]).then((r) => r[0]?.count || 0),
    ]);
    res.json({
      success: true,
      data: { users, conversations, messages, attachments },
    });
  }
);

export const deleteConversation = asyncHandler(
  async (req: RequestWithUser, res: Response) => {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const { id } = req.params;
    await Conversation.findByIdAndDelete(id);
    await Message.deleteMany({ conversation: id });
    res.json({ success: true, message: "Conversation deleted" });
  }
);

export const purgeUserMessages = asyncHandler(
  async (req: RequestWithUser, res: Response) => {
    const { userId } = req.params;
    await Message.deleteMany({ sender: userId });
    res.json({ success: true, message: "User messages purged" });
  }
);

// List all users (minimal fields) for admin dashboard
export const listUsers = asyncHandler(
  async (_req: RequestWithUser, res: Response) => {
    const users = await User.find()
      .select("name email username role createdAt")
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      data: users.map((u: any) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
      })),
    });
  }
);

// Update user role (admin only)
export const updateUserRole = asyncHandler(
  async (req: RequestWithUser, res: Response) => {
    const { userId } = req.params as { userId: string };
    const { role } = req.body as { role?: string };
    if (!role) throw new ApiError(400, "role required");
    const allowed = ["admin", "agent", "customer", "designer", "merchant"];
    if (!allowed.includes(role)) throw new ApiError(400, "invalid role");
    let user: any = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");
    user.role = role as any;
    await user.save();
    const u: any = user; // narrow for TS
    res.json({
      success: true,
      message: "Role updated",
      data: { id: u._id.toString(), role: u.role },
    });
  }
);
