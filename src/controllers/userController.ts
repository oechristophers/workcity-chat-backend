import asyncHandler from "express-async-handler";
import { RequestWithUser } from "../interfaces/RequestWithUser.js";
import { Response } from "express";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errorHandler.js";

export const updateProfile = asyncHandler(
  async (req: RequestWithUser, res: Response): Promise<void> => {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const user = await User.findById(req.user.sub);
    if (!user) throw new ApiError(404, "User not found");

    const { name, username, profilePicture, password, currentPassword } =
      req.body as any;

    if (username && username !== user.username) {
      const exists = await User.findOne({ username: username.toLowerCase() });
      if (exists) throw new ApiError(409, "Username already taken");
      user.username = username.toLowerCase();
    }
    if (typeof name === "string") user.name = name;
    if (typeof profilePicture === "string")
      user.profilePicture = profilePicture;

    if (password) {
      if (!currentPassword)
        throw new ApiError(400, "currentPassword required to change password");
      const ok = await user.comparePassword(currentPassword);
      if (!ok) throw new ApiError(401, "Current password incorrect");
      user.password = password; // pre-save hook will hash
    }

    await user.save();
    const safe = {
      id: user._id,
      name: user.name,
      username: user.username,
      profilePicture: user.profilePicture,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
    // Send response and explicitly return void to satisfy handler typing
    res.json({ success: true, data: safe });
    return;
  }
);

// Separate password change endpoint (requires currentPassword & newPassword)
export const changePassword = asyncHandler(
  async (req: RequestWithUser, res: Response): Promise<void> => {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const user = await User.findById(req.user.sub);
    if (!user) throw new ApiError(404, "User not found");
    const { currentPassword, newPassword } = req.body as any;
    if (!currentPassword || !newPassword)
      throw new ApiError(400, "currentPassword and newPassword required");
    const ok = await user.comparePassword(currentPassword);
    if (!ok) throw new ApiError(401, "Current password incorrect");
    user.password = newPassword; // pre-save hook will hash
    await user.save();
    res.json({ success: true, message: "Password updated" });
    return;
  }
);

// User search by username or email (partial, case-insensitive). Exclude admin users for non-admin requesters.
export const searchUsers = asyncHandler(
  async (req: RequestWithUser, res: Response): Promise<void> => {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const me = await User.findById(req.user.sub).select("role");
    const q = (req.query.q as string) || "";
    if (!q.trim()) {
      res.json({ success: true, data: [] });
      return;
    }
    const regex = new RegExp(
      q.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, "."),
      "i"
    );
    const filter: any = {
      $or: [{ username: regex }, { email: regex }],
    };
    if (me?.role !== "admin") {
      filter.role = { $ne: "admin" };
    }
    const users = await User.find(filter)
      .limit(15)
      .select("name username email profilePicture role createdAt")
      .lean();
    res.json({ success: true, data: users });
    return;
  }
);
