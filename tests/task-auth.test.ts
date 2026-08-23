import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError, requireAuthenticatedUser, requireRole } from "@/lib/auth";

const supabaseState = {
  sessionUser: null as null | { id: string; email: string },
  appUser: null as null | {
    id: string;
    name: string;
    email: string;
    role: "GAA" | "EVALUATING_OFFICER" | "PHI" | "ADMINISTRATION_OFFICER" | "VICE_CHANCELLOR";
    active: boolean;
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: supabaseState.sessionUser },
        error: null,
      }),
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => supabaseState.appUser),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  supabaseState.sessionUser = null;
  supabaseState.appUser = null;
});

describe("task authorization", () => {
  it("allows an active GAA user", async () => {
    supabaseState.sessionUser = { id: "supabase-user-1", email: "gaa@example.com" };
    supabaseState.appUser = {
      id: "supabase-user-1",
      name: "GAA User",
      email: "gaa@example.com",
      role: "GAA",
      active: true,
    };

    await expect(requireRole("GAA")).resolves.toMatchObject({
      appUser: expect.objectContaining({
        role: "GAA",
        active: true,
      }),
    });
  });

  it("rejects unauthenticated access", async () => {
    await expect(requireAuthenticatedUser()).rejects.toMatchObject({
      status: 401,
    });
  });

  it("rejects inactive GAA users", async () => {
    supabaseState.sessionUser = { id: "supabase-user-1", email: "gaa@example.com" };
    supabaseState.appUser = {
      id: "supabase-user-1",
      name: "GAA User",
      email: "gaa@example.com",
      role: "GAA",
      active: false,
    };

    await expect(requireRole("GAA")).rejects.toMatchObject({
      status: 403,
      message: "Your account is inactive.",
    });
  });

  for (const role of [
    "EVALUATING_OFFICER",
    "PHI",
    "ADMINISTRATION_OFFICER",
    "VICE_CHANCELLOR",
  ] as const) {
    it(`rejects ${role}`, async () => {
      supabaseState.sessionUser = { id: "supabase-user-1", email: "role@example.com" };
      supabaseState.appUser = {
        id: "supabase-user-1",
        name: "Role User",
        email: "role@example.com",
        role,
        active: true,
      };

      await expect(requireRole("GAA")).rejects.toBeInstanceOf(AuthError);
      await expect(requireRole("GAA")).rejects.toMatchObject({
        status: 403,
      });
    });
  }
});
