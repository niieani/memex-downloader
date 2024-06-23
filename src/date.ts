import { Temporal } from "@js-temporal/polyfill";

// Helper to format date to YYYY-MM using Temporal API
export const formatDateToYYYYMM = (timestamp: number) => {
  return formatDateToYYYYMMDD(timestamp).slice(0, 7); // Extracts YYYY-MM
};

export const formatDateToYYYYMMDD = (timestamp: number) => {
  const instant = Temporal.Instant.fromEpochMilliseconds(timestamp);
  const zonedDateTime = instant.toZonedDateTimeISO("UTC");
  return zonedDateTime.toPlainDate().toString(); // Extracts YYYY-MM-DD
};
