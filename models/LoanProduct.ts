import mongoose, { Schema, type Document } from "mongoose";
import type { DayCountBasis, RepaymentFrequency } from "@/lib/finance";

export interface ILoanProduct extends Document {
  name: string;
  code: string;
  description?: string;
  minPrincipalPaise: number;
  maxPrincipalPaise: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  annualInterestRatePercent: number;
  maxDebtToIncomePercent: number;
  frequency: RepaymentFrequency;
  paymentWeekday?: number;
  paymentMonthDate?: number;
  dayCountBasis: DayCountBasis;
  graceDays: number;
  fixedLateFeePaise: number;
  penaltyAnnualRatePercent: number;
  penaltyCapPaise?: number;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const LoanProductSchema = new Schema<ILoanProduct>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  code: { type: String, required: true, uppercase: true, trim: true, maxlength: 24 },
  description: { type: String, trim: true, maxlength: 500 },
  minPrincipalPaise: { type: Number, required: true, min: 1 },
  maxPrincipalPaise: { type: Number, required: true, min: 1 },
  minTenureMonths: { type: Number, required: true, min: 1, max: 120 },
  maxTenureMonths: { type: Number, required: true, min: 1, max: 120 },
  annualInterestRatePercent: { type: Number, required: true, min: 0, max: 100 },
  maxDebtToIncomePercent: { type: Number, required: true, min: 1, max: 100, default: 50 },
  frequency: { type: String, enum: ["WEEKLY", "FORTNIGHTLY", "MONTHLY"], required: true },
  paymentWeekday: { type: Number, min: 0, max: 6 },
  paymentMonthDate: { type: Number, min: 1, max: 31 },
  dayCountBasis: { type: String, enum: ["ACTUAL_365", "ACTUAL_360"], required: true },
  graceDays: { type: Number, required: true, min: 0, max: 90, default: 0 },
  fixedLateFeePaise: { type: Number, required: true, min: 0, default: 0 },
  penaltyAnnualRatePercent: { type: Number, required: true, min: 0, max: 100, default: 0 },
  penaltyCapPaise: { type: Number, min: 0 },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true, strict: "throw" });

LoanProductSchema.index({ code: 1 }, { unique: true });

export default mongoose.models.LoanProduct
  || mongoose.model<ILoanProduct>("LoanProduct", LoanProductSchema);
