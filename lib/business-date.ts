const DEFAULT_BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE ?? "Asia/Colombo";

function formatDateParts(date: Date, timeZone = DEFAULT_BUSINESS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return { year, month, day };
}

export function getBusinessDateString(date = new Date(), timeZone = DEFAULT_BUSINESS_TIME_ZONE) {
  const { year, month, day } = formatDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function dateStringToUtcDate(value: string) {
  if (!isValidDateString(value)) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

export function isFutureBusinessDate(
  value: string,
  now = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
) {
  return value > getBusinessDateString(now, timeZone);
}

export function normalizeDateString(value: string) {
  return value.trim();
}

export function getBusinessTimeZone() {
  return DEFAULT_BUSINESS_TIME_ZONE;
}
