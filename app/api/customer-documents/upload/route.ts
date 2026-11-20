import { apiFailure, jsonError, objectIdField, readJson } from "@/lib/api";
import { canAccessBorrower, requireApiActor } from "@/lib/authz";
import {
  MAX_CUSTOMER_DOCUMENT_BYTES,
  MAX_CUSTOMER_DOCUMENT_IMAGE_INPUT_BYTES,
} from "@/lib/document-validation";
import {
  createCustomerDocumentUploadUrl,
  VercelBlobConfigurationError,
} from "@/lib/vercel-blob";
import dbConnect from "@/lib/db";
import { CUSTOMER_DOCUMENT_MIME_TYPES } from "@/models/CustomerDocument";
import User from "@/models/User";
import { randomUUID } from "node:crypto";

const extensions: Record<(typeof CUSTOMER_DOCUMENT_MIME_TYPES)[number], string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export async function POST(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;

  try {
    const { value, error } = await readJson(request);
    if (error || !value) return jsonError(error ?? "Request body must be valid JSON.");
    const borrowerId = objectIdField(value.customerId, "Customer");
    if (!(await canAccessBorrower(actor, borrowerId))) {
      return jsonError("You cannot add documents for this customer.", 403);
    }

    const mimeType = value.mimeType;
    if (typeof mimeType !== "string"
      || !CUSTOMER_DOCUMENT_MIME_TYPES.includes(mimeType as (typeof CUSTOMER_DOCUMENT_MIME_TYPES)[number])) {
      throw new TypeError("Documents must be PDF, JPEG, or PNG files.");
    }
    const sizeBytes = value.sizeBytes;
    const maxInputBytes = mimeType === "application/pdf"
      ? MAX_CUSTOMER_DOCUMENT_BYTES
      : MAX_CUSTOMER_DOCUMENT_IMAGE_INPUT_BYTES;
    if (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_CUSTOMER_DOCUMENT_BYTES) {
      throw new TypeError("The optimized document must be no larger than 10 MB.");
    }
    if (typeof value.originalSizeBytes !== "number"
      || !Number.isInteger(value.originalSizeBytes)
      || value.originalSizeBytes < sizeBytes
      || value.originalSizeBytes > maxInputBytes) {
      throw new TypeError("The original file exceeds the allowed size for this document type.");
    }

    await dbConnect();
    const customer = await User.findOne({ _id: borrowerId, role: "user", isActive: true }).select("_id");
    if (!customer) return jsonError("Active customer was not found.", 404);

    const pathname = `customer-documents/${borrowerId}/${randomUUID()}.${extensions[mimeType as (typeof CUSTOMER_DOCUMENT_MIME_TYPES)[number]]}`;
    const uploadUrl = await createCustomerDocumentUploadUrl(pathname, mimeType, sizeBytes);
    return Response.json({ pathname, uploadUrl }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (caught) {
    if (caught instanceof VercelBlobConfigurationError) return jsonError(caught.message, 503);
    return apiFailure(caught);
  }
}
