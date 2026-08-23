import { describe, expect, it } from "vitest";
import {
  calculatePhiMonthlyAttendanceRows,
  PHI_MONTHLY_ATTENDANCE_CATEGORIES,
  type PhiMonthlyAttendanceRowInput,
  PhiMonthlyAttendanceError,
} from "@/lib/phi-monthly-attendance";

function row(category: PhiMonthlyAttendanceRowInput["category"], employeeCount: number, deductionRate: number): PhiMonthlyAttendanceRowInput {
  return { category, employeeCount, deductionRate };
}

describe("PHI monthly attendance report calculations", () => {
  it("matches the March sample totals", () => {
    const { summaries, grandTotal } = calculatePhiMonthlyAttendanceRows([
      row("HALF_DAY_EMPLOYEES", 37, 800),
      row("HALF_DAY_GRASS_CUTTERS_GULLY_CLEANER_TRACTOR_OPERATOR", 0, 1370),
      row("HALF_DAY_SUPERVISORS", 1, 1370),
      row("ABSENT_EMPLOYEES", 413, 1600),
      row("ABSENT_GRASS_CUTTERS_GULLY_CLEANER_TRACTOR_OPERATOR", 45, 2740),
      row("ABSENT_SUPERVISORS", 3, 2740),
    ]);

    expect(summaries.map((summary) => summary.rowTotal.toFixed(2))).toEqual([
      "29600.00",
      "0.00",
      "1370.00",
      "660800.00",
      "123300.00",
      "8220.00",
    ]);
    expect(grandTotal.toFixed(2)).toBe("823290.00");
  });

  it("rejects negative employee counts", () => {
    expect(() =>
      calculatePhiMonthlyAttendanceRows([
        row("HALF_DAY_EMPLOYEES", -1, 800),
        row("HALF_DAY_GRASS_CUTTERS_GULLY_CLEANER_TRACTOR_OPERATOR", 0, 1370),
        row("HALF_DAY_SUPERVISORS", 1, 1370),
        row("ABSENT_EMPLOYEES", 413, 1600),
        row("ABSENT_GRASS_CUTTERS_GULLY_CLEANER_TRACTOR_OPERATOR", 45, 2740),
        row("ABSENT_SUPERVISORS", 3, 2740),
      ]),
    ).toThrow(PhiMonthlyAttendanceError);
  });

  it("keeps the official categories in the expected order", () => {
    expect(PHI_MONTHLY_ATTENDANCE_CATEGORIES.map((category) => category.key)).toEqual([
      "HALF_DAY_EMPLOYEES",
      "HALF_DAY_GRASS_CUTTERS_GULLY_CLEANER_TRACTOR_OPERATOR",
      "HALF_DAY_SUPERVISORS",
      "ABSENT_EMPLOYEES",
      "ABSENT_GRASS_CUTTERS_GULLY_CLEANER_TRACTOR_OPERATOR",
      "ABSENT_SUPERVISORS",
    ]);
  });
});
