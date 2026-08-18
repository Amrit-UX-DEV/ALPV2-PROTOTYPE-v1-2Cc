import { Injectable, WritableSignal, computed, signal } from '@angular/core';

/** A call handed to another team, with the clock running since it was passed on. */
export interface TransferredCall {
  id: string;
  name: string;
  role: string;
  type: 'transferred';
  reason: string;
  notes: string;
  transferredAt: Date;
  /** Counts up, so the tile can show how long the caller has been waiting. */
  elapsedSeconds: WritableSignal<number>;
  status: string;
}

/** How long before a transferred call has to pass DPA again, in seconds. */
const DPA_EXPIRY_SECONDS = 120;

/**
 * Transferred calls, held apart from the step that shows them.
 *
 * A rep transfers a call from the contact information step or the call
 * information step, but the tile for it appears next to the recent callers back
 * in step one. Those are three different components, so the transfer cannot
 * belong to any one of them.
 */
@Injectable({ providedIn: 'root' })
export class CallTransferService {
  private readonly transferred = signal<TransferredCall[]>([]);

  readonly calls = this.transferred.asReadonly();

  /** True once a transferred call has been waiting long enough to need DPA again. */
  readonly needsDpa = computed(() =>
    this.transferred().some((call) => call.elapsedSeconds() >= DPA_EXPIRY_SECONDS),
  );

  private timers = new Map<string, ReturnType<typeof setInterval>>();

  /**
   * Transfers the call, unless one is already out: the prototype demonstrates a
   * single transfer at a time.
   */
  transfer(reason: string, notes: string = ''): void {
    if (this.transferred().length > 0) return;

    const call: TransferredCall = {
      id: Date.now().toString(),
      name: 'Mr Joe Bloggs',
      role: 'Policy Holder, Life 1',
      type: 'transferred',
      reason,
      notes,
      transferredAt: new Date(),
      elapsedSeconds: signal(0),
      status: 'active',
    };

    this.transferred.set([call]);
    this.timers.set(
      call.id,
      setInterval(() => call.elapsedSeconds.update((seconds) => seconds + 1), 1000),
    );
  }

  /** Drops the transferred call and stops its clock. */
  bailout(call: TransferredCall): void {
    const timer = this.timers.get(call.id);
    if (timer !== undefined) {
      clearInterval(timer);
      this.timers.delete(call.id);
    }
    this.transferred.update((calls) => calls.filter((c) => c.id !== call.id));
  }
}
