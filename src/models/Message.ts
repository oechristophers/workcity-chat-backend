import mongoose, { Schema, Document, Types } from "mongoose";

export type MessageStatus = "sent" | "delivered" | "read";

interface IMessageBase {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  content?: string; // optional if attachments present
  status: MessageStatus;
  createdAt: Date;
  readBy: Types.ObjectId[];
  attachments?: {
    type: "image" | "video" | "document";
    url: string;
    originalName?: string;
    mimeType?: string;
    size?: number; // bytes
    durationSeconds?: number; // for video
  }[];
}

export interface IMessageDocument
  extends IMessageBase,
    Document<Types.ObjectId> {
  _id: Types.ObjectId;
}

const MessageSchema = new Schema<IMessageDocument>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: false, trim: true },
    attachments: [
      {
        type: {
          type: String,
          enum: ["image", "video", "document"],
          required: true,
        },
        url: { type: String, required: true },
        originalName: String,
        mimeType: String,
        size: Number,
        durationSeconds: { type: Number, max: 10 }, // enforce <=10s for videos
      },
    ],
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
      required: true,
    },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Ensure either non-empty content or at least one attachment
MessageSchema.pre("validate", function (next) {
  const hasContent = !!this.content && this.content.trim().length > 0;
  const hasAttachments =
    Array.isArray(this.attachments) && this.attachments.length > 0;
  if (!hasContent && !hasAttachments) {
    return next(
      new Error("Either content or at least one attachment is required")
    );
  }
  next();
});

MessageSchema.index({ conversation: 1, createdAt: 1 });
// Index to speed up unread lookups (conversation + sender + readBy)
MessageSchema.index({ conversation: 1, sender: 1, readBy: 1, createdAt: -1 });

export const Message = mongoose.model<IMessageDocument>(
  "Message",
  MessageSchema
);
