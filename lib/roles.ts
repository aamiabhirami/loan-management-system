export const USER_ROLES = ["user", "privileged", "admin", "director", "shareholder"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export const ORGANIZATION_ADMIN_ROLES = ["admin", "director", "shareholder"] as const;
export type OrganizationAdminRole = (typeof ORGANIZATION_ADMIN_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function isOrganizationAdmin(role: UserRole): role is OrganizationAdminRole {
  return ORGANIZATION_ADMIN_ROLES.includes(role as OrganizationAdminRole);
}

export function roleLabel(role: UserRole) {
  switch (role) {
    case "admin":
      return "Administrator";
    case "director":
      return "Director";
    case "shareholder":
      return "Shareholder";
    case "privileged":
      return "Field manager";
    default:
      return "Customer";
  }
}
