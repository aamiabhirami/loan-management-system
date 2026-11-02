import mongoose from "mongoose";
import { apiFailure, jsonError } from "@/lib/api";
import { canAccessBorrower, requireApiActor } from "@/lib/authz";
import {
  CloudinaryConfigurationError,
  createCustomerDocumentDownloadUrl,
} from "@/lib/cloudinary";
import dbConnect from "@/lib/db";
import CustomerDocument from "@/models/CustomerDocument";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  try {
    const { documentId } = await params;
    if (!mongoose.isValidObjectId(documentId)) return jsonError("Document identifier is invalid.");
    await dbConnect();
    const document = await CustomerDocument.findOne({ _id: documentId, isActive: true })
      .select("borrower cloudinaryPublicId cloudinaryFormat");
    if (!document) return jsonError("Document not found.", 404);
    if (!(await canAccessBorrower(actor, document.borrower.toString()))) {
      return jsonError("You cannot download documents for this customer.", 403);
    }
    if (!document.cloudinaryPublicId || !document.cloudinaryFormat) {
      return jsonError("This document is not available in Cloudinary.", 409);
    }
    const downloadUrl = createCustomerDocumentDownloadUrl(
      document.cloudinaryPublicId,
      document.cloudinaryFormat,
    );
    const redirect = Response.redirect(downloadUrl, 302);
    redirect.headers.set("Cache-Control", "private, no-store");
    redirect.headers.set("Referrer-Policy", "no-referrer");
    return redirect;
  } catch (caught) {
    if (caught instanceof CloudinaryConfigurationError) return jsonError(caught.message, 503);
    return apiFailure(caught);
  }
}
