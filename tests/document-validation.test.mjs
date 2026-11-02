import assert from "node:assert/strict";
import test from "node:test";
import { validateDocumentContent } from "../lib/document-validation.ts";

test("document validation accepts PDF, JPEG, and PNG file signatures", () => {
  assert.doesNotThrow(() => validateDocumentContent("application/pdf", Buffer.from("%PDF-1.7")));
  assert.doesNotThrow(() => validateDocumentContent("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])));
  assert.doesNotThrow(() => validateDocumentContent("image/png", Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ])));
});

test("document validation rejects unsupported or mismatched content", () => {
  assert.throws(() => validateDocumentContent("image/png", Buffer.from("%PDF-1.7")), /does not match/);
  assert.throws(() => validateDocumentContent("image/gif", Buffer.from([0x47, 0x49, 0x46])), /does not match/);
  assert.throws(() => validateDocumentContent("application/pdf", Buffer.alloc(0)), /non-empty/);
});

test("document validation enforces the 10 MB maximum", () => {
  assert.throws(
    () => validateDocumentContent("image/jpeg", Buffer.alloc(10 * 1024 * 1024 + 1)),
    /up to 10 MB/,
  );
});
