/**
 * Someone's age today, from a date of birth.
 *
 * The group summary shows the age in brackets after the date of birth, and an
 * age written into the markup is wrong from the next birthday onwards, which is
 * how it came to read 55 for someone born in 1966. Deriving it means it cannot
 * go stale.
 *
 * Returns undefined for anything unparseable, so a screen shows the date without
 * brackets rather than "(NaN)".
 */
export function ageOn(dateOfBirth: string | undefined, today: Date = new Date()): number | undefined {
  if (!dateOfBirth) return undefined;

  // A date-only string parses as UTC midnight, which reads as the day before
  // anywhere west of Greenwich, so the parts are taken as a local date instead.
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth.trim());
  const born = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return undefined;

  let age = today.getFullYear() - born.getFullYear();

  // Their birthday this year may not have come round yet, in which case they are
  // still a year younger than the difference in years suggests.
  const monthsApart = today.getMonth() - born.getMonth();
  if (monthsApart < 0 || (monthsApart === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : undefined;
}
