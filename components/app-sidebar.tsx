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
  UsersRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[76px] flex-col bg-[#102f2a] text-white xl:w-[244px]">
      <Link href="/dashboard" className="flex h-[76px] items-center justify-center gap-3 border-b border-white/[0.08] px-5 xl:justify-start">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#c8f169] text-sm font-bold text-[#17362f]">M</span>
        <span className="hidden text-lg font-semibold tracking-tight xl:block">mitra</span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-6 xl:px-4">
        {sections.map((section) => {
          const links = section.links.filter((link) => roleAllowed(link.roles, role));
          if (links.length === 0) return null;
          return (
            <div className="mb-7" key={section.title}>
              <p className="mb-2 hidden px-3 text-[10px] font-semibold tracking-[0.15em] text-white/35 xl:block">
                {section.title}
              </p>
              <div className="space-y-1">
                {links.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
                  return (
                    <Link
                      aria-label={label}
                      className={`group flex h-10 items-center justify-center gap-3 rounded-lg px-3 text-sm transition xl:justify-start ${
                        active
                          ? "bg-white/[0.11] font-medium text-[#d5f78b]"
                          : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                      }`}
                      href={href}
                      key={href}
                      title={label}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                      <span className="hidden xl:block">{label}</span>
                      {active && <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-[#c8f169] xl:block" />}
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
  );
}
