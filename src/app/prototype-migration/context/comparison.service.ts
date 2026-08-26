import { formatDate } from '@angular/common';
import { Injectable, LOCALE_ID, computed, inject } from '@angular/core';

import { hasValue } from './possible-match.model';
import { PossibleMatchService } from './possible-match.service';
import { ContextClient } from './prototype-context.model';
import { PrototypeContextService } from './prototype-context.service';

/** What appears where a side holds nothing. */
export const NO_DATA = 'No Data';

/**
 * What a row's two values amount to.
 *
 * not-held is for a field neither platform holds. It is not a verdict on a
 * comparison, it is the absence of one, and it is the only case where no
 * comparison is possible: everything we hold is compared.
 */
export type ComparisonVerdict = 'matched' | 'not-matched' | 'not-held';

/** What each verdict is called on screen. */
export const VERDICT_LABELS: Record<ComparisonVerdict, string> = {
  matched: 'Matched',
  'not-matched': 'Not Matched',
  'not-held': 'Not Held',
};

/** One field, as the other platform holds it and as we hold it. */
export interface ComparisonRow {
  label: string;
  theirs: string;
  ours: string;
  verdict: ComparisonVerdict;
  /**
   * The one value a matched field can be shown as, which is ours where we hold
   * it. A field can be flagged as matching while only one side holds it, and
   * printing 'No Data' as the agreed value would read as a mistake.
   */
  agreedValue: string;
  /**
   * Whether a matched field is nevertheless written differently on the two
   * platforms. Their flags allow it, and a rep about to read a name back to a
   * caller needs to see their spelling rather than only ours.
   */
  spellingsDiffer: boolean;
}

/** A field with the section it came from, since the panels group by verdict. */
export interface ComparisonField extends ComparisonRow {
  section: string;
}

/** A named run of rows, e.g. the identity fields. */
export interface ComparisonSection {
  title: string;
  rows: ComparisonRow[];
}

/**
 * Their country code is a telephone dialling code, ours is an ISO country code,
 * so the same country arrives spelled two ways. Mapped rather than compared as
 * text, otherwise the one field both platforms agree on reads as a mismatch.
 */
const DIALLING_CODES: Record<string, string> = { '44': 'GB' };

/**
 * The other platform's record set against ours, field by field.
 *
 * A service rather than part of the screen that shows it, because two screens
 * now work from the same comparison: the dashboard reference summary, which
 * shows it, and the dashboard reference work plan, which asks the rep what they
 * supplied against the fields it found. A field that differs on one and not the
 * other would be a bug the rep has to work out for themselves, and there is only
 * one way to be sure of that, which is one place where the comparison is made.
 */
@Injectable({ providedIn: 'root' })
export class ComparisonService {
  private readonly ctx = inject(PrototypeContextService);
  private readonly matches = inject(PossibleMatchService);
  private readonly locale = inject(LOCALE_ID);

  /**
   * Our client for this possible match, matched on name.
   *
   * A possible match is by definition unconfirmed, so there is no id linking
   * their record to ours; the names are all there is to go on. Where nothing
   * matches, every value on our side reads as not held, which is exactly what a
   * possible match on somebody unknown to us should look like.
   */
  readonly ourClient = computed<ContextClient | undefined>(() => {
    const them = this.matches.record();
    if (!them) return undefined;

    const given = them.givenName.trim().toLowerCase();
    const surname = them.surName.trim().toLowerCase();
    return this.ctx.clients().find((client) => {
      const clientGiven = (client.givenName ?? '').trim().toLowerCase();
      const clientSurname = (client.surname ?? '').trim().toLowerCase();
      return clientGiven === given && clientSurname === surname;
    });
  });

  /** The identity fields, in the order a rep would read them out. */
  private readonly identityRows = computed<ComparisonRow[]>(() => {
    const them = this.matches.record();
    if (!them) return [];
    const us = this.ourClient();

    return [
      this.compare('Given Name', them.givenName, us?.givenName, them.givenNameMatched),
      this.compare('Surname', them.surName, us?.surname, them.surnameMatched),
      this.compare(
        'Date of Birth',
        this.asDate(them.dateOfBirth),
        this.asDate(us?.dateOfBirth),
        them.dobMatched,
      ),
      this.compare('NI Number', them.niNumber, us?.niNumber, them.niNumberMatched),
    ];
  });

  /**
   * All five alternate surnames, held or not.
   *
   * Every field the other platform sends is shown, including the ones they have
   * nothing for: which of the five is empty is itself worth seeing, and hiding
   * them would leave the rep unsure whether a field was absent or never sent.
   *
   * We hold no alternate surnames at all, so our side of these rows is empty by
   * definition rather than by accident.
   */
  private readonly alternateSurnameRows = computed<ComparisonRow[]>(() => {
    const them = this.matches.record();
    if (!them) return [];

    const alternates: [string, boolean][] = [
      [them.alternateSurname1, them.alternateSurname1Matched],
      [them.alternateSurname2, them.alternateSurname2Matched],
      [them.alternateSurname3, them.alternateSurname3Matched],
      [them.alternateSurname4, them.alternateSurname4Matched],
      [them.alternateSurname5, them.alternateSurname5Matched],
    ];

    return alternates.map(([value, matched], i) =>
      this.compare(`Alternate Surname ${i + 1}`, value, undefined, matched),
    );
  });

  /**
   * Contact fields. Their record carries no flags for these, so the two values
   * are compared here: we hold an email, a phone number and an address for every
   * client, whether or not the group summary shows them.
   */
  private readonly contactRows = computed<ComparisonRow[]>(() => {
    const them = this.matches.record();
    if (!them) return [];
    const us = this.ourClient();

    return [
      this.compare('Email', them.email, us?.email),
      this.compare('Alternate Email', them.alternameEmail, us?.alternateEmail),
      this.compare('Phone Number', them.phoneNumber, us?.phoneNumber),
      this.compare('Alternate Phone Number', them.alternatePhoneNumber, us?.alternatePhoneNumber),
    ];
  });

  /** Their address lines and ours, as a block each, plus the flagged postcode. */
  private readonly addressRows = computed<ComparisonRow[]>(() => {
    const theirs = this.matches.address();
    if (!theirs) return [];
    const ours = this.ourClient()?.address;

    const theirLines = [theirs.line1, theirs.line2, theirs.line3, theirs.line4, theirs.line5]
      .filter((line) => hasValue(line))
      .join(', ');

    return [
      this.compare('Address', theirLines, (ours?.lines ?? []).join(', ')),
      this.compare('Postcode', theirs.postcode, ours?.postcode, theirs.postcodeMatched),
      this.compare('Country Code', theirs.countryCode, ours?.countryCode),
    ];
  });

  /**
   * Every field the comparison covers, in the order a rep reads them.
   *
   * A section with nothing in it is dropped rather than carried empty, so a
   * record holding no alternate surnames and no address simply compares fewer
   * fields. The sections themselves no longer appear on screen; each field
   * carries its section's name onto its tile.
   */
  readonly sections = computed<ComparisonSection[]>(() =>
    [
      { title: 'Identity', rows: this.identityRows() },
      { title: 'Alternate Surnames', rows: this.alternateSurnameRows() },
      { title: 'Contact', rows: this.contactRows() },
      { title: 'Address', rows: this.addressRows() },
    ].filter((section) => section.rows.length > 0),
  );

  /** Every field compared, each still knowing which section it belongs to. */
  readonly fields = computed<ComparisonField[]>(() =>
    this.sections().flatMap((section) =>
      section.rows.map((row) => ({ ...row, section: section.title })),
    ),
  );

  readonly fieldCount = computed(() => this.fields().length);

  /** What the two platforms disagree on, which is what the rep works from. */
  readonly differences = computed(() =>
    this.fields().filter((field) => field.verdict === 'not-matched'),
  );

  readonly agreements = computed(() =>
    this.fields().filter((field) => field.verdict === 'matched'),
  );

  readonly notHeld = computed(() => this.fields().filter((field) => field.verdict === 'not-held'));

  /**
   * A date written the way the rest of the app writes one, e.g. 13 Nov 1966.
   *
   * Both platforms send dates as 1966-11-13, and a rep comparing this screen
   * against the group summary should not have to work out that the two are the
   * same day. formatDate is what the date pipe calls, on the same locale, so the
   * two screens cannot present a date differently.
   *
   * Anything unparseable is returned as it arrived: their record carries
   * placeholders, and a placeholder should be shown verbatim rather than guessed
   * at.
   */
  asDate(value: string | undefined): string {
    const trimmed = (value ?? '').trim();
    if (!hasValue(trimmed)) return trimmed;

    try {
      return formatDate(trimmed, 'dd MMM yyyy', this.locale);
    } catch {
      return trimmed;
    }
  }

  /**
   * One row of the comparison.
   *
   * Their record flags some fields and not others, but everything they send has a
   * counterpart on our side, so where there is no flag the two values are
   * compared here instead. A field neither platform holds is the only row with no
   * comparison to make.
   */
  private compare(
    label: string,
    theirs: string | undefined,
    ours: string | undefined,
    flag?: boolean,
  ): ComparisonRow {
    const theirValue = (theirs ?? '').trim();
    const ourValue = (ours ?? '').trim();
    const theyHold = hasValue(theirValue);
    const weHold = hasValue(ourValue);

    let verdict: ComparisonVerdict;
    if (!theyHold && !weHold) {
      verdict = 'not-held';
    } else if (flag !== undefined) {
      verdict = flag ? 'matched' : 'not-matched';
    } else {
      verdict = theyHold && weHold && this.same(theirValue, ourValue) ? 'matched' : 'not-matched';
    }

    return {
      label,
      theirs: theyHold ? theirValue : NO_DATA,
      ours: weHold ? ourValue : NO_DATA,
      verdict,
      agreedValue: weHold ? ourValue : theyHold ? theirValue : NO_DATA,
      spellingsDiffer: theyHold && weHold && theirValue !== ourValue,
    };
  }

  /** Case and spacing are not differences worth reporting to a rep. */
  private same(theirs: string, ours: string): boolean {
    const normalise = (value: string) => {
      const trimmed = value.trim();
      return (DIALLING_CODES[trimmed] ?? trimmed).replace(/\s+/g, ' ').toLowerCase();
    };
    return normalise(theirs) === normalise(ours);
  }
}
