import "server-only";

import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import type { UploadApiResponse } from "cloudinary";

export class CloudinaryConfigurationError extends Error {
  constructor() {
    super("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
    this.name = "CloudinaryConfigurationError";
  }
}

function getCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new CloudinaryConfigurationError();
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return cloudinary;
}

export function uploadCustomerDocument(
  bytes: Buffer,
  borrowerId: string,
  documentId: string,
): Promise<UploadApiResponse> {
  const client = getCloudinary();
  return new Promise((resolve, reject) => {
    const upload = client.uploader.upload_stream({
      resource_type: "image",
      type: "authenticated",
      folder: `customer-documents/${borrowerId}`,
      public_id: documentId,
      overwrite: false,
      unique_filename: false,
    }, (error, result) => {
      if (error) reject(error);
      else if (!result) reject(new Error("Cloudinary returned no upload result."));
      else resolve(result);
    });
    Readable.from(bytes).pipe(upload);
  });
}

export async function deleteCustomerDocument(publicId: string) {
  const result = await getCloudinary().uploader.destroy(publicId, {
    resource_type: "image",
    type: "authenticated",
    invalidate: true,
  });
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary did not delete the document asset (result: ${result.result}).`);
  }
}

export function createCustomerDocumentDownloadUrl(publicId: string, format: string) {
  const client = getCloudinary();
  return client.utils.private_download_url(publicId, format, {
    resource_type: "image",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 60,
    attachment: true,
  });
}
