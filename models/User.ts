import mongoose, { Schema, type Document } from "mongoose";
import type { UserRole } from "@/lib/roles";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  assignedTo?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  phone?: string;
  address?: string;
  kycStatus: "NOT_STARTED" | "PENDING" | "VERIFIED" | "REJECTED";
  creditConsentAt?: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["user", "privileged", "admin", "director", "shareholder"], default: "user", required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  isActive: { type: Boolean, default: true },
  phone: { type: String, trim: true, maxlength: 24 },
  address: { type: String, trim: true, maxlength: 500 },
  kycStatus: {
    type: String,
    enum: ["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"],
    default: "NOT_STARTED",
  },
  creditConsentAt: Date,
}, { timestamps: true, strict: "throw" });

UserSchema.index({ assignedTo: 1, role: 1, isActive: 1 });

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);