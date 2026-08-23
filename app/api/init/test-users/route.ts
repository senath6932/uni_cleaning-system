import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureTestUsers } from "@/prisma/ensure-test-users";
import { testUsers } from "@/prisma/test-users";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { serviceRoleKey?: unknown };
    const serviceRoleKey =
      typeof body.serviceRoleKey === "string" ? body.serviceRoleKey.trim() : "";

    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          error: "Service Role Key is required",
          message: "Please provide the Supabase Service Role Key from your project settings",
        },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const results = await ensureTestUsers(prisma, supabase);
    const success = results.every((result) => result.status === "success");

    return NextResponse.json(
      {
        success,
        message: success
          ? "All test users were verified in Supabase Auth and PostgreSQL."
          : "Some test users could not be initialized.",
        results,
        credentials: testUsers,
      },
      { status: success ? 200 : 500 },
    );
  } catch (error) {
    console.error("Initialization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to initialize test users",
    instructions: "Send a POST request with { serviceRoleKey: 'your-key' }",
    testUsers,
  });
}
