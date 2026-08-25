import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';

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

/**
 * How the comparison is laid out.
 *
 * Grouped answers "what do I need to do something about", which is the question
 * a rep opens the screen with. Table answers "what does the record say", field
 * by field in the order the sections arrive, which is what somebody reading a
 * record back or checking one field wants. Same fields, same verdicts, same
 * values: only the arrangement differs.
 */
export type ComparisonView = 'grouped' | 'table';

/** What each verdict is called on screen. */
export const VERDICT_LABELS: Record<ComparisonVerdict, string> = {
  matched: 'Matched',
  'not-matched': 'Not Matched',
  'not-held': 'Not Held',
};

/**
 * The tag each verdict wears in the table's result column.
 *
 * All three are design system variants that already clear AA: green 700 and
 * amber 700 carry white at 5.48:1 and 5.02:1, and neutral is slate 700 on
 * slate 200 at 8.4:1.
 */
export const VERDICT_TAGS: Record<ComparisonVerdict, string> = {
  matched: 'alp-status-tag--primary',
  'not-matched': 'alp-status-tag--warning',
  'not-held': 'alp-status-tag--neutral',
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
  private readonly locale = inject(LOCALE_ID);

  protected readonly noData = NO_DATA;
  protected readonly verdictLabels = VERDICT_LABELS;
  protected readonly verdictTags = VERDICT_TAGS;

  /**
   * Which layout the comparison is in.
   *
   * Held on the component rather than in a service: it is how one rep is
   * reading one screen at one moment, not something another screen has any
   * business knowing, and coming back to the comparison fresh should show it
   * the way it is meant to be read first.
   */
  private readonly currentView = signal<ComparisonView>('grouped');

  protected readonly view = this.currentView.asReadonly();

  protected showView(view: ComparisonView): void {
    this.currentView.set(view);
  }

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
   *
   * A count of none is dropped rather than shown as a nought, which is what the
   * group summary does with the same indicators: the policy holds no third
   * parties, so nothing on either screen mentions them.
   */
  protected readonly signposts = computed<PolicyTileSignpost[]>(() => {
    const clients = this.ctx.clients();
    return [
      { label: 'Interested Parties', value: clients.filter((client) => client.id).length },
      { label: 'Third Parties', value: clients.filter((client) => client.thirdParty).length },
    ].filter((signpost) => signpost.value > 0);
  });

  /** The pension the reference resolved to, and the address held against it. */
  protected readonly detail = this.matches.detail;
  protected readonly theirAddress = this.matches.address;

  /** How long the reference stays valid, written as every other date is. */
  protected readonly validUntil = computed(() => this.asDate(this.detail()?.pensionValidUntill));

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
   * Every field the comparison covers, in the order a rep reads them.
   *
   * A section with nothing in it is dropped rather than carried empty, so a
   * record holding no alternate surnames and no address simply compares fewer
   * fields. The sections themselves no longer appear on screen; each field
   * carries its section's name onto its tile.
   */
  protected readonly sections = computed<ComparisonSection[]>(() =>
    [
      { title: 'Identity', rows: this.identityRows() },
      { title: 'Alternate Surnames', rows: this.alternateSurnameRows() },
      { title: 'Contact', rows: this.contactRows() },
      { title: 'Address', rows: this.addressRows() },
    ].filter((section) => section.rows.length > 0),
  );

  /** Every field compared, each still knowing which section it belongs to. */
  private readonly fields = computed<ComparisonField[]>(() =>
    this.sections().flatMap((section) =>
      section.rows.map((row) => ({ ...row, section: section.title })),
    ),
  );

  protected readonly fieldCount = computed(() => this.fields().length);

  /**
   * The comparison grouped by what it found rather than by section.
   *
   * Field by field down a list, every row looks alike and the rep has to read
   * all of them to find the three that matter. Grouped this way each one can be
   * shown at the density it deserves: a tile per difference, a line per
   * agreement, and a name per field neither platform holds.
   */
  protected readonly differences = computed(() =>
    this.fields().filter((field) => field.verdict === 'not-matched'),
  );

  protected readonly agreements = computed(() =>
    this.fields().filter((field) => field.verdict === 'matched'),
  );

  protected readonly notHeld = computed(() =>
    this.fields().filter((field) => field.verdict === 'not-held'),
  );

  /**
   * The same three groups the panels are in, for the table to run through.
   *
   * The table used to run by section, which put a field that matched next to
   * one that did not and left the rep reading the result column to sort them
   * out. Grouped, the two layouts answer the same question in the same order
   * and differ only in how much they show at once.
   *
   * A group with nothing in it is dropped rather than left as a heading with no
   * rows under it.
   */
  protected readonly verdictGroups = computed(() =>
    (
      [
        { verdict: 'matched', fields: this.agreements() },
        { verdict: 'not-matched', fields: this.differences() },
        { verdict: 'not-held', fields: this.notHeld() },
      ] as const
    ).filter((group) => group.fields.length > 0),
  );

  /**
   * Which groups are open.
   *
   * Held here rather than left to the details elements, so one control can open
   * and close all three and still agree with what is on screen: every group
   * reports its own toggle back, including the ones the rep works by hand.
   *
   * What matched and what differs are open on arrival. What neither platform
   * holds sits last and closed: it is the group with nothing in it to work
   * through, so it says its piece in its header and stays out of the way.
   */
  private readonly groups = signal<Record<ComparisonVerdict, boolean>>({
    matched: true,
    'not-matched': true,
    'not-held': false,
  });

  protected readonly openGroups = this.groups.asReadonly();

  /**
   * Whether anything is open, which is what the one control works from: with a
   * group open there is something to collapse, and with all of them closed the
   * only useful thing it can do is open them.
   */
  protected readonly anyOpen = computed(() => Object.values(this.groups()).some(Boolean));

  /**
   * The fields in each group, named on its header.
   *
   * A closed group still has to say what is in it, or closing one hides the very
   * thing the rep was about to look for.
   */
  protected readonly agreementLabels = computed(() => this.labels(this.agreements()));
  protected readonly differenceLabels = computed(() => this.labels(this.differences()));
  protected readonly notHeldLabels = computed(() => this.labels(this.notHeld()));

  /**
   * A group opening or closing, however it happened.
   *
   * The details element owns its own state, so it is read back off the element
   * rather than assumed, which keeps the expand-all control honest when a rep
   * has been opening groups by hand.
   */
  protected onGroupToggle(group: ComparisonVerdict, event: Event): void {
    const open = (event.target as HTMLDetailsElement).open;
    if (this.groups()[group] === open) return;
    this.groups.update((groups) => ({ ...groups, [group]: open }));
  }

  /**
   * Opens or closes every group at once, overriding wherever they were left.
   *
   * One control with one meaning at any moment: anything open and it closes
   * everything, nothing open and it opens everything. Mixed states resolve the
   * same way, so the rep never has to press it twice to see what it does.
   */
  protected toggleAllGroups(): void {
    const open = !this.anyOpen();
    this.groups.set({ matched: open, 'not-matched': open, 'not-held': open });
  }

  /** The field names of a group, for its header to summarise it with. */
  private labels(fields: ComparisonField[]): string {
    return fields.map((field) => field.label).join(' · ');
  }

  /**
   * Takes the rep into the group summary, where the call carries on.
   *
   * The possible match is left behind rather than carried along: deciding this
   * record is the caller is deciding to work their policy, so the app moves into
   * that policy's own context and the reference, the heading, the breadcrumb and
   * the other platform's record all go with the context that held them.
   */
  protected async openGroupSummary(): Promise<void> {
    await this.ctx.activatePolicy(this.ctx.pensionReference());
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
      agreedValue: weHold ? ourValue : theyHold ? theirValue : NO_DATA,
      spellingsDiffer: theyHold && weHold && theirValue !== ourValue,
    };
  }

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
  private asDate(value: string | undefined): string {
    const trimmed = (value ?? '').trim();
    if (!hasValue(trimmed)) return trimmed;

    try {
      return formatDate(trimmed, 'dd MMM yyyy', this.locale);
    } catch {
      return trimmed;
    }
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
