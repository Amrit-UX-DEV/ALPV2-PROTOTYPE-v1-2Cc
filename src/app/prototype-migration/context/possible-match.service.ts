import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { PossibleMatchRecord } from './possible-match.model';
import { PrototypeContextService } from './prototype-context.service';

/** Where the other platform's possible match records live. */
export const POSSIBLE_MATCH_DATA_PATH = 'assets/data/possible-matches';

/**
 * Holds the other platform's record for the possible match the app is in.
 *
 * It is kept apart from the context service because it is somebody else's data:
 * the context says which record to read, and this reads it. Nothing else in the
 * prototype has to know that a second platform exists.
 */
@Injectable({ providedIn: 'root' })
export class PossibleMatchService {
  private readonly ctx = inject(PrototypeContextService);

  private readonly loaded = signal<PossibleMatchRecord | undefined>(undefined);

  /** The record for the current possible match, absent in any other context. */
  readonly record = this.loaded.asReadonly();

  private readonly reading = signal(false);

  /**
   * Whether a record is on its way.
   *
   * Without it, no record and a record still being fetched look the same, and a
   * screen would show its failure message for as long as the fetch takes.
   */
  readonly loading = this.reading.asReadonly();

  /**
   * The pension the reference resolved to.
   *
   * A possible match reference always carries exactly one pension reference, so
   * the screen reads the one entry rather than looping over the array their
   * contract allows for.
   */
  readonly detail = computed(() => this.loaded()?.pmrDetails?.[0]);

  /** The address on that pension, if they hold one. */
  readonly address = computed(() => this.detail()?.addresses?.[0]);

  constructor() {
    // The record follows the context, so entering a possible match by either
    // search form loads it, and leaving clears it. Nothing has to remember to
    // ask.
    effect(() => {
      const file = this.ctx.context().record;
      if (!file) {
        this.loaded.set(undefined);
        return;
      }
      void this.load(file);
    });
  }

  private async load(file: string): Promise<void> {
    this.reading.set(true);
    try {
      const response = await fetch(`${POSSIBLE_MATCH_DATA_PATH}/${file}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.loaded.set((await response.json()) as PossibleMatchRecord);
    } catch (err) {
      console.error(`Failed to load possible match record '${file}':`, err);
      this.loaded.set(undefined);
    } finally {
      this.reading.set(false);
    }
  }
}
