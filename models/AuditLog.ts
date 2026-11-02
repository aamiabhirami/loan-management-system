import mongoose, { Schema, type Document } from "mongoose";

export interface IAuditLog extends Document {
  actor: mongoose.Types.ObjectId;
  action: string;
  targetEntity: string;
  entityId: mongoose.Types.ObjectId;
  metadata?: Record<string, string | number | boolean | null>;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  actor: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true, index: true },
  action: { type: String, required: true, immutable: true, maxlength: 80 },
  targetEntity: { type: String, required: true, immutable: true, maxlength: 80 },
  entityId: { type: Schema.Types.ObjectId, required: true, immutable: true, index: true },
  metadata: { type: Schema.Types.Mixed, immutable: true },
  ipAddress: { type: String, immutable: true, maxlength: 64 },
  createdAt: { type: Date, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw" });

AuditLogSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "replaceOne"],
  function preventAuditMutation() {
    throw new Error("Audit log records are append-only.");
  },
);

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
