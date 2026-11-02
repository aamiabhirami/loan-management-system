export const MAX_CUSTOMER_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function validateDocumentContent(mimeType: string, bytes: Uint8Array) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CUSTOMER_DOCUMENT_BYTES) {
    throw new TypeError("Choose a non-empty PDF, JPEG, or PNG file up to 10 MB.");
  }

  const valid = mimeType === "application/pdf"
    ? bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
    : mimeType === "image/jpeg"
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : mimeType === "image/png"
        ? bytes.length >= 8
          && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
          && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
        : false;
  if (!valid) throw new TypeError("The file content does not match a supported PDF, JPEG, or PNG type.");
}
