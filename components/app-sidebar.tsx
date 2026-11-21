"use client";

import {
  Activity,
  BadgeIndianRupee,
  Banknote,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  Menu,
  UsersRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ORGANIZATION_ADMIN_ROLES, type UserRole } from "@/lib/roles";

type SidebarProps = {
  role: UserRole;
};

function roleAllowed(roles: readonly UserRole[], role: UserRole) {
  return roles.includes(role);
}

const sections: { title: string; links: { label: string; href: string; icon: LucideIcon; roles: readonly UserRole[] }[] }[] = [
  {
    title: "WORKSPACE",
    links: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard, roles: ["user", "privileged", "admin"] },
      { label: "Loan accounts", href: "/loans", icon: BriefcaseBusiness, roles: ["user", "privileged", "admin"] },
      { label: "Collections", href: "/collections", icon: Banknote, roles: ["user", "privileged", "admin"] },
      { label: "Customers", href: "/customers", icon: UsersRound, roles: ["privileged", "admin"] },
      { label: "JLG groups", href: "/groups", icon: Users, roles: ["privileged", "admin"] },
    ],
  },
  {
    title: "INSIGHTS",
    links: [
      { label: "Portfolio reports", href: "/reports", icon: ChartNoAxesCombined, roles: ["privileged", "admin"] },
      { label: "Audit trail", href: "/audit", icon: ClipboardList, roles: ORGANIZATION_ADMIN_ROLES },
    ],
  },
  {
    title: "ADMINISTRATION",
    links: [
      { label: "Loan products", href: "/products", icon: BadgeIndianRupee, roles: ORGANIZATION_ADMIN_ROLES },
      { label: "Team access", href: "/team", icon: Activity, roles: [...ORGANIZATION_ADMIN_ROLES, "privileged"] },
      { label: "Expenses", href: "/expenses", icon: BadgeIndianRupee, roles: ORGANIZATION_ADMIN_ROLES },
      { label: "Payroll", href: "/payroll", icon: Banknote, roles: ORGANIZATION_ADMIN_ROLES },
      { label: "Customer documents", href: "/documents", icon: ClipboardList, roles: ["user", "privileged", ...ORGANIZATION_ADMIN_ROLES] },
      { label: "Account settings", href: "/settings", icon: HandCoins, roles: ["user", "privileged", "admin"] },
    ],
  },
];

export default function AppSidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  return (
    <>
      <button
        aria-expanded={mobileOpen}
        aria-controls="main-navigation"
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        className="fixed left-3 top-3 z-50 grid size-10 place-items-center rounded-lg border border-[#e8ede9] bg-white text-[#173b33] shadow-sm md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        type="button"
      >
        <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
        {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {mobileOpen && (
        <button
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-[#14251f]/45 md:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}
      <aside id="main-navigation" className={`fixed inset-y-0 left-0 z-40 w-[min(84vw,280px)] flex-col bg-[#102f2a] text-white transition-transform md:w-[76px] xl:w-[244px] ${
        mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full md:flex md:translate-x-0"
      }`}>
        <Link href="/dashboard" onClick={() => setMobileOpen(false)} prefetch={false} className="flex h-16 shrink-0 items-center justify-start gap-3 border-b border-white/[0.08] px-5 sm:h-[76px] md:justify-center xl:justify-start">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#c8f169] text-sm font-bold text-[#17362f]">M</span>
          <span className="text-lg font-semibold tracking-tight md:hidden xl:block">mitra</span>
        </Link>
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-6 xl:px-4">
          {sections.map((section) => {
            const links = section.links.filter((link) => roleAllowed(link.roles, role));
            if (links.length === 0) return null;
            return (
              <div className="mb-7" key={section.title}>
                <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.15em] text-white/35 md:hidden xl:block">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {links.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                        aria-label={label}
                        className={`group flex h-11 items-center justify-start gap-3 rounded-lg px-3 text-sm transition md:h-10 md:justify-center xl:justify-start ${
                          active
                            ? "bg-white/[0.11] font-medium text-[#d5f78b]"
                            : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                        }`}
                        href={href}
                        key={href}
                        onClick={() => setMobileOpen(false)}
                        prefetch={href !== "/dashboard"}
                        title={label}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                        <span className="md:hidden xl:block">{label}</span>
                        {active && <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-[#c8f169] md:hidden xl:block" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="hidden border-t border-white/[0.08] px-5 py-4 text-[11px] leading-5 text-white/40 xl:block">
          Responsible finance,
          <br />
          stronger communities.
        </div>
      </aside>
    </>
  );
}
