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
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_]+$/,
    },
    profilePicture: { type: String },
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
    try {
      if (this.isModified("password")) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
      }
      // Auto-generate username from name if not provided; ensure uniqueness by suffixing 01,02,...
      if ((!this.username || this.isModified("username")) && this.name) {
        let base = (this.username || this.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "")
          .substring(0, 24); // leave room for suffix
        if (!base) base = "user";
        let candidate = base;
        let counter = 1;
        // If document already exists and username unchanged, skip uniqueness loop
        // Only loop if new or modified
        while (true) {
          const existing = await mongoose.models.User.findOne({
            username: candidate,
            _id: { $ne: this._id },
          });
          if (!existing) break;
          candidate = `${base}${counter.toString().padStart(2, "0")}`;
          counter++;
          if (counter > 500) break; // safety valve
        }
        this.username = candidate;
      }
      next();
    } catch (e) {
      next(e as any);
    }
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
