import type { Metadata } from "next";
import CustomerDocumentsView from "@/components/customer-documents-view";
import PageHeading from "@/components/page-heading";

export const metadata: Metadata = { title: "Customer documents" };
export const instant = false;

export default function CustomerDocumentsPage() {
  return (
    <>
      <PageHeading eyebrow="Customer records" title="Customer documents" description="Keep customer document records and references to files in private external storage." />
      <CustomerDocumentsView />
    </>
  );
}
