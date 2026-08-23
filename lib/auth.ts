import type { User, UserRole } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const roleRedirectPath: Record<UserRole, string> = {
  GAA: "/dashboard/gaa",
  EVALUATING_OFFICER: "/dashboard/evaluating-officer",
  PHI: "/dashboard/phi",
  ADMINISTRATION_OFFICER: "/dashboard/administration",
  VICE_CHANCELLOR: "/dashboard/vice-chancellor",
};

export type AuthContext = {
  sessionUser: Awaited<ReturnType<typeof getSupabaseUser>>;
  appUser: User | null;
};

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function getSupabaseUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user ?? null;
}

export async function getApplicationUserBySupabaseId(supabaseUserId: string) {
  return prisma.user.findUnique({
    where: {
      id: supabaseUserId,
    },
  });
}

export async function getAuthContext(): Promise<AuthContext> {
  const sessionUser = await getSupabaseUser();

  if (!sessionUser) {
    return { sessionUser: null, appUser: null };
  }

  const appUser = await getApplicationUserBySupabaseId(sessionUser.id);
  return { sessionUser, appUser };
}

export async function requireAuthenticatedUser() {
  const { sessionUser, appUser } = await getAuthContext();

  if (!sessionUser) {
    throw new AuthError("Unauthorized", 401);
  }

  if (!appUser) {
    throw new AuthError(
      "You are authenticated in Supabase, but no application user record was found.",
      403,
    );
  }

  if (!appUser.active) {
    throw new AuthError("Your account is inactive.", 403);
  }

  return { sessionUser, appUser };
}

export async function requireRole(requiredRole: UserRole) {
  const { sessionUser, appUser } = await requireAuthenticatedUser();

  if (appUser.role !== requiredRole) {
    throw new AuthError("You do not have permission to perform this action.", 403);
  }

  return { sessionUser, appUser };
}
