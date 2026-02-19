/**
 * Role hierarchy helpers used by API routes.
 * Hierarchy: super_admin > admin > member
 */

export type AppRole = "super_admin" | "admin" | "member";

/** Returns true if the role has admin-level access (admin or super_admin). */
export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

/** Returns true if the role is super_admin. */
export function isSuperAdminRole(role: string): boolean {
  return role === "super_admin";
}
