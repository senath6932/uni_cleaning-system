export const applicationRoles = [
  "GAA",
  "EVALUATING_OFFICER",
  "PHI",
  "ADMINISTRATION_OFFICER",
  "VICE_CHANCELLOR",
] as const;

export type ApplicationRole = (typeof applicationRoles)[number];

export function isApplicationRole(role: string): role is ApplicationRole {
  return (applicationRoles as readonly string[]).includes(role);
}

