import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAdminAudit extends Document<Types.ObjectId> {
  user: Types.ObjectId;
  action: string;
  targetId?: string;
  meta?: any;
  createdAt: Date;
}

const AdminAuditSchema = new Schema<IAdminAudit>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true },
  targetId: { type: String },
  meta: {},
  createdAt: { type: Date, default: Date.now },
});

AdminAuditSchema.index({ action: 1, createdAt: -1 });

export const AdminAudit = mongoose.model<IAdminAudit>(
  "AdminAudit",
  AdminAuditSchema
);
