import { Injectable, computed, inject, signal } from '@angular/core';

import { PrototypeContextService } from './prototype-context.service';
import { AppViewService } from '../ui/app-view.service';

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
