import AppSidebar from "@/components/app-sidebar";
import SignOutButton from "@/components/sign-out-button";
import { requireActor } from "@/lib/authz";
import { roleLabel } from "@/lib/roles";

export const instant = false;

export default async function WorkspaceLayout({
  children,
}: LayoutProps<"/">) {
  const actor = await requireActor();
  const initials = actor.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-[#f5f7f5]">
      <AppSidebar role={actor.role} />
      <div className="min-h-screen pl-[76px] xl:pl-[244px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#e8ede9] bg-white/95 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-[#67a778]" />
            <span className="text-xs font-medium text-[#788b82]">Lending workspace</span>
            <span className="hidden rounded-md bg-[#f0f4f1] px-2 py-1 text-[10px] font-medium tracking-wide text-[#648074] sm:inline-flex">
              INDIA · INR
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-[#25443a]">{actor.name}</p>
              <p className="mt-0.5 text-[11px] text-[#87968f]">{roleLabel(actor.role)}</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e6f0e7] text-xs font-semibold text-[#467558]">
              {initials}
            </span>
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
