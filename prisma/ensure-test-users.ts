import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import type { PrismaClient } from "../app/generated/prisma/client";
import { testUsers, type TestUserSeed } from "./test-users";

type EnsureResult = {
  email: string;
  role: TestUserSeed["role"];
  password: string;
  status: "success" | "error";
  authUserId?: string;
  message: string;
};

async function findAuthUserByEmail(supabase: SupabaseClient, email: string) {
  const normalizedEmail = email.toLowerCase();
  const perPage = 100;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Unable to list Supabase users: ${error.message}`);
    }

    const match = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail,
    );

    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function ensureAuthUser(supabase: SupabaseClient, user: TestUserSeed) {
  const existing = await findAuthUserByEmail(supabase, user.email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        name: user.name,
        role: user.role,
      },
    });

    if (error || !data.user) {
      throw new Error(error?.message ?? `Unable to update Supabase user ${user.email}`);
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      name: user.name,
      role: user.role,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? `Unable to create Supabase user ${user.email}`);
  }

  return data.user;
}

async function ensureApplicationUser(
  prisma: PrismaClient,
  user: TestUserSeed,
  authUser: SupabaseUser,
) {
  const existingById = await prisma.user.findUnique({ where: { id: authUser.id } });

  if (existingById) {
    return prisma.user.update({
      where: { id: authUser.id },
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        active: true,
      },
    });
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });

  if (existingByEmail) {
    return prisma.user.update({
      where: { email: user.email },
      data: {
        id: authUser.id,
        name: user.name,
        role: user.role,
        active: true,
      },
    });
  }

  return prisma.user.create({
    data: {
      id: authUser.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: true,
    },
  });
}

export async function ensureTestUsers(
  prisma: PrismaClient,
  supabase: SupabaseClient,
): Promise<EnsureResult[]> {
  const results: EnsureResult[] = [];

  for (const user of testUsers) {
    try {
      const authUser = await ensureAuthUser(supabase, user);
      await ensureApplicationUser(prisma, user, authUser);

      results.push({
        email: user.email,
        role: user.role,
        password: user.password,
        status: "success",
        authUserId: authUser.id,
        message: "Supabase Auth password and PostgreSQL user profile verified.",
      });
    } catch (error) {
      results.push({
        email: user.email,
        role: user.role,
        password: user.password,
        status: "error",
        message: error instanceof Error ? error.message : "Unable to verify seed user.",
      });
    }
  }

  return results;
}
