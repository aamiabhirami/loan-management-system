"use client";

import { PDFDocument } from "pdf-lib";

export async function compressCustomerDocument(file: File) {
  if (file.type === "application/pdf") {
    const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
    const optimizedBytes = await pdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false,
    });
    if (optimizedBytes.byteLength >= file.size) return file;
    const fileBytes = new Uint8Array(optimizedBytes.byteLength);
    fileBytes.set(optimizedBytes);
    return new File([fileBytes], file.name, { type: file.type, lastModified: file.lastModified });
  }

  const { default: imageCompression } = await import("browser-image-compression");
  const optimizedImage = await imageCompression(file, {
    maxSizeMB: 8.5,
    maxWidthOrHeight: 2800,
    initialQuality: 0.9,
    maxIteration: 5,
    preserveExif: false,
    useWebWorker: false,
  });
  return optimizedImage.size < file.size ? optimizedImage : file;
}
