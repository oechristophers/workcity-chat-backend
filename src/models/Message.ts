import mongoose, { Schema, Document, Types } from "mongoose";

export type MessageStatus = "sent" | "delivered" | "read";

interface IMessageBase {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  status: MessageStatus;
  createdAt: Date;
  readBy: Types.ObjectId[];
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
    content: { type: String, required: true },
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

MessageSchema.index({ conversation: 1, createdAt: 1 });
// Index to speed up unread lookups (conversation + sender + readBy)
MessageSchema.index({ conversation: 1, sender: 1, readBy: 1, createdAt: -1 });

export const Message = mongoose.model<IMessageDocument>(
  "Message",
  MessageSchema
);
