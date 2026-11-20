"use client";

import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";
import { compressCustomerDocument } from "@/lib/document-compression";
import {
  MAX_CUSTOMER_DOCUMENT_BYTES,
  MAX_CUSTOMER_DOCUMENT_IMAGE_INPUT_BYTES,
} from "@/lib/document-validation";
import type { UserRole } from "@/lib/roles";

type CustomerRow = { _id: string; name: string; role: UserRole };
type DocumentRow = {
  _id: string;
  borrower: { name: string };
  name: string;
  category: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

const categoryLabels: Record<string, string> = {
  IDENTITY: "Identity",
  ADDRESS: "Address",
  INCOME: "Income",
  OTHER: "Other",
};

export default function CustomerDocumentsView() {
  const { data: usersData } = useResource<{ users: CustomerRow[] }>("/api/users");
  const customers = (usersData?.users ?? []).filter((user) => user.role === "user");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const selectedCustomerId = customerId ?? customers[0]?._id ?? "";
  const { data, loading, error, reload } = useResource<{ documents: DocumentRow[] }>(
    `/api/customer-documents${selectedCustomerId ? `?customerId=${encodeURIComponent(selectedCustomerId)}` : ""}`,
  );
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [failure, setFailure] = useState("");
  const [feedback, setFeedback] = useState("");

  async function addDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const file = values.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setFailure("Choose a document to upload.");
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setFailure("Choose a PDF, JPEG, or PNG document.");
      return;
    }
    const isImage = file.type === "image/jpeg" || file.type === "image/png";
    const inputLimit = isImage ? MAX_CUSTOMER_DOCUMENT_IMAGE_INPUT_BYTES : MAX_CUSTOMER_DOCUMENT_BYTES;
    if (file.size > inputLimit) {
      setFailure(isImage ? "Choose an image no larger than 50 MB before optimization." : "Choose a PDF no larger than 10 MB.");
      return;
    }
    setBusy(true);
    setFailure("");
    setFeedback("");
    try {
      const optimizedFile = await compressCustomerDocument(file);
      if (optimizedFile.size < 1 || optimizedFile.size > MAX_CUSTOMER_DOCUMENT_BYTES) {
        throw new Error("The optimized document must be no larger than 10 MB. Choose a smaller or clearer source file.");
      }

      const uploadResponse = await fetch("/api/customer-documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          mimeType: optimizedFile.type,
          sizeBytes: optimizedFile.size,
          originalSizeBytes: file.size,
        }),
      });
      const upload = await uploadResponse.json() as { error?: string; pathname?: string; uploadUrl?: string };
      if (!uploadResponse.ok || !upload.pathname || !upload.uploadUrl) {
        throw new Error(upload.error ?? "A secure upload could not be prepared.");
      }

      const blobResponse = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": optimizedFile.type },
        body: optimizedFile,
      });
      if (!blobResponse.ok) throw new Error("The file could not be uploaded to private Vercel Blob storage.");

      const response = await fetch("/api/customer-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          name: values.get("name"),
          category: values.get("category"),
          mimeType: optimizedFile.type,
          sizeBytes: optimizedFile.size,
          pathname: upload.pathname,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Document could not be saved.");
      form.reset();
      const sizeMessage = optimizedFile.size < file.size
        ? ` Optimized from ${(file.size / (1024 * 1024)).toFixed(2)} MB to ${(optimizedFile.size / (1024 * 1024)).toFixed(2)} MB.`
        : "";
      setFeedback(`Document uploaded to private Vercel Blob storage.${sizeMessage}`);
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Document could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(document: DocumentRow) {
    setBusyId(document._id);
    setFailure("");
    setFeedback("");
    try {
      const response = await fetch(`/api/customer-documents/${document._id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Document could not be removed.");
      setFeedback("Document and its stored file removed.");
      await reload();
    } catch (caught) {
      await reload();
      setFailure(caught instanceof Error ? caught.message : "Document could not be removed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      {customers.length > 1 && <label className="block max-w-md text-xs font-semibold text-[#526d61]">Customer<select className="form-control mt-1" onChange={(event) => setCustomerId(event.target.value)} value={selectedCustomerId}><option value="">Select customer</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></label>}
      {selectedCustomerId && <section className="rounded-2xl border border-[#dfe9e2] bg-white">
        <div className="flex items-center gap-3 border-b border-[#edf1ee] px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><Plus className="h-4 w-4" /></span>
          <div><h2 className="text-sm font-semibold text-[#24463a]">Upload a customer document</h2><p className="mt-1 text-xs text-[#8a9992]">Files are compressed on your device and uploaded directly to private Vercel Blob storage.</p></div>
        </div>
        <form className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3" onSubmit={addDocument}>
          <label className="text-xs font-semibold text-[#526d61]">Document name<input className="form-control" maxLength={160} name="name" required /></label>
          <label className="text-xs font-semibold text-[#526d61]">Category<select className="form-control" name="category" required><option value="IDENTITY">Identity</option><option value="ADDRESS">Address</option><option value="INCOME">Income</option><option value="OTHER">Other</option></select></label>
          <label className="text-xs font-semibold text-[#526d61]">Choose file<input className="form-control file:mr-3 file:border-0 file:bg-transparent file:text-xs" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" name="file" required type="file" /></label>
          <div className="flex items-end"><button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#245548] disabled:opacity-60 sm:h-10" disabled={busy} type="submit">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? "Optimizing & uploading…" : "Upload document"}</button></div>
          <p className="sm:col-span-2 xl:col-span-3 text-[11px] leading-5 text-[#85938c]">Allowed types: PDF, JPEG, PNG. Images up to 50 MB are resized to 2,800 px at moderate quality; PDFs are losslessly optimized without rasterizing pages. Optimized files must be no larger than 10 MB. Uploads are private; downloads require an authorized sign-in.</p>
        </form>
      </section>}

      {(failure || feedback) && <InlineMessage message={failure || feedback} tone={failure ? "error" : "success"} />}
      <section className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
        <div className="border-b border-[#edf1ee] px-5 py-4"><h2 className="text-sm font-semibold text-[#24463a]">Customer documents</h2><p className="mt-1 text-xs text-[#8a9992]">{data?.documents.length ?? 0} documents in your access scope</p></div>
        {loading ? <div className="flex justify-center py-12"><LoaderCircle className="h-5 w-5 animate-spin text-[#71937c]" /></div>
          : error ? <div className="p-5"><InlineMessage message={error} /></div>
            : !data?.documents.length ? <p className="px-5 py-12 text-center text-sm text-[#87958e]">{selectedCustomerId ? "No documents uploaded for this customer yet." : "Select a customer to view documents."}</p>
              : <>
                <div className="divide-y divide-[#edf1ee] sm:hidden">
                  {data.documents.map((document) => (
                    <article className="space-y-3 p-4" key={document._id}>
                      <div className="min-w-0"><p className="break-words text-sm font-semibold text-[#29483d]">{document.name}</p><p className="mt-1 break-words text-xs text-[#73857b]">{document.borrower.name}</p></div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#f0f3f0] pt-3 text-xs">
                        <div><dt className="text-[#91a098]">Category</dt><dd className="mt-1 text-[#73857b]">{categoryLabels[document.category] ?? document.category}</dd></div>
                        <div><dt className="text-[#91a098]">File</dt><dd className="mt-1 text-[#73857b]">{document.mimeType.split("/")[1].toUpperCase()} · {(document.sizeBytes / (1024 * 1024)).toFixed(2)} MB</dd></div>
                        <div className="col-span-2"><dt className="text-[#91a098]">Uploaded</dt><dd className="mt-1 text-[#73857b]">{new Date(document.createdAt).toLocaleDateString("en-IN", { timeZone: "UTC" })}</dd></div>
                      </dl>
                      <div className="flex items-center gap-4 border-t border-[#f0f3f0] pt-3">
                        <a className="inline-flex min-h-11 items-center text-sm font-semibold text-[#4b8062] hover:underline" href={`/api/customer-documents/${document._id}/download`}>Download</a>
                        <button aria-label={`Remove ${document.name}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#9f5f52] hover:text-red-700 disabled:opacity-50" disabled={busyId === document._id} onClick={() => removeDocument(document)} type="button"><Trash2 className="h-4 w-4" />Remove</button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[850px] text-left">
                <thead className="bg-[#f8faf8] text-[10px] font-semibold uppercase tracking-[0.11em] text-[#87968e]"><tr><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Document</th><th className="px-5 py-3">Category / type</th><th className="px-5 py-3">Size</th><th className="px-5 py-3">Actions</th></tr></thead>
                <tbody className="divide-y divide-[#f0f3f0]">{data.documents.map((document) => <tr key={document._id}>
                  <td className="px-5 py-4 text-sm text-[#49685b]">{document.borrower.name}</td>
                  <td className="px-5 py-4"><p className="text-sm font-medium text-[#29483d]">{document.name}</p><p className="mt-1 text-[10px] text-[#8a9992]">{new Date(document.createdAt).toLocaleDateString("en-IN", { timeZone: "UTC" })}</p></td>
                  <td className="px-5 py-4 text-xs text-[#73857b]">{categoryLabels[document.category] ?? document.category} · {document.mimeType.split("/")[1].toUpperCase()}</td>
                  <td className="px-5 py-4 text-xs text-[#73857b]">{(document.sizeBytes / (1024 * 1024)).toFixed(2)} MB</td>
                  <td className="space-x-3 px-5 py-4"><a className="text-xs font-semibold text-[#4b8062] hover:underline" href={`/api/customer-documents/${document._id}/download`}>Download</a><button aria-label={`Remove ${document.name}`} className="inline-flex items-center text-[#9f5f52] hover:text-red-700 disabled:opacity-50" disabled={busyId === document._id} onClick={() => removeDocument(document)} type="button"><Trash2 className="h-4 w-4" /></button></td>
                </tr>)}</tbody>
              </table></div>
              </>}
      </section>
    </div>
  );
}
