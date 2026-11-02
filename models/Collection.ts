import mongoose, { Schema, type Document } from "mongoose";

export interface ICollection extends Document {
  loan: mongoose.Types.ObjectId;
  borrower: mongoose.Types.ObjectId;
  collectedBy: mongoose.Types.ObjectId;
  idempotencyKey: string;
  receiptCode: string;
  amountPaise: number;
  channel: "CASH" | "UPI" | "BANK_TRANSFER";
  reference?: string;
  allocations: {
    installmentNo: number;
    principalPaise: number;
    interestPaise: number;
    penaltyPaise: number;
  }[];
  status: "RECORDED" | "REVERSED";
  isSandbox: boolean;
  collectedAt: Date;
  createdAt: Date;
}

const AllocationSchema = new Schema({
  installmentNo: { type: Number, required: true },
  principalPaise: { type: Number, required: true, min: 0 },
  interestPaise: { type: Number, required: true, min: 0 },
  penaltyPaise: { type: Number, required: true, min: 0 },
}, { _id: false });

const CollectionSchema = new Schema<ICollection>({
  loan: { type: Schema.Types.ObjectId, ref: "Loan", required: true, index: true, immutable: true },
  borrower: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, immutable: true },
  collectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  idempotencyKey: { type: String, required: true, immutable: true },
  receiptCode: { type: String, required: true, unique: true, immutable: true },
  amountPaise: { type: Number, required: true, min: 1, immutable: true },
  channel: { type: String, enum: ["CASH", "UPI", "BANK_TRANSFER"], required: true, immutable: true },
  reference: { type: String, trim: true, maxlength: 80, immutable: true },
  allocations: { type: [AllocationSchema], required: true, immutable: true },
  status: { type: String, enum: ["RECORDED", "REVERSED"], default: "RECORDED", immutable: true },
  isSandbox: { type: Boolean, required: true, default: false, immutable: true },
  collectedAt: { type: Date, required: true, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw" });

CollectionSchema.index({ loan: 1, collectedAt: -1 });
CollectionSchema.index({ idempotencyKey: 1 }, { unique: true });

export default mongoose.models.Collection
  || mongoose.model<ICollection>("Collection", CollectionSchema);
