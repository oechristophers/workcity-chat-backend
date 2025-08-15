import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { UserRole } from "../interfaces/User.js";
import { TokenPayload } from "../interfaces/RequestWithUser.js";

const accessSecret: Secret = process.env.JWT_ACCESS_SECRET ?? "access_secret";
const refreshSecret: Secret =
  process.env.JWT_REFRESH_SECRET ?? "refresh_secret";
const accessExpires: string = process.env.ACCESS_TOKEN_EXPIRES ?? "15m";
const refreshExpires: string = process.env.REFRESH_TOKEN_EXPIRES ?? "7d";

export const generateAccessToken = (userId: string, role: UserRole): string => {
  const payload: TokenPayload = { sub: userId, role };
  const options: SignOptions = { expiresIn: accessExpires as any };
  return jwt.sign(payload, accessSecret, options);
};

export const generateRefreshToken = (
  userId: string,
  role: UserRole
): string => {
  const payload: TokenPayload = { sub: userId, role };
  const options: SignOptions = { expiresIn: refreshExpires as any };
  return jwt.sign(payload, refreshSecret, options);
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, accessSecret) as TokenPayload;
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, refreshSecret) as TokenPayload;
};
