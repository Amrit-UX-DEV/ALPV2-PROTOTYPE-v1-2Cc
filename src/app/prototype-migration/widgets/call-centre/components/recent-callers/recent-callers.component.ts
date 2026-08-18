import { Component, Output, EventEmitter, OnInit, inject, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CallTransferService, TransferredCall } from '../../call-transfer.service';

export interface RecentCaller {
  id: string;
  name: string;
  role: string;
  callDateTime: string;
}

@Component({
  selector: 'alpha-recent-callers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recent-callers.component.html'
})
export class RecentCallersComponent implements OnInit {

  private readonly transfers = inject(CallTransferService);

  /**
   * The policy these callers belong to.
   *
   * A signal input rather than @Input, because the policy can change while this
   * component stays alive: searching another policy in the same call swaps the
   * context without the component being recreated, so loading once in ngOnInit
   * would leave one policy's callers showing against another.
   */
  readonly policyNumber = input<string>('');

  @Output() callerSelected = new EventEmitter<RecentCaller>();

  /** What the file holds, filtered below to what belongs to this policy. */
  private readonly loaded = signal<{ policyNumber?: string; recentCallers: RecentCaller[] }>({
    recentCallers: [],
  });

  readonly recentCallers = computed(() => {
    const data = this.loaded();
    const wanted = this.policyNumber();

    // Recent callers belong to a policy, and the file says which. Showing them
    // against a different policy would put one policy's callers on another.
    if (wanted && data.policyNumber && data.policyNumber !== wanted) return [];
    return data.recentCallers;
  });

  readonly currentIndex = signal(0);
  readonly showFullList = signal(false);

  /**
   * Transferred calls belong to the service, not to this component: they are
   * started from the contact information and call information steps and only
   * displayed here.
   */
  readonly transferredCalls = this.transfers.calls;

  readonly currentCaller = computed(() => {
    const callers = this.recentCallers();
    if (callers.length === 0) return null;

    // The index can outlive the list it pointed into, when a shorter list
    // arrives for a different policy.
    return callers[Math.min(this.currentIndex(), callers.length - 1)];
  });

  readonly totalCallers = computed(() => this.recentCallers().length);

  readonly needsDpa = this.transfers.needsDpa;

  async ngOnInit() {
    try {
      const res = await fetch('assets/data/call-rep-scripts/recent-callers.json');
      const data = await res.json();
      this.loaded.set({
        policyNumber: data.policyNumber,
        recentCallers: data.recentCallers || [],
      });
    } catch (err) {
      console.error('Failed to load recent callers', err);
    }
  }

  // Format elapsed time (minutes ago, hours ago, days ago...)
  getElapsedTime(seconds: number): string {
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    const days = Math.floor(seconds / 86400);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  bailoutTransferredCall(call: TransferredCall) {
    this.transfers.bailout(call);
  }

  resumeTransferredCall(call: TransferredCall) {
    this.callerSelected.emit({
      id: call.id,
      name: call.name,
      role: call.role,
      callDateTime: call.transferredAt.toISOString()
    });
  }

  // ==================== EXISTING METHODS (unchanged) ====================
  selectCurrentCaller() {
    const caller = this.currentCaller();
    if (caller) {
      this.callerSelected.emit(caller);
    }
  }

  viewDetails(caller: RecentCaller | any) {
    console.log('View Details clicked:', caller);
    alert(`Details for ${caller.name} (${caller.role})`);
  }

  next() {
    if (this.currentIndex() < this.totalCallers() - 1) {
      this.currentIndex.update(i => i + 1);
    }
  }

  previous() {
    if (this.currentIndex() > 0) {
      this.currentIndex.update(i => i - 1);
    }
  }

  openFullList() {
    this.showFullList.set(true);
  }

  closeFullList() {
    this.showFullList.set(false);
  }

  getDaysAgo(dateTime: string): string {
    const callDate = new Date(dateTime);
    const today = new Date();
    const diffTime = today.getTime() - callDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  }

  get sortedCallers() {
    return [...this.recentCallers()].sort((a, b) => 
      new Date(b.callDateTime).getTime() - new Date(a.callDateTime).getTime()
    );
  }

    transferCall() {
      this.transfers.transfer('General Transfer');
    }
}