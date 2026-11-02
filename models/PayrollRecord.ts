import mongoose, { Schema, type Document } from "mongoose";

export interface IPayrollComponent {
  label: string;
  amountPaise: number;
}

export interface IPayrollRecord extends Document {
  employee: mongoose.Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  earnings: IPayrollComponent[];
  deductions: IPayrollComponent[];
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
  status: "DRAFT" | "PAID";
  paidAt?: Date;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ComponentSchema = new Schema<IPayrollComponent>({
  label: { type: String, required: true, trim: true, maxlength: 80 },
  amountPaise: { type: Number, required: true, min: 1 },
}, { _id: false });

const PayrollRecordSchema = new Schema<IPayrollRecord>({
  employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  periodStart: { type: Date, required: true, index: true },
  periodEnd: { type: Date, required: true },
  earnings: { type: [ComponentSchema], required: true },
  deductions: { type: [ComponentSchema], required: true },
  grossPaise: { type: Number, required: true, min: 1 },
  deductionsPaise: { type: Number, required: true, min: 0 },
  netPaise: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["DRAFT", "PAID"], default: "DRAFT", required: true },
  paidAt: Date,
  notes: { type: String, trim: true, maxlength: 1000 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true, strict: "throw" });

PayrollRecordSchema.index({ employee: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

export default mongoose.models.PayrollRecord
  || mongoose.model<IPayrollRecord>("PayrollRecord", PayrollRecordSchema);
