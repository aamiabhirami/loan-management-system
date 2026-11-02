import mongoose, { Schema, type Document } from "mongoose";
import { MAX_CUSTOMER_DOCUMENT_BYTES } from "@/lib/document-validation";

export const CUSTOMER_DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export interface ICustomerDocument extends Document {
  borrower: mongoose.Types.ObjectId;
  name: string;
  category: "IDENTITY" | "ADDRESS" | "INCOME" | "OTHER";
  mimeType: (typeof CUSTOMER_DOCUMENT_MIME_TYPES)[number];
  sizeBytes: number;
  cloudinaryPublicId?: string;
  cloudinaryAssetId?: string;
  cloudinaryFormat?: string;
  cloudinaryVersion?: number;
  storageRef?: string;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
}

const CustomerDocumentSchema = new Schema<ICustomerDocument>({
  borrower: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, enum: ["IDENTITY", "ADDRESS", "INCOME", "OTHER"], required: true },
  mimeType: { type: String, enum: CUSTOMER_DOCUMENT_MIME_TYPES, required: true },
  sizeBytes: { type: Number, required: true, min: 1, max: MAX_CUSTOMER_DOCUMENT_BYTES },
  cloudinaryPublicId: { type: String, trim: true, maxlength: 300, immutable: true },
  cloudinaryAssetId: { type: String, trim: true, maxlength: 100, immutable: true },
  cloudinaryFormat: { type: String, trim: true, maxlength: 20, immutable: true },
  cloudinaryVersion: { type: Number, min: 1, immutable: true },
  storageRef: { type: String, trim: true, maxlength: 300 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, strict: "throw" });

CustomerDocumentSchema.index({ borrower: 1, createdAt: -1 });

export default mongoose.models.CustomerDocument
  || mongoose.model<ICustomerDocument>("CustomerDocument", CustomerDocumentSchema);
