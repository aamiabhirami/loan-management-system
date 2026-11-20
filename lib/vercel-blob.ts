import "server-only";

import { del, get, issueSignedToken, presignUrl } from "@vercel/blob";

export class VercelBlobConfigurationError extends Error {
  constructor() {
    super("Vercel Blob is not configured. Connect a private Blob store or set BLOB_READ_WRITE_TOKEN for local development.");
    this.name = "VercelBlobConfigurationError";
  }
}

function ensureVercelBlobConfigured() {
  const hasOidcCredentials = Boolean(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID);
  if (!hasOidcCredentials && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new VercelBlobConfigurationError();
  }
}

export async function createCustomerDocumentUploadUrl(
  pathname: string,
  mimeType: string,
  sizeBytes: number,
) {
  ensureVercelBlobConfigured();
  const validUntil = Date.now() + 5 * 60 * 1000;
  const token = await issueSignedToken({
    pathname,
    operations: ["put"],
    allowedContentTypes: [mimeType],
    maximumSizeInBytes: sizeBytes,
    validUntil,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: "put",
    pathname,
    access: "private",
    allowedContentTypes: [mimeType],
    maximumSizeInBytes: sizeBytes,
    addRandomSuffix: false,
    allowOverwrite: false,
    validUntil,
  });
  return presignedUrl;
}

export async function getCustomerDocumentBlob(pathname: string) {
  ensureVercelBlobConfigured();
  return get(pathname, { access: "private" });
}

export async function deleteCustomerDocumentBlob(pathname: string) {
  ensureVercelBlobConfigured();
  await del(pathname);
}
