import { Request } from "express";
import { UserRole } from "./User.js";

export interface TokenPayload {
  sub: string; // user id
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RequestWithUser extends Request {
  user?: TokenPayload;
}
