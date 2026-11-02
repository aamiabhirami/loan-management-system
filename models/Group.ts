import mongoose, { Schema, type Document } from "mongoose";

export interface IGroup extends Document {
  name: string;
  centerName: string;
  members: mongoose.Types.ObjectId[];
  assignedOfficer: mongoose.Types.ObjectId;
  meetingDay?: string;
  isActive: boolean;
  createdAt: Date;
}

const GroupSchema = new Schema<IGroup>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  centerName: { type: String, required: true, trim: true, maxlength: 120 },
  members: [{ type: Schema.Types.ObjectId, ref: "User" }],
  assignedOfficer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  meetingDay: { type: String, enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, strict: "throw" });

export default mongoose.models.Group || mongoose.model<IGroup>("Group", GroupSchema);
