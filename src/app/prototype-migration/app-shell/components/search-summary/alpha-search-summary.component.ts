import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import {
  AlpPolicyTileComponent,
  PolicyTileSignpost,
} from '../../../alp/policy-tile/alp-policy-tile.component';
import {
  ComparisonField,
  ComparisonService,
  ComparisonVerdict,
  NO_DATA,
  VERDICT_LABELS,
} from '../../../context/comparison.service';
import { PossibleMatchService } from '../../../context/possible-match.service';
import { PrototypeContextService } from '../../../context/prototype-context.service';
import { AppViewService } from '../../../ui/app-view.service';

/**
 * How the comparison is laid out.
 *
 * Grouped answers "what do I need to do something about", which is the question
 * a rep opens the screen with, one group at a time and at the density each group
 * earns. Table answers "what does the record say", every field on one line with
 * both values side by side, which is what somebody reading a record back or
 * checking one value wants. Same fields, same groups, same order, same verdicts:
 * only how much of each is shown differs.
 */
export type ComparisonView = 'grouped' | 'table';

/**
 * The tag each verdict wears on its group's row in the table, which is the same
 * chip its panel wears in the grouped layout.
 *
 * All three carry white text on a 600 or 700 level colour: green 5.48:1, amber
 * 5.02:1, slate 7.58:1. Not held used to be the neutral variant, slate 700 on
 * slate 200, which was legible in itself but all but disappeared into the tinted
 * row it sits on. Solid slate stands 6.9:1 clear of that row.
 */
export const VERDICT_TAGS: Record<ComparisonVerdict, string> = {
  matched: 'alp-status-tag--primary',
  'not-matched': 'alp-status-tag--warning',
  'not-held': 'alp-status-tag--neutral-strong',
};

/**
 * The dashboard reference summary.
 *
 * A caller reads out a dashboard reference. It belongs to a partial record held
 * on another platform, about someone who may or may not be one of our clients,
 * so the screen puts their record beside ours field by field: that comparison is
 * the whole point of the screen, and it is what the rep works from while filling
 * the gaps.
 *
 * The comparison itself is made by ComparisonService, which the dashboard
 * reference work plan reads too. This screen decides how much of it to show and
 * in what order, and nothing more.
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
  private readonly comparison = inject(ComparisonService);
  private readonly views = inject(AppViewService);

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
   * The badges beside the status, which are the policy's own: the group summary
   * shows the same ones, and a literal here would only agree with it until one
   * of the two was edited.
   */
  protected readonly policyFlags = computed(() => this.ctx.policy()?.flags ?? []);

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

  /** The pension the reference resolved to. */
  protected readonly detail = this.matches.detail;

  /** How long the reference stays valid, written as every other date is. */
  protected readonly validUntil = computed(() =>
    this.comparison.asDate(this.detail()?.pensionValidUntill),
  );

  /**
   * The comparison grouped by what it found rather than by section.
   *
   * Field by field down a list, every row looks alike and the rep has to read
   * all of them to find the three that matter. Grouped this way each one can be
   * shown at the density it deserves: a tile per difference, a line per
   * agreement, and a name per field neither platform holds.
   */
  protected readonly differences = this.comparison.differences;
  protected readonly agreements = this.comparison.agreements;
  protected readonly notHeld = this.comparison.notHeld;

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
   * What each group's header says, in both layouts.
   *
   * One wording, read from one place, because the two layouts are two views of
   * the same comparison: a panel saying four of sixteen fields match and a table
   * row saying something else about the same four would be a bug the rep has to
   * work out for themselves.
   *
   * Not held is counted but not compared, so it is not "of sixteen": nothing was
   * weighed up, and putting it in the same proportion as the other two would
   * suggest it was.
   */
  protected readonly groupTitles = computed<Record<ComparisonVerdict, string>>(() => {
    const total = this.comparison.fieldCount();
    return {
      matched: `${this.agreements().length} of ${total} fields match`,
      'not-matched': `${this.differences().length} of ${total} fields differ`,
      'not-held': `${this.notHeld().length} fields neither platform holds`,
    };
  });

  /**
   * How the groups stand before the rep has touched them.
   *
   * What differs is open, because it is the work. What neither platform holds is
   * closed, because there is none in it. What matched is closed while anything
   * differs: a rep opening the screen is looking for what to do about it, and
   * the twelve agreeing fields are what they would otherwise scroll past to
   * find the two that need them.
   *
   * Where nothing differs, what matched is the whole comparison, so it opens: a
   * screen that says every field agrees and shows none of them has hidden the
   * only thing it has to say.
   *
   * A computed rather than a written-down state, because the comparison arrives
   * after the screen does. The rule is read off the fields themselves, so it
   * cannot fall out of step with them.
   */
  private readonly defaultOpen = computed<Record<ComparisonVerdict, boolean>>(() => ({
    matched: this.differences().length === 0,
    'not-matched': true,
    'not-held': false,
  }));

  /**
   * Which groups the rep has opened or closed by hand, kept per layout.
   *
   * Overrides rather than a full state, so a group nobody has touched follows
   * the rule above however the fields turn out, and one that has been touched
   * stays exactly where it was put.
   *
   * Two records rather than one, because opening a group means something
   * different in each. Closing what matched in the panels puts three lines of
   * agreement away; closing it in the table puts a dozen rows away. A rep who
   * has arranged one layout to read it has not asked for the other to be
   * arranged the same, and coming back to it changed is a small surprise nobody
   * needs.
   */
  private readonly overrides = signal<
    Record<ComparisonView, Partial<Record<ComparisonVerdict, boolean>>>
  >({
    grouped: {},
    table: {},
  });

  /** The open groups of the layout on screen, which is the only one that can be read. */
  protected readonly openGroups = computed<Record<ComparisonVerdict, boolean>>(() => {
    const fallback = this.defaultOpen();
    const chosen = this.overrides()[this.currentView()];
    return {
      matched: chosen.matched ?? fallback.matched,
      'not-matched': chosen['not-matched'] ?? fallback['not-matched'],
      'not-held': chosen['not-held'] ?? fallback['not-held'],
    };
  });

  /**
   * Whether every group is open, which is what the one control works from.
   *
   * All of them open and the only thing left to do is close them; anything
   * closed and the useful action is to open everything. So on arrival, with what
   * matched put away, the control offers to expand.
   */
  protected readonly allOpen = computed(() => Object.values(this.openGroups()).every(Boolean));

  /**
   * What the control says, which is what it will do and what it will do it to.
   *
   * It acts on the layout showing, so it names it: a rep who has collapsed
   * everything in the table and switched to the panels needs to see that the
   * button is now talking about the panels, or pressing it looks broken.
   */
  protected readonly groupToggleLabel = computed(() => {
    const action = this.allOpen() ? 'Collapse' : 'Expand';
    const layout = this.currentView() === 'table' ? 'table' : 'grid';
    return `${action} all ${layout} groups`;
  });

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
    if (this.openGroups()[group] === open) return;
    this.setGroup(group, open);
  }

  /**
   * A group opened or closed from the table, where there is no details element
   * to own the state: the row is a button and this is what it does.
   */
  protected toggleGroup(group: ComparisonVerdict): void {
    this.setGroup(group, !this.openGroups()[group]);
  }

  /**
   * Opens or closes every group at once, overriding wherever they were left.
   *
   * One control with one meaning at any moment: everything open and it closes
   * everything, anything closed and it opens everything. Mixed states resolve
   * the same way, so the rep never has to press it twice to see what it does.
   */
  protected toggleAllGroups(): void {
    const open = !this.allOpen();
    const view = this.currentView();
    this.overrides.update((all) => ({
      ...all,
      [view]: { matched: open, 'not-matched': open, 'not-held': open },
    }));
  }

  /** One group of the layout showing, leaving the other layout as the rep left it. */
  private setGroup(group: ComparisonVerdict, open: boolean): void {
    const view = this.currentView();
    this.overrides.update((all) => ({
      ...all,
      [view]: { ...all[view], [group]: open },
    }));
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
}
