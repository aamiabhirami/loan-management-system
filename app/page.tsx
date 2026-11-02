import { getActor } from "@/lib/authz";
import { redirect } from "next/navigation";

export const instant = false;

export default async function Home() {
  const actor = await getActor();
  redirect(actor ? "/dashboard" : "/login");
}
