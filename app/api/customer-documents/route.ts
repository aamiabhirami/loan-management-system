import mongoose from "mongoose";
import {
  apiFailure,
  jsonError,
  objectIdField,
  stringField,
} from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { canAccessBorrower, getAccessibleBorrowerIds, requireApiActor } from "@/lib/authz";
import {
  CloudinaryConfigurationError,
  deleteCustomerDocument,
  uploadCustomerDocument,
} from "@/lib/cloudinary";
import dbConnect from "@/lib/db";
import { MAX_CUSTOMER_DOCUMENT_BYTES, validateDocumentContent } from "@/lib/document-validation";
import { CUSTOMER_DOCUMENT_MIME_TYPES } from "@/models/CustomerDocument";
import CustomerDocument from "@/models/CustomerDocument";
import User from "@/models/User";
import { randomUUID } from "node:crypto";

const categories = ["IDENTITY", "ADDRESS", "INCOME", "OTHER"] as const;
const MAX_REQUEST_BYTES = MAX_CUSTOMER_DOCUMENT_BYTES + 256 * 1024;

export async function GET(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  await dbConnect();
  const borrowerIds = await getAccessibleBorrowerIds(actor);
  const requestedCustomer = new URL(request.url).searchParams.get("customerId");
  if (requestedCustomer && !mongoose.isValidObjectId(requestedCustomer)) {
    return jsonError("Customer identifier is invalid.");
  }
  if (requestedCustomer && !(await canAccessBorrower(actor, requestedCustomer))) {
    return jsonError("You cannot view documents for this customer.", 403);
  }
  const filter = {
    isActive: true,
    ...(requestedCustomer ? { borrower: requestedCustomer } : borrowerIds ? { borrower: { $in: borrowerIds } } : {}),
  };
  const documents = await CustomerDocument.find(filter)
    .select("-storageRef -cloudinaryPublicId -cloudinaryAssetId -cloudinaryFormat -cloudinaryVersion")
    .populate("borrower", "name")
    .populate("createdBy", "name")
    .sort({ createdAt: -1 })
    .lean();
  return Response.json({ documents }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonError("Upload must be no larger than 10 MB.", 413);
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Upload request must use valid multipart form data.");
  }

  try {
    const borrowerId = objectIdField(formData.get("customerId"), "Customer");
    if (!(await canAccessBorrower(actor, borrowerId))) {
      return jsonError("You cannot add documents for this customer.", 403);
    }
    const name = stringField(formData.get("name"), "Document name", 160);
    const categoryValue = formData.get("category");
    if (typeof categoryValue !== "string" || !categories.includes(categoryValue as (typeof categories)[number])) {
      throw new TypeError("Choose a valid document category.");
    }
    const category = categoryValue as (typeof categories)[number];
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new TypeError("Choose a PDF, JPEG, or PNG document to upload.");
    }
    const mimeType = file.type;
    if (!CUSTOMER_DOCUMENT_MIME_TYPES.includes(mimeType as (typeof CUSTOMER_DOCUMENT_MIME_TYPES)[number])) {
      throw new TypeError("Documents must be PDF, JPEG, or PNG files.");
    }
    if (!Number.isInteger(file.size) || file.size < 1 || file.size > MAX_CUSTOMER_DOCUMENT_BYTES) {
      throw new TypeError("Choose a non-empty document no larger than 10 MB.");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) throw new TypeError("Uploaded file size could not be verified.");
    validateDocumentContent(mimeType, bytes);
    const sizeBytes = bytes.byteLength;

    await dbConnect();
    const customer = await User.findOne({ _id: borrowerId, role: "user", isActive: true }).select("_id");
    if (!customer) return jsonError("Active customer was not found.", 404);
    const uploadId = randomUUID();
    const cloudAsset = await uploadCustomerDocument(bytes, borrowerId, uploadId);
    const session = await mongoose.startSession();
    let documentId = "";
    try {
      try {
        await session.withTransaction(async () => {
          const [document] = await CustomerDocument.create([{
            borrower: borrowerId,
            name,
            category,
            mimeType,
            sizeBytes,
            cloudinaryPublicId: cloudAsset.public_id,
            cloudinaryAssetId: cloudAsset.asset_id,
            cloudinaryFormat: cloudAsset.format,
            cloudinaryVersion: cloudAsset.version,
            createdBy: actor.id,
          }], { session });
          documentId = document._id.toString();
          await recordAudit({
            actorId: actor.id,
            action: "CUSTOMER_DOCUMENT_ADDED",
            targetEntity: "CustomerDocument",
            entityId: documentId,
            metadata: { category, mimeType, sizeBytes },
          }, session);
        });
      } catch (caught) {
        try {
          await deleteCustomerDocument(cloudAsset.public_id);
        } catch (cleanupError) {
          console.error("Cloudinary cleanup failed after customer document save error:", cleanupError);
        }
        throw caught;
      }
    } finally {
      await session.endSession();
    }
    return Response.json({ documentId }, { status: 201 });
  } catch (caught) {
    if (caught instanceof CloudinaryConfigurationError) return jsonError(caught.message, 503);
    return apiFailure(caught);
  }
}
