import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { User } from "../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/generateTokens.js";
import { ApiError } from "../utils/errorHandler.js";
import bcrypt from "bcrypt";

// POST /auth/register
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!email || !password)
    throw new ApiError(400, "Email and password required");
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "Email already in use");
  const user = await User.create({ name, email, password, role });
  res
    .status(201)
    .json({ success: true, data: { id: user._id, email: user.email } });
});

// POST /auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password)
    throw new ApiError(400, "Email and password required");
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(401, "Invalid credentials");
  const match = await user.comparePassword(password);
  if (!match) throw new ApiError(401, "Invalid credentials");
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id, user.role);
  await user.addRefreshToken(refreshToken);
  res.json({ success: true, accessToken, refreshToken, user: user });
});

// POST /auth/refresh
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(400, "refreshToken required");
  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, "Invalid token");
  if (!user.refreshTokens.includes(refreshToken))
    throw new ApiError(401, "Token revoked");
  const newAccessToken = generateAccessToken(user.id, user.role);
  res.json({ success: true, accessToken: newAccessToken });
});

// POST /auth/logout
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(400, "refreshToken required");
  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub);
    if (user) {
      await user.removeRefreshToken(refreshToken);
    }
  } catch (e) {
    // ignore invalid token to prevent token fishing
  }
  res.json({ success: true, message: "Logged out" });
});
