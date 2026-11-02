import mongoose, { Schema, type Document } from "mongoose";

export interface IExpense extends Document {
  category: string;
  amountPaise: number;
  incurredAt: Date;
  payee: string;
  notes?: string;
  receiptStorageRef?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ExpenseSchema = new Schema<IExpense>({
  category: { type: String, required: true, trim: true, maxlength: 80, index: true },
  amountPaise: { type: Number, required: true, min: 1 },
  incurredAt: { type: Date, required: true, index: true },
  payee: { type: String, required: true, trim: true, maxlength: 120 },
  notes: { type: String, trim: true, maxlength: 1000 },
  receiptStorageRef: { type: String, trim: true, maxlength: 300 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
}, { timestamps: true, strict: "throw" });

ExpenseSchema.index({ incurredAt: -1, createdAt: -1 });

export default mongoose.models.Expense || mongoose.model<IExpense>("Expense", ExpenseSchema);
