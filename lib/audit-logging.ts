import type { ActivityAction, Prisma, PrismaClient } from "@/app/generated/prisma/client";

export async function databaseSupportsActivityAction(
  prisma: Pick<PrismaClient, "$queryRaw">,
  action: ActivityAction,
) {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'ActivityAction'
        AND e.enumlabel = ${action}
    ) AS "exists"
  `;

  return Boolean(rows[0]?.exists);
}

export async function createActivityLogIfSupported(
  prisma: Pick<PrismaClient, "activityLog" | "$queryRaw">,
  data: Prisma.ActivityLogUncheckedCreateInput,
) {
  if (!(await databaseSupportsActivityAction(prisma, data.action))) {
    console.warn(`Skipped activity log because database enum is missing ${data.action}`);
    return;
  }

  await prisma.activityLog.create({ data });
}
