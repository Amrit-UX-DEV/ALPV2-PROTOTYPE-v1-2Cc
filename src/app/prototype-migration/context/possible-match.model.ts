/**
 * The other platform's possible match record.
 *
 * This is their contract, not ours, so the field names are theirs verbatim,
 * including surName, alternameEmail and pensionValidUntill. They are copied as
 * received rather than corrected, so that what the prototype reads is what the
 * real response would deliver. Anything we name ourselves lives in
 * prototype-context.model.ts instead.
 *
 * They hold a partial record: fields they do not have arrive as a single space
 * rather than being omitted or null, which is why reading these values means
 * treating whitespace as absent.
 */

/** An address as the other platform holds it. */
export interface PossibleMatchAddress {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
  line5: string;
  countryCode: string;
  postcode: string;
  /** Whether their postcode agrees with ours. */
  postcodeMatched: boolean;
}

/**
 * One pension the possible match reference resolves to.
 *
 * pensionReference is their name for what we call a policy reference, and it is
 * the link that lets the rep DPA the caller against a policy of ours.
 */
export interface PossibleMatchDetail {
  pensionReference: string;
  /** The PMR number the caller reads out. */
  possibleMatchReference: string;
  /** Their spelling. How long the possible match stays valid. */
  pensionValidUntill: string;
  addresses: PossibleMatchAddress[];
}

/**
 * A person as the other platform holds them, with a flag per field saying
 * whether their value agrees with ours.
 *
 * There are no flags for email or phone, theirs or alternate, so those can be
 * shown but not marked as matching.
 */
export interface PossibleMatchRecord {
  givenName: string;
  /** Their spelling, capital N. */
  surName: string;
  dateOfBirth: string;
  niNumber: string;
  alternateSurname1: string;
  alternateSurname2: string;
  alternateSurname3: string;
  alternateSurname4: string;
  alternateSurname5: string;
  email: string;
  /** Their spelling, missing the r in alternate. */
  alternameEmail: string;
  phoneNumber: string;
  alternatePhoneNumber: string;
  niNumberMatched: boolean;
  givenNameMatched: boolean;
  surnameMatched: boolean;
  dobMatched: boolean;
  alternateSurname1Matched: boolean;
  alternateSurname2Matched: boolean;
  alternateSurname3Matched: boolean;
  alternateSurname4Matched: boolean;
  alternateSurname5Matched: boolean;
  pmrDetails: PossibleMatchDetail[];
}

/**
 * Whether the other platform actually sent a value.
 *
 * They pad absent fields with a space, so an empty string and a space both mean
 * the same thing: nothing held.
 */
export function hasValue(value: string | undefined): boolean {
  return (value ?? '').trim().length > 0;
}
