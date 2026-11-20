import mongoose from "mongoose";
import { apiFailure, jsonError, objectIdField, readJson, stringField } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { canAccessBorrower, getAccessibleBorrowerIds, requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { MAX_CUSTOMER_DOCUMENT_BYTES, validateDocumentContent } from "@/lib/document-validation";
import { storageReferenceField } from "@/lib/storage-reference";
import {
  deleteCustomerDocumentBlob,
  getCustomerDocumentBlob,
  VercelBlobConfigurationError,
} from "@/lib/vercel-blob";
import { CUSTOMER_DOCUMENT_MIME_TYPES } from "@/models/CustomerDocument";
import CustomerDocument from "@/models/CustomerDocument";
import User from "@/models/User";

const categories = ["IDENTITY", "ADDRESS", "INCOME", "OTHER"] as const;

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

  try {
    const { value, error } = await readJson(request);
    if (error || !value) return jsonError(error ?? "Request body must be valid JSON.");
    const borrowerId = objectIdField(value.customerId, "Customer");
    if (!(await canAccessBorrower(actor, borrowerId))) {
      return jsonError("You cannot add documents for this customer.", 403);
    }
    const name = stringField(value.name, "Document name", 160);
    const categoryValue = value.category;
    if (typeof categoryValue !== "string" || !categories.includes(categoryValue as (typeof categories)[number])) {
      throw new TypeError("Choose a valid document category.");
    }
    const category = categoryValue as (typeof categories)[number];
    const mimeType = value.mimeType;
    if (typeof mimeType !== "string"
      || !CUSTOMER_DOCUMENT_MIME_TYPES.includes(mimeType as (typeof CUSTOMER_DOCUMENT_MIME_TYPES)[number])) {
      throw new TypeError("Documents must be PDF, JPEG, or PNG files.");
    }
    const pathname = storageReferenceField(value.pathname, "Blob pathname");
    if (!new RegExp(`^customer-documents/${borrowerId}/[0-9a-f-]{36}\\.(pdf|jpg|png)$`).test(pathname)) {
      throw new TypeError("The uploaded file reference is invalid for this customer.");
    }
    const expectedExtension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/jpeg" ? "jpg" : "png";
    if (!pathname.endsWith(`.${expectedExtension}`)) {
      throw new TypeError("The uploaded file type does not match its storage reference.");
    }
    const requestedSize = value.sizeBytes;
    if (typeof requestedSize !== "number" || !Number.isInteger(requestedSize)
      || requestedSize < 1 || requestedSize > MAX_CUSTOMER_DOCUMENT_BYTES) {
      throw new TypeError("The optimized document must be no larger than 10 MB.");
    }

    await dbConnect();
    const customer = await User.findOne({ _id: borrowerId, role: "user", isActive: true }).select("_id");
    if (!customer) return jsonError("Active customer was not found.", 404);
    if (await CustomerDocument.exists({ storageRef: pathname })) {
      return jsonError("This file has already been attached to a document.", 409);
    }

    const blob = await getCustomerDocumentBlob(pathname);
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return jsonError("The uploaded file could not be found in private Vercel Blob storage.", 409);
    }
    const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
    if (bytes.byteLength !== requestedSize || blob.blob.size !== requestedSize || blob.blob.contentType !== mimeType) {
      throw new TypeError("The uploaded file size or type could not be verified.");
    }
    validateDocumentContent(mimeType, bytes);
    const sizeBytes = bytes.byteLength;

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
            storageRef: pathname,
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
          if (!(await CustomerDocument.exists({ storageRef: pathname }))) {
            await deleteCustomerDocumentBlob(pathname);
          }
        } catch (cleanupError) {
          console.error("Vercel Blob cleanup failed after customer document save error:", cleanupError);
        }
        throw caught;
      }
    } finally {
      await session.endSession();
    }
    return Response.json({ documentId }, { status: 201 });
  } catch (caught) {
    if (caught instanceof VercelBlobConfigurationError) return jsonError(caught.message, 503);
    return apiFailure(caught);
  }
}
