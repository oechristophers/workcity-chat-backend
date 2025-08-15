import { NextFunction, Response } from "express";
import { RequestWithUser } from "../interfaces/RequestWithUser.js";
import { verifyAccessToken } from "../utils/generateTokens.js";
import { ApiError } from "../utils/errorHandler.js";

export const authMiddleware = (
  req: RequestWithUser,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "No token provided"));
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    next(new ApiError(401, "Invalid or expired token"));
  }
};
