import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import {
  AlpPolicyTileComponent,
  PolicyTileSignpost,
} from '../../../alp/policy-tile/alp-policy-tile.component';
import { PossibleMatchService } from '../../../context/possible-match.service';
import { hasValue } from '../../../context/possible-match.model';
import { ContextClient } from '../../../context/prototype-context.model';
import { PrototypeContextService } from '../../../context/prototype-context.service';
import { AppViewService } from '../../../ui/app-view.service';

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

/** One field, as the other platform holds it and as we hold it. */
export interface ComparisonRow {
  label: string;
  theirs: string;
  ours: string;
  verdict: ComparisonVerdict;
}

/**
 * Their country code is a telephone dialling code, ours is an ISO country code,
 * so the same country arrives spelled two ways. Mapped rather than compared as
 * text, otherwise the one field both platforms agree on reads as a mismatch.
 */
const DIALLING_CODES: Record<string, string> = { '44': 'GB' };

/** A named run of rows, e.g. the identity fields. */
export interface ComparisonSection {
  title: string;
  rows: ComparisonRow[];
  /** Shown under the rows, where the fields need explaining. */
  note?: string;
}

/**
 * The possible match summary.
 *
 * A caller reads out a possible match reference. It belongs to a partial record
 * held on another platform, about someone who may or may not be one of our
 * clients, so the screen puts their record beside ours field by field: that
 * comparison is the whole point of the screen, and it is what the rep works
 * from while filling the gaps.
 *
 * The reference always carries one pension reference, which is a policy of ours,
 * so the context arrives with that policy attached and the tile can take the rep
 * into its group summary to carry on the call.
 */
@Component({
  selector: 'alpha-search-summary',
  standalone: true,
  imports: [AlpPolicyTileComponent],
  templateUrl: './alpha-search-summary.component.html',
  styleUrl: './alpha-search-summary.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlphaSearchSummaryComponent {
  protected readonly ctx = inject(PrototypeContextService);
  protected readonly matches = inject(PossibleMatchService);
  private readonly views = inject(AppViewService);

  protected readonly noData = NO_DATA;

  /**
   * The badge the legacy policy tile carries beside the status. Held as a field
   * so the tile is not handed a new array on every check.
   */
  protected readonly policyFlags = ['Life'];

  /**
   * The parties signposted on the tile: who is party to the policy, and who
   * only has an interest in it.
   *
   * Both are counted from the policy's own parties, so the tile cannot say two
   * where the group summary lists three. A party to the policy has a client id
   * of its own; the joint holder entry and the servicing agent do not.
   */
  protected readonly signposts = computed<PolicyTileSignpost[]>(() => {
    const clients = this.ctx.clients();
    return [
      { label: 'Interested Parties', value: clients.filter((client) => client.id).length },
      { label: 'Third Parties', value: clients.filter((client) => client.thirdParty).length },
    ];
  });

  /** The pension the reference resolved to, and the address held against it. */
  protected readonly detail = this.matches.detail;
  protected readonly theirAddress = this.matches.address;

  /**
   * Our client for this possible match, matched on name.
   *
   * A possible match is by definition unconfirmed, so there is no id linking
   * their record to ours; the names are all there is to go on. Where nothing
   * matches, every value on our side reads as not held, which is exactly what a
   * possible match on somebody unknown to us should look like.
   */
  protected readonly ourClient = computed<ContextClient | undefined>(() => {
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
      this.compare('Date of Birth', them.dateOfBirth, us?.dateOfBirth, them.dobMatched),
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
    const theirs = this.theirAddress();
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
   * The comparison, grouped as the rep reads it.
   *
   * Sections with nothing in them are dropped rather than drawn empty, so a
   * record holding no alternate surnames and no address simply shows fewer
   * headings.
   */
  protected readonly sections = computed<ComparisonSection[]>(() =>
    [
      { title: 'Identity', rows: this.identityRows() },
      { title: 'Alternate Surnames', rows: this.alternateSurnameRows() },
      {
        title: 'Contact',
        rows: this.contactRows(),
        note: 'The other platform sends match flags for the identity fields, the alternate surnames and the postcode, but not for these, so the two values are compared directly. Not Held means neither platform holds the field at all.',
      },
      { title: 'Address', rows: this.addressRows() },
    ].filter((section) => section.rows.length > 0),
  );

  /**
   * How the comparison came out, counted across every section.
   *
   * A rep wants to know whether this is a good match before reading any of it,
   * and the answer is in how many fields differ. Counted from the same rows the
   * cards are drawn from, so the tally cannot say three where four are showing.
   */
  protected readonly tally = computed(() => {
    const fields = this.sections().flatMap((section) => section.rows);
    return {
      matched: fields.filter((field) => field.verdict === 'matched').length,
      notMatched: fields.filter((field) => field.verdict === 'not-matched').length,
      notHeld: fields.filter((field) => field.verdict === 'not-held').length,
    };
  });

  /** Takes the rep into the group summary, where the call carries on. */
  protected openGroupSummary(): void {
    this.views.show('group-summary');
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
