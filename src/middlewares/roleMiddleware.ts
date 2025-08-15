import { NextFunction, Response } from "express";
import { RequestWithUser } from "../interfaces/RequestWithUser.js";
import { ApiError } from "../utils/errorHandler.js";
import { UserRole } from "../interfaces/User.js";

export const roleMiddleware = (allowed: UserRole[]) => {
  return (req: RequestWithUser, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, "Unauthorized"));
    if (!allowed.includes(req.user.role))
      return next(new ApiError(403, "Forbidden"));
    next();
  };
};
