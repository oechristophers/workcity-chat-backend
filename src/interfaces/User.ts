export type UserRole = "admin" | "agent" | "customer" | "designer" | "merchant";

export interface IUser {
  name?: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt?: Date;
  refreshTokens?: string[]; // stored hashed or raw depending on strategy
}
