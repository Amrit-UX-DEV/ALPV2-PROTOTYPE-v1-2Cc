import { Injectable, computed, inject, signal } from '@angular/core';

import { PrototypeContextService } from './prototype-context.service';
import { AppViewService } from '../ui/app-view.service';

/**
 * A field's help, in the three parts it has to be shown in.
 *
 * The example is kept apart from the sentence around it because it cannot be
 * allowed to break: in a 230px menu panel the browser was breaking the line
 * after "e.g." and leaving the reference stranded on the next one, which is the
 * one thing in the sentence somebody is reading it for.
 */
export interface SearchCriteriaHint {
  lead: string;
  example: string;
  tail: string;
}

/**
 * The one search the prototype has, shared by every form that offers it.
 *
 * There are two search boxes, the left menu and the call centre widget, and a
 * rep may use either. They are not two searches: whichever is used, the app ends
 * up in the same context, so what was keyed and what came back are held here
 * rather than in either form. Both bind to these signals, which is what keeps
 * them showing the same thing without either knowing the other exists.
 */
@Injectable({ providedIn: 'root' })
export class ContextSearchService {
  private readonly ctx = inject(PrototypeContextService);
  private readonly views = inject(AppViewService);

  /** Matches the Search Criteria dropdowns, which open on Policy. */
  readonly criteria = signal('Policy');

  /** What has been keyed. Empty until someone types. */
  readonly term = signal('');

  readonly searching = signal(false);

  /**
   * Whether there is anything to search for.
   *
   * Both forms disable their Search button on this, so an empty reference
   * cannot be submitted: run() would return without doing anything, which
   * looks like the button is broken rather than not yet usable.
   */
  readonly canSearch = computed(() => this.term().trim().length > 0 && !this.searching());

  /**
   * What the reference field prompts for, following the criteria.
   *
   * A rep who has switched to Agent should not be told to enter a policy number.
   * Both forms bind to this, so the prompt cannot say one thing in the left menu
   * and another in the widget.
   *
   * Most criteria are answered with a number of their own name. The two that are
   * not say what they actually take: Client is matched on part of a name rather
   * than on a reference, and "Enter Other Number" would be nonsense.
   */
  readonly referencePlaceholder = computed(() => {
    const criteria = this.criteria();
    if (criteria === 'Client') return 'Enter Client Name';
    if (criteria === 'Possible Match') return 'Enter Possible Match Number';
    if (criteria === 'Other') return 'Enter Reference Number';
    return `Enter ${criteria} Number`;
  });

  /**
   * A word of help for criteria whose reference a rep may never have keyed.
   *
   * Every other criteria takes a number the rep already has in front of them. A
   * possible match reference does not come from us at all: it is read off the
   * pension dashboard, and it carries a prefix, so the field is the one place
   * somebody can be told what one looks like before they guess at it.
   *
   * Empty for everything else, which is what both forms show it on: a hint
   * standing under a field that does not need one is noise, and by the second
   * search it is noise nobody reads.
   */
  readonly criteriaHint = computed<SearchCriteriaHint | null>(() =>
    this.criteria() === 'Possible Match'
      ? {
          lead: 'Enter reference number',
          example: '(e.g. PMR12345678910)',
          tail: 'to find pension dashboard possible matches.',
        }
      : null,
  );

  private readonly missed = signal(false);
  private readonly missedTerm = signal('');
  private readonly missedCriteria = signal('');

  /** Whether the last search came back with nothing. */
  readonly notFound = this.missed.asReadonly();

  /** What was keyed for the search that failed. */
  readonly notFoundTerm = this.missedTerm.asReadonly();

  /**
   * What was being searched for when it failed, lowercased for a sentence.
   *
   * The criteria at the time of the search, not the criteria now: changing the
   * dropdown after a failed search must not silently reword the message into
   * something that was never searched for.
   */
  readonly notFoundLabel = computed(() => this.missedCriteria().toLowerCase());

  /**
   * The prefix every possible match reference carries.
   *
   * The one criteria whose format we know, because the format is not ours: the
   * pension dashboard issues these, and a reference read off it without this in
   * front of it was mis-heard or mis-keyed rather than not found.
   */
  private readonly possibleMatchPrefix = 'PMR';

  /**
   * Whether what has been keyed cannot be a possible match reference.
   *
   * Not a failed search: nothing has been looked for. A reference that does not
   * start with the prefix is the wrong thing entirely, and the sooner that is
   * said the less time a rep spends waiting on a search that was never going to
   * find anything.
   *
   * Judged against as much as has been keyed rather than the whole prefix, so it
   * is said at the first character that rules the reference out and not before:
   * P and PM are both still on their way to PMR, while anything else, at any
   * length, is already wrong. What follows the prefix is not checked at all; the
   * dashboard's own numbering is its business.
   *
   * Empty for every other criteria, whose references we do not issue and cannot
   * vouch for the shape of.
   */
  readonly formatWarning = computed(() => {
    if (this.criteria() !== 'Possible Match') return '';

    const keyed = this.term().trim().toUpperCase();
    if (!keyed) return '';

    const prefix = this.possibleMatchPrefix;
    const sofar = keyed.slice(0, prefix.length);
    return prefix.startsWith(sofar) ? '' : 'Invalid format entered';
  });

  /**
   * What came of the search, said in the same block as the field's help.
   *
   * Only ever the one thing, and only for a reference in the right shape: it was
   * looked for, and it is not there. A reference in the wrong shape is answered
   * by the warning above the field instead, which is a different thing to say
   * and is said about the field rather than about the search.
   */
  readonly criteriaNote = computed(() =>
    this.criteria() === 'Possible Match' && !this.formatWarning() && this.notFound()
      ? 'No match found'
      : '',
  );

  /**
   * Whether a failed search still needs its own block.
   *
   * Where the field has already said it, saying it again underneath is two
   * messages about one search, which reads as two things having gone wrong.
   */
  readonly showNotFoundBlock = computed(
    () => this.notFound() && !this.criteriaNote() && !this.formatWarning(),
  );

  setCriteria(criteria: string): void {
    this.criteria.set(criteria);
    this.clearMessage();
  }

  setTerm(term: string): void {
    this.term.set(term);
    this.clearMessage();
  }

  /**
   * Runs the search and, on a hit, puts the app into that context and brings its
   * group summary up. Both search boxes call this, so both have that effect.
   */
  async run(): Promise<void> {
    const term = this.term().trim();
    if (!term) return;

    const criteria = this.criteria();

    this.searching.set(true);
    const result = await this.ctx.searchAndActivate(criteria, term);
    this.searching.set(false);

    const failed = result === 'not-found';
    this.missed.set(failed);
    this.missedTerm.set(failed ? term : '');
    this.missedCriteria.set(failed ? criteria : '');

    if (result === 'found') {
      // Which screen answers a search depends on what was found, not on which
      // form ran it: a policy has a group summary, a possible match has only
      // the partial data held against the reference.
      this.views.show(this.ctx.kind() === 'possible-match' ? 'search-summary' : 'group-summary');
    }
  }

  /** Empties the search and returns the app to no context. */
  clear(): void {
    this.term.set('');
    this.clearMessage();
    this.ctx.clear();
  }

  private clearMessage(): void {
    this.missed.set(false);
    this.missedTerm.set('');
    this.missedCriteria.set('');
  }
}
