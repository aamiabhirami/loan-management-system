import type { Metadata } from "next";
import CollectionsView from "@/components/collections-view";
import PageHeading from "@/components/page-heading";
import { requireActor } from "@/lib/authz";

export const metadata: Metadata = { title: "Collections" };
export const instant = false;

export default async function CollectionsPage() {
  const actor = await requireActor();
  return (
    <>
      <PageHeading eyebrow="Servicing" title="Collections" description="Review receipts or record a field collection against due installments." />
      <CollectionsView role={actor.role} />
    </>
  );
}
