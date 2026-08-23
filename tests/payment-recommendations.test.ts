import { describe, expect, it } from "vitest";
import { calculateTaskRecommendedAmount, PaymentRecommendationError } from "@/lib/payment-recommendations";

describe("GAA payment recommendation calculations", () => {
  it.each([["20000", "100", "20000.00"], ["15000", "80", "12000.00"], ["10000", "50", "5000.00"], ["27692.31", "66.666", "18462.46"]])("calculates allocation x completion safely", (allocation, percentage, expected) => {
    expect(calculateTaskRecommendedAmount(allocation, percentage).toFixed(2)).toBe(expected);
  });
  it("rejects negative amounts and invalid completion", () => {
    expect(() => calculateTaskRecommendedAmount("-1", "100")).toThrow(PaymentRecommendationError);
    expect(() => calculateTaskRecommendedAmount("100", "101")).toThrow(PaymentRecommendationError);
    expect(() => calculateTaskRecommendedAmount("100", "-1")).toThrow(PaymentRecommendationError);
  });
});
