import { Injectable, computed, signal } from '@angular/core';

import {
  ContextClient,
  ContextIndex,
  ContextIndexEntry,
  ContextPolicy,
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
 * Having nothing in hand is a state, not a gap: nothing has been searched yet,
 * so there is no policy to describe. Holding it as a real value rather than
 * null is what keeps every consumer free of null checks, and it gives the
 * header something to name.
 *
 * The label is what a rep is told, so it says what has happened rather than
 * naming the mechanism: 'no context' is our word for this, not theirs.
 *
 * The heading prefix is deliberately empty. A real context names the screen it
 * is showing, as in 'Group Summary: Policy 80007', but there is no screen and
 * no policy to prefix here, so the label stands on its own.
 */
export const NO_CONTEXT: PrototypeContext = {
  id: 'no-context',
  kind: 'none',
  label: 'Nothing searched yet',
  screen: { breadcrumbs: ['Search'], headingPrefix: '' },
};

/** What a search did, so a screen can tell "not searched" from "no match". */
export type SearchState = 'idle' | 'found' | 'not-found';

/**
 * Holds the context the prototype is currently demonstrating.
 *
 * Consumers read the computed accessors rather than the whole context, so a
 * template binds to ctx.policy() instead of reaching through an optional
 * chain. The context signal itself is never null: before anything is searched
 * it holds NO_CONTEXT, whose policy is absent, so a screen showing policy
 * detail asks hasPolicy() once rather than guarding every field.
 */
@Injectable({ providedIn: 'root' })
export class PrototypeContextService {
  private readonly current = signal<PrototypeContext>(NO_CONTEXT);

  readonly context = this.current.asReadonly();
  readonly screen = computed(() => this.current().screen);

  /** Absent in no context. */
  readonly policy = computed(() => this.current().policy);

  /** Whether there is a policy to show. False before a search finds one. */
  readonly hasPolicy = computed(() => this.policy() !== undefined);

  /**
   * The policy the header summarises, which is not always the one the context
   * resolved.
   *
   * A possible match carries a policy so the caller can be taken through DPA,
   * but the rep has not moved onto it yet, so its context asks the header to
   * stay quiet about it. Everything else defaults to naming its policy.
   */
  readonly headerPolicy = computed(() =>
    this.screen().policyDetail === false ? undefined : this.policy(),
  );

  /** The pension the context points at, for moving on to that policy's own. */
  readonly pensionReference = computed(() => this.current().pensionReference);

  /** 'none' until a context is activated, then whatever the context declares. */
  readonly kind = computed(() => this.current().kind ?? 'policy');

  /** What to call the current context where there is no policy to summarise. */
  readonly label = computed(() => this.current().label ?? NO_CONTEXT.label!);

  /** What was keyed to find the current context, empty when nothing was. */
  readonly reference = computed(() => this.current().reference ?? '');

  /** The journey this context runs, if it names one. */
  readonly journey = computed(() => this.current().journey);

  /** The clients attached to the policy, in render order. Empty in no context. */
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
   * immediately; the app still starts in no context either way.
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

  /**
   * Moves from a context that points at a policy into that policy's own context.
   *
   * This is how a possible match is left behind: the rep decides the record is
   * their caller and carries on with the policy, so the app stops being in a
   * possible match altogether rather than keeping it alongside. The record, the
   * heading and the breadcrumb all follow from the context, so they all change
   * with it.
   */
  async activatePolicy(reference: string | undefined): Promise<void> {
    if (!reference) return;

    const entry = this.policyEntry(reference);
    if (!entry) {
      console.error(`No policy context for reference '${reference}', staying where we are.`);
      return;
    }

    await this.activate(entry.id);
  }

  /** Puts the app back into no context, as the search form's Clear does. */
  clear(): void {
    this.current.set(NO_CONTEXT);
    this.currentSelection.set(null);
    this.lastSearch.set('idle');
  }

  /**
   * Loads a context by id and makes it current.
   *
   * A failed load leaves the app in no context rather than in a half state,
   * so a missing file shows as "not found" instead of an empty policy.
   */
  async activate(id: string): Promise<void> {
    const entry = this.registry().find((c) => c.id === id);
    const file = entry?.file ?? `${id}.json`;

    try {
      const context = await this.load(file);
      const policy = context.policy ?? (await this.policyFor(context.pensionReference));
      this.current.set({
        kind: entry?.kind ?? 'policy',
        ...context,
        ...(policy ? { policy } : {}),
      });

      // Activating a policy context selects that policy, so the group summary
      // opens on the thing that was searched for rather than with nothing
      // selected. Anything without a policy has nothing to select.
      this.currentSelection.set(policy ? { scope: 'policy', key: policy.number } : null);
    } catch (err) {
      console.error(`Failed to load context '${id}', staying in no context:`, err);
      this.clear();
    }
  }

  /** The registry entry for a policy reference, which is how a policy is found. */
  private policyEntry(reference: string): ContextIndexEntry | undefined {
    return this.registry().find(
      (c) => c.criteria.toLowerCase() === 'policy' && c.reference === reference,
    );
  }

  /** Reads a context file. Throws, so the caller decides what a failure means. */
  private async load(file: string): Promise<PrototypeContext> {
    const response = await fetch(`${CONTEXT_DATA_PATH}/${file}?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as PrototypeContext;
  }

  /**
   * The policy a pension reference names, looked up through the registry.
   *
   * A missing policy is not fatal: the context still activates, and the screens
   * that need a policy show their empty state, which is a truer picture of a
   * broken link than refusing to open the context at all.
   */
  private async policyFor(reference: string | undefined): Promise<ContextPolicy | undefined> {
    if (!reference) return undefined;

    const entry = this.policyEntry(reference);
    if (!entry) {
      console.error(`No policy context for pension reference '${reference}'.`);
      return undefined;
    }

    try {
      return (await this.load(entry.file)).policy;
    } catch (err) {
      console.error(`Failed to load policy '${reference}' for a possible match:`, err);
      return undefined;
    }
  }
}
