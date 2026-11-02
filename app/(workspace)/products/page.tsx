import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PageHeading from "@/components/page-heading";
import ProductsView from "@/components/products-view";
import { requireActor } from "@/lib/authz";
import { isOrganizationAdmin } from "@/lib/roles";

export const metadata: Metadata = { title: "Loan products" };
export const instant = false;

export default async function ProductsPage() {
  const actor = await requireActor();
  if (!isOrganizationAdmin(actor.role)) redirect("/dashboard");
  return (
    <>
      <PageHeading eyebrow="Administration" title="Loan products" description="Define responsible lending terms and repayment policies." />
      <ProductsView />
    </>
  );
}
