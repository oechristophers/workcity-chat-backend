import rateLimit from "express-rate-limit";
import { Response, NextFunction } from "express";
import { RequestWithUser } from "../interfaces/RequestWithUser.js";
import { AdminAudit } from "../models/AdminAudit.js";

export const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export const auditAction = (action: string, targetParam?: string) => {
  return async (req: RequestWithUser, _res: Response, next: NextFunction) => {
    try {
      if (req.user) {
        await AdminAudit.create({
          user: req.user.sub,
          action,
          targetId: targetParam ? (req.params as any)[targetParam] : undefined,
          meta: { ip: req.ip, path: req.path, method: req.method },
        });
      }
    } catch (_) {
      // swallow
    }
    next();
  };
};
