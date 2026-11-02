import mongoose, { Schema, type Document } from "mongoose";

export interface ICreditCheck extends Document {
  borrower: mongoose.Types.ObjectId;
  loan: mongoose.Types.ObjectId;
  provider: string;
  status: "SANDBOX" | "COMPLETED" | "FAILED";
  checkedAt: Date;
  consentedAt: Date;
  providerReference: string;
  score?: number;
  decisionEligible: boolean;
}

const CreditCheckSchema = new Schema<ICreditCheck>({
  borrower: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, immutable: true },
  loan: { type: Schema.Types.ObjectId, ref: "Loan", required: true, index: true, immutable: true },
  provider: { type: String, required: true, immutable: true },
  status: { type: String, enum: ["SANDBOX", "COMPLETED", "FAILED"], required: true, immutable: true },
  checkedAt: { type: Date, required: true, immutable: true },
  consentedAt: { type: Date, required: true, immutable: true },
  providerReference: { type: String, required: true, immutable: true },
  score: { type: Number, min: 300, max: 900, immutable: true },
  decisionEligible: { type: Boolean, required: true, immutable: true, default: false },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw" });

export default mongoose.models.CreditCheck
  || mongoose.model<ICreditCheck>("CreditCheck", CreditCheckSchema);
