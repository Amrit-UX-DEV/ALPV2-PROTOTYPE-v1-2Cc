import { Injectable, computed, signal } from '@angular/core';

import {
  ContextClient,
  ContextIndex,
  ContextIndexEntry,
  ContextScope,
  ContextSelection,
  PrototypeContext,
} from './prototype-context.model';

/** Where context files live. Adding a context means adding a file here. */
export const CONTEXT_DATA_PATH = 'assets/data/contexts';

/** Lists the contexts a search can find. */
export const CONTEXT_INDEX_FILE = `${CONTEXT_DATA_PATH}/index.json`;

/**
 * Where the app starts, and where it returns when a context is cleared.
 *
 * Non context is a context, not a gap: nothing has been searched yet, so there
 * is no policy to describe. Holding it as a real value rather than null is
 * what keeps every consumer free of null checks, and it gives the header
 * something to name.
 */
export const NON_CONTEXT: PrototypeContext = {
  id: 'non-context',
  kind: 'none',
  label: 'Non Context',
  screen: { breadcrumbs: ['Search'], headingPrefix: 'Context:' },
};

/** What a search did, so a screen can tell "not searched" from "no match". */
export type SearchState = 'idle' | 'found' | 'not-found';

/**
 * Holds the context the prototype is currently demonstrating.
 *
 * Consumers read the computed accessors rather than the whole context, so a
 * template binds to ctx.policy() instead of reaching through an optional
 * chain. The context signal itself is never null: before anything is searched
 * it holds NON_CONTEXT, whose policy is absent, so a screen showing policy
 * detail asks hasPolicy() once rather than guarding every field.
 */
@Injectable({ providedIn: 'root' })
export class PrototypeContextService {
  private readonly current = signal<PrototypeContext>(NON_CONTEXT);

  readonly context = this.current.asReadonly();
  readonly screen = computed(() => this.current().screen);

  /** Absent in non context. */
  readonly policy = computed(() => this.current().policy);

  /** Whether there is a policy to show. False before a search finds one. */
  readonly hasPolicy = computed(() => this.policy() !== undefined);

  /** 'none' until a context is activated, then whatever the context declares. */
  readonly kind = computed(() => this.current().kind ?? 'policy');

  /** What to call the current context where there is no policy to summarise. */
  readonly label = computed(() => this.current().label ?? NON_CONTEXT.label!);

  /** The journey this context runs, if it names one. */
  readonly journey = computed(() => this.current().journey);

  /** The clients attached to the policy, in render order. Empty in non context. */
  readonly clients = computed(() => this.policy()?.clients ?? []);

  /** Clients flagged for extra care, i.e. those with at least one entry. */
  readonly extraCareClients = computed(() =>
    this.clients().filter((c) => (c.extraCare?.length ?? 0) > 0),
  );

  /** Drives the Extra Care indicator in the header. */
  readonly hasExtraCareClient = computed(() => this.extraCareClients().length > 0);

  /**
   * Looks a client up by identity key.
   *
   * The group summary has hand-authored tiles for particular clients, mixed in
   * with entries that are not modelled yet, so those tiles cannot simply be
   * looped over. Until they can, they name the client they show.
   */
  clientByKey(key: string): ContextClient | undefined {
    return this.clients().find((c) => c.key === key);
  }

  private readonly currentSelection = signal<ContextSelection | null>(null);

  /** What the user has selected, and therefore the context the app is in. */
  readonly selection = this.currentSelection.asReadonly();

  /** The selected client, when the selection is a client at all. */
  readonly selectedClient = computed(() => {
    const selected = this.currentSelection();
    return selected?.scope === 'client' ? this.clientByKey(selected.key) : undefined;
  });

  /**
   * Puts the app into a context.
   *
   * Selection deliberately lives here rather than in the screen that was
   * clicked, because the whole prototype reads from it: choosing a client is
   * what should decide which policies highlight and which options are offered.
   */
  select(scope: ContextScope, key: string): void {
    this.currentSelection.set({ scope, key });
  }

  isSelected(scope: ContextScope, key: string): boolean {
    const selected = this.currentSelection();
    return selected?.scope === scope && selected.key === key;
  }

  private readonly registry = signal<ContextIndexEntry[]>([]);

  /** Every context a search can find. */
  readonly contexts = this.registry.asReadonly();

  private readonly lastSearch = signal<SearchState>('idle');

  /** Whether the last search found something, found nothing, or never ran. */
  readonly searchState = this.lastSearch.asReadonly();

  /**
   * Loads the registry. Awaited during bootstrap so a search can resolve
   * immediately; the app still starts in non context either way.
   */
  async loadIndex(): Promise<void> {
    try {
      const response = await fetch(`${CONTEXT_INDEX_FILE}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const index = (await response.json()) as ContextIndex;
      this.registry.set(index.contexts ?? []);
    } catch (err) {
      console.error('Failed to load the context index, search will find nothing:', err);
    }
  }

  /**
   * Finds contexts matching what was keyed into a search form.
   *
   * A reference is matched exactly, ignoring case and surrounding space, because
   * it is an identifier: keying 8000 should not find 80007. A client search
   * matches on part of a name instead, which is how someone would actually
   * search for a person.
   */
  search(criteria: string, term: string): ContextIndexEntry[] {
    const needle = term.trim().toLowerCase();
    if (!needle) return [];

    return this.registry().filter((entry) => {
      if (entry.criteria.toLowerCase() !== criteria.trim().toLowerCase()) return false;
      if (criteria.toLowerCase() === 'client') {
        return entry.clients.some((name) => name.toLowerCase().includes(needle));
      }
      return entry.reference.toLowerCase() === needle;
    });
  }

  /**
   * Searches, and activates the context when exactly one thing matches.
   *
   * Returns what happened so the caller can show its own not-found message
   * without repeating the matching rules.
   */
  async searchAndActivate(criteria: string, term: string): Promise<SearchState> {
    const matches = this.search(criteria, term);
    if (matches.length === 0) {
      this.lastSearch.set('not-found');
      return 'not-found';
    }

    await this.activate(matches[0].id);
    this.lastSearch.set('found');
    return 'found';
  }

  /** Puts the app back into non context, as the search form's Clear does. */
  clear(): void {
    this.current.set(NON_CONTEXT);
    this.currentSelection.set(null);
    this.lastSearch.set('idle');
  }

  /**
   * Loads a context by id and makes it current.
   *
   * A failed load leaves the app in non context rather than in a half state,
   * so a missing file shows as "not found" instead of an empty policy.
   */
  async activate(id: string): Promise<void> {
    const entry = this.registry().find((c) => c.id === id);
    const file = entry?.file ?? `${id}.json`;

    try {
      const response = await fetch(`${CONTEXT_DATA_PATH}/${file}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const context = (await response.json()) as PrototypeContext;
      this.current.set({ kind: entry?.kind ?? 'policy', ...context });
      this.currentSelection.set(null);
    } catch (err) {
      console.error(`Failed to load context '${id}', staying in non context:`, err);
      this.clear();
    }
  }
}
