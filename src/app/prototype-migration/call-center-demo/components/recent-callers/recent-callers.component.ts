import { Component, Input, Output, EventEmitter, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  templateUrl: './recent-callers.component.html',
  styleUrls: ['./recent-callers.component.css']
})
export class RecentCallersComponent implements OnInit {

  @Input() policyNumber: string = '';

  @Output() callerSelected = new EventEmitter<RecentCaller>();

  readonly recentCallers = signal<RecentCaller[]>([]);
  readonly currentIndex = signal(0);
  readonly showFullList = signal(false);

  // === NEW: Transferred Calls ===
  readonly transferredCalls = signal<any[]>([]);

  readonly currentCaller = computed(() => {
    const callers = this.recentCallers();
    return callers.length > 0 ? callers[this.currentIndex()] : null;
  });

  readonly totalCallers = computed(() => this.recentCallers().length);

  // New: Check if any transferred call needs DPA (after 2 minutes)
  readonly needsDpa = computed(() => {
    return this.transferredCalls().some(call => call.elapsedSeconds() >= 120);
  });

  async ngOnInit() {
    try {
      const res = await fetch('assets/data/call-rep-scripts/recent-callers.json');
      const data = await res.json();
      this.recentCallers.set(data.recentCallers || []);
    } catch (err) {
      console.error('Failed to load recent callers', err);
    }
  }

  // ==================== TRANSFER CALL WITH REASON (from popover) ====================
  transferCallWithReason(reason: string, notes: string = '') {
    if (this.transferredCalls().length > 0) {
      console.log('Only one transferred call allowed at a time.');
      return;
    }

    const newTransferred = {
      id: Date.now().toString(),
      name: 'Mr Joe Bloggs',
      role: 'Policy Holder, Life 1',
      type: 'transferred',
      reason: reason,
      notes: notes,
      transferredAt: new Date(),
      elapsedSeconds: signal(0),        // Count UP
      status: 'active'
    };

    this.transferredCalls.set([newTransferred]);
    this.startElapsedTimer(newTransferred);
    
    console.log('✅ Transferred call with reason:', reason);
  }

  private startElapsedTimer(call: any) {
    const interval = setInterval(() => {
      call.elapsedSeconds.update((secs: number) => secs + 1);
    }, 1000);
  }

  // Format elapsed time (minutes ago, hours ago, days ago...)
  getElapsedTime(seconds: number): string {
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    const days = Math.floor(seconds / 86400);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  bailoutTransferredCall(call: any) {
    this.transferredCalls.update(calls => calls.filter(c => c.id !== call.id));
    console.log('Bailout: Transferred call removed');
  }

  resumeTransferredCall(call: any) {
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

    // Simple wrapper for backward compatibility (your main demo button)
    transferCall() {
      this.transferCallWithReason('General Transfer');
    }
}