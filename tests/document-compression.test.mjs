import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { compressCustomerDocument } from "../lib/document-compression.ts";

test("PDF optimization preserves readable vector pages without increasing file size", async () => {
  const sourceDocument = await PDFDocument.create();
  const page = sourceDocument.addPage([612, 792]);
  page.drawText("Customer identity document");
  const sourceBytes = await sourceDocument.save({ useObjectStreams: false });
  const sourceFile = new File([sourceBytes], "identity.pdf", { type: "application/pdf" });

  const optimizedFile = await compressCustomerDocument(sourceFile);
  const optimizedDocument = await PDFDocument.load(await optimizedFile.arrayBuffer());

  assert.ok(optimizedFile.size <= sourceFile.size);
  assert.equal(optimizedDocument.getPageCount(), 1);
  assert.deepEqual(optimizedDocument.getPage(0).getSize(), { width: 612, height: 792 });
});
