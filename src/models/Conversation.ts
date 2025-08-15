import mongoose, { Schema, Document, Types } from "mongoose";

interface IConversationBase {
  participants: Types.ObjectId[];
  lastMessage?: Types.ObjectId | null;
  updatedAt: Date;
  createdAt: Date;
}

export interface IConversation
  extends IConversationBase,
    Document<Types.ObjectId> {
  _id: Types.ObjectId;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [
      { type: Schema.Types.ObjectId, ref: "User", required: true },
    ],
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message", default: null },
  },
  { timestamps: true }
);

ConversationSchema.index({ updatedAt: -1 });
ConversationSchema.index({ participants: 1 });

export const Conversation = mongoose.model<IConversation>(
  "Conversation",
  ConversationSchema
);
