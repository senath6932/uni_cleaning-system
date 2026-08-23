export const taskCategories = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export const taskFrequencies = ["DAILY", "WEEKLY", "MONTHLY"] as const;

export type TaskCategoryValue = (typeof taskCategories)[number];
export type TaskFrequencyValue = (typeof taskFrequencies)[number];

export function isTaskCategory(value: string): value is TaskCategoryValue {
  return (taskCategories as readonly string[]).includes(value);
}

export function isTaskFrequency(value: string): value is TaskFrequencyValue {
  return (taskFrequencies as readonly string[]).includes(value);
}
