import mongoose, { Schema, type Document } from "mongoose";
import type { DayCountBasis, RepaymentFrequency } from "@/lib/finance";

export type LoanStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ACTIVE"
  | "REJECTED"
  | "CLOSED"
  | "DEFAULTED";

export interface IInstallment {
  installmentNo: number;
  dueDate: Date;
  principalDuePaise: number;
  interestDuePaise: number;
  totalDuePaise: number;
  paidPaise: number;
  principalPaidPaise: number;
  interestPaidPaise: number;
  penaltyAssessedPaise: number;
  penaltyPaidPaise: number;
  status: "PENDING" | "PAID";
  paidAt?: Date;
}

export interface ILoan extends Document {
  borrower: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  group?: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  assignedOfficer?: mongoose.Types.ObjectId;
  principalPaise: number;
  annualInterestRatePercent: number;
  householdMonthlyIncomePaise: number;
  existingMonthlyDebtPaise: number;
  estimatedMonthlyInstallmentPaise: number;
  estimatedMonthlyDebtServicePaise: number;
  debtToIncomePercent: number;
  affordabilityPassed: boolean;
  tenureMonths: number;
  frequency: RepaymentFrequency;
  paymentWeekday?: number;
  paymentMonthDate?: number;
  dayCountBasis: DayCountBasis;
  status: LoanStatus;
  creditCheck?: mongoose.Types.ObjectId;
  schedule: IInstallment[];
  disbursementMode?: "SANDBOX" | "LIVE";
  disbursedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InstallmentSchema = new Schema<IInstallment>({
  installmentNo: { type: Number, required: true, min: 1 },
  dueDate: { type: Date, required: true },
  principalDuePaise: { type: Number, required: true, min: 0 },
  interestDuePaise: { type: Number, required: true, min: 0 },
  totalDuePaise: { type: Number, required: true, min: 0 },
  paidPaise: { type: Number, required: true, min: 0, default: 0 },
  principalPaidPaise: { type: Number, required: true, min: 0, default: 0 },
  interestPaidPaise: { type: Number, required: true, min: 0, default: 0 },
  penaltyAssessedPaise: { type: Number, required: true, min: 0, default: 0 },
  penaltyPaidPaise: { type: Number, required: true, min: 0, default: 0 },
  status: { type: String, enum: ["PENDING", "PAID"], default: "PENDING" },
  paidAt: Date,
}, { _id: false });

const LoanSchema = new Schema<ILoan>({
  borrower: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  product: { type: Schema.Types.ObjectId, ref: "LoanProduct", required: true },
  group: { type: Schema.Types.ObjectId, ref: "Group", default: null },
  requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  assignedOfficer: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  principalPaise: { type: Number, required: true, min: 1 },
  annualInterestRatePercent: { type: Number, required: true, min: 0, max: 100 },
  householdMonthlyIncomePaise: { type: Number, required: true, min: 1 },
  existingMonthlyDebtPaise: { type: Number, required: true, min: 0 },
  estimatedMonthlyInstallmentPaise: { type: Number, required: true, min: 0 },
  estimatedMonthlyDebtServicePaise: { type: Number, required: true, min: 0 },
  debtToIncomePercent: { type: Number, required: true, min: 0 },
  affordabilityPassed: { type: Boolean, required: true },
  tenureMonths: { type: Number, required: true, min: 1, max: 120 },
  frequency: { type: String, enum: ["WEEKLY", "FORTNIGHTLY", "MONTHLY"], required: true },
  paymentWeekday: { type: Number, min: 0, max: 6 },
  paymentMonthDate: { type: Number, min: 1, max: 31 },
  dayCountBasis: { type: String, enum: ["ACTUAL_365", "ACTUAL_360"], required: true },
  status: {
    type: String,
    enum: ["PENDING_APPROVAL", "APPROVED", "ACTIVE", "REJECTED", "CLOSED", "DEFAULTED"],
    default: "PENDING_APPROVAL",
    index: true,
  },
  creditCheck: { type: Schema.Types.ObjectId, ref: "CreditCheck", default: null },
  schedule: { type: [InstallmentSchema], default: [] },
  disbursementMode: { type: String, enum: ["SANDBOX", "LIVE"] },
  disbursedAt: Date,
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  approvedAt: Date,
  rejectionReason: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true, strict: "throw" });

LoanSchema.index({ borrower: 1, status: 1 });

export default mongoose.models.Loan || mongoose.model<ILoan>("Loan", LoanSchema);
