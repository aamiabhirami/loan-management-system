import mongoose from "mongoose";
import { apiFailure, jsonError } from "@/lib/api";
import { canAccessBorrower, requireApiActor } from "@/lib/authz";
import {
  CloudinaryConfigurationError,
  createCustomerDocumentDownloadUrl,
} from "@/lib/cloudinary";
import dbConnect from "@/lib/db";
import {
  getCustomerDocumentBlob,
  VercelBlobConfigurationError,
} from "@/lib/vercel-blob";
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
      .select("borrower name mimeType storageRef cloudinaryPublicId cloudinaryFormat");
    if (!document) return jsonError("Document not found.", 404);
    if (!(await canAccessBorrower(actor, document.borrower.toString()))) {
      return jsonError("You cannot download documents for this customer.", 403);
    }
    if (document.storageRef) {
      const blob = await getCustomerDocumentBlob(document.storageRef);
      if (!blob || blob.statusCode !== 200 || !blob.stream) {
        return jsonError("This document is not available in private Vercel Blob storage.", 404);
      }
      const extension = document.mimeType === "application/pdf"
        ? "pdf"
        : document.mimeType === "image/jpeg" ? "jpg" : "png";
      return new Response(blob.stream, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${document.name}.${extension}`)}`,
          "Content-Type": document.mimeType,
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (!document.cloudinaryPublicId || !document.cloudinaryFormat) {
      return jsonError("This document has no available storage file.", 409);
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
    if (caught instanceof VercelBlobConfigurationError) return jsonError(caught.message, 503);
    return apiFailure(caught);
  }
}
