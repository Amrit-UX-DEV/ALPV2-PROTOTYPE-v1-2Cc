import { Injectable, computed, signal } from '@angular/core';

import {
  ContextClient,
  ContextScope,
  ContextSelection,
  PrototypeContext,
} from './prototype-context.model';

/** Where context files live. Adding a context means adding a file here. */
export const CONTEXT_DATA_PATH = 'assets/data/contexts';

/** Loaded when nothing else is requested. */
export const DEFAULT_CONTEXT_ID = 'policy-80007';

/**
 * Mirrors policy-80007.json.
 *
 * This exists only so the prototype never renders a blank header if the fetch
 * fails, for instance when a context file has not been deployed. In normal
 * operation loadContext() replaces it before the first render, so the JSON is
 * the thing to edit; this is the safety net, not the source of truth.
 */
const FALLBACK_CONTEXT: PrototypeContext = {
  id: DEFAULT_CONTEXT_ID,
  policy: {
    number: '80007',
    productName: 'Group Stakeholder Pen Plan Pre Nov 04',
    company: 'HSBC (LifePen)',
    policyType: 'Unit Linked',
    status: 'In Force',
    territory: 'Great Britain',
    currency: { label: 'UK Sterling', symbol: '£' },
    clients: [],
  },
  screen: { breadcrumbs: ['Search', 'Group Summary'], headingPrefix: 'Group Summary:' },
};

/**
 * Holds the context the prototype is currently demonstrating.
 *
 * Consumers read the computed accessors rather than the whole context, so a
 * template binds to ctx.policy().number instead of reaching through an
 * optional chain. The signal is never null, which keeps every consumer free of
 * null guards.
 */
@Injectable({ providedIn: 'root' })
export class PrototypeContextService {
  private readonly current = signal<PrototypeContext>(FALLBACK_CONTEXT);

  readonly context = this.current.asReadonly();
  readonly policy = computed(() => this.current().policy);
  readonly screen = computed(() => this.current().screen);

  /** The clients attached to the policy, in render order. */
  readonly clients = computed(() => this.policy().clients);

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

  /**
   * Replaces the current context. Awaited during bootstrap so the first render
   * already has real data; on failure the fallback above stays in place and
   * the prototype still renders.
   */
  async loadContext(id: string = DEFAULT_CONTEXT_ID): Promise<void> {
    try {
      const response = await fetch(`${CONTEXT_DATA_PATH}/${id}.json?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.current.set(await response.json());
    } catch (err) {
      console.error(`Failed to load context '${id}', keeping the fallback:`, err);
    }
  }
}
