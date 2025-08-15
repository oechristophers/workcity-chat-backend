import mongoose, {
  Schema,
  Document,
  CallbackWithoutResultAndOptionalError,
} from "mongoose";
import bcrypt from "bcrypt";
import { IUser, UserRole } from "../interfaces/User.js";

// Mongoose will add _id field automatically; we don't include it in IUser to avoid conflicts.
export interface IUserDocument extends Document, IUser {
  comparePassword(candidate: string): Promise<boolean>;
  addRefreshToken(token: string): Promise<void>;
  removeRefreshToken(token: string): Promise<void>;
  clearRefreshTokens(): Promise<void>;
  refreshTokens: string[];
}

const UserSchema = new Schema<IUserDocument>(
  {
    name: { type: String },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "agent", "customer", "designer", "merchant"],
      default: "customer",
      required: true,
    },
    refreshTokens: { type: [String], default: [] },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

UserSchema.pre<IUserDocument>(
  "save",
  async function (next: CallbackWithoutResultAndOptionalError) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  }
);

UserSchema.methods.comparePassword = async function (
  this: IUserDocument,
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

UserSchema.methods.addRefreshToken = async function (
  this: IUserDocument,
  token: string
): Promise<void> {
  this.refreshTokens.push(token);
  await this.save();
};

UserSchema.methods.removeRefreshToken = async function (
  this: IUserDocument,
  token: string
): Promise<void> {
  this.refreshTokens = this.refreshTokens.filter((t: string) => t !== token);
  await this.save();
};

UserSchema.methods.clearRefreshTokens = async function (
  this: IUserDocument
): Promise<void> {
  this.refreshTokens = [];
  await this.save();
};

export const User = mongoose.model<IUserDocument>("User", UserSchema);
