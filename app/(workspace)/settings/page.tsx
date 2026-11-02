import type { Metadata } from "next";
import PageHeading from "@/components/page-heading";
import ProfileView from "@/components/profile-view";

export const metadata: Metadata = { title: "Account settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeading eyebrow="Your account" title="Account settings" description="Manage your personal details and sign-in credentials." />
      <ProfileView />
    </>
  );
}
