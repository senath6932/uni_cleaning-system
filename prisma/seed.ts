import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../app/generated/prisma/client";
import { ensureTestUsers } from "./ensure-test-users";
import { testUsers } from "./test-users";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log("Starting database seed...\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    serviceRoleKey === "your-service-role-key-here"
  ) {
    console.error("Error: SUPABASE_SERVICE_ROLE_KEY is not set in .env file");
    throw new Error("A valid Supabase service role key is required.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const results = await ensureTestUsers(prisma, supabase);
  const failures = results.filter((result) => result.status === "error");

  for (const result of results) {
    const marker = result.status === "success" ? "OK" : "ERROR";
    console.log(`${marker} ${result.email} (${result.role}): ${result.message}`);
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length} test user(s) could not be seeded.`);
  }

  console.log("\nSeed complete.\n");
  console.log("Test Credentials:");
  console.log("=".repeat(60));
  testUsers.forEach((user) => {
    console.log(`Role: ${user.role.padEnd(20)}`);
    console.log(`  Email:    ${user.email}`);
    console.log(`  Password: ${user.password}`);
    console.log("");
  });
  console.log("=".repeat(60));
  console.log("\nLogin at: http://localhost:3000/login\n");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
