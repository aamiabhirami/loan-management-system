import mongoose from "mongoose";
import { apiFailure, jsonError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { canAccessBorrower, requireApiActor } from "@/lib/authz";
import { deleteCustomerDocument } from "@/lib/cloudinary";
import dbConnect from "@/lib/db";
import CustomerDocument from "@/models/CustomerDocument";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  try {
    const { documentId } = await params;
    if (!mongoose.isValidObjectId(documentId)) return jsonError("Document identifier is invalid.");
    await dbConnect();
    const existing = await CustomerDocument.findOne({ _id: documentId, isActive: true })
      .select("borrower cloudinaryPublicId");
    if (!existing) return jsonError("Document not found.", 404);
    if (!(await canAccessBorrower(actor, existing.borrower.toString()))) {
      return jsonError("You cannot remove documents for this customer.", 403);
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const document = await CustomerDocument.findOne({ _id: documentId, isActive: true }).session(session);
        if (!document) throw new TypeError("Document not found.");
        document.isActive = false;
        await document.save({ session });
        await recordAudit({
          actorId: actor.id,
          action: "CUSTOMER_DOCUMENT_REMOVED",
          targetEntity: "CustomerDocument",
          entityId: documentId,
          metadata: { category: document.category },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    if (existing.cloudinaryPublicId) {
      try {
        await deleteCustomerDocument(existing.cloudinaryPublicId);
      } catch (caught) {
        console.error("Cloudinary deletion failed after customer document removal:", caught);
        return jsonError("The document was removed from the list, but Cloudinary could not delete the file. Contact your administrator.", 502);
      }
    }
    return Response.json({ message: "Document and Cloudinary file removed." });
  } catch (caught) {
    return apiFailure(caught);
  }
}
