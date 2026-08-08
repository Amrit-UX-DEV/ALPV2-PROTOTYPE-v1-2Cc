import { Component, EventEmitter, Output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface TransferReason {
  id: number;
  label: string;
}

@Component({
  selector: 'alpha-transfer-call-popover',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transfer-call-popover.component.html',
  styleUrls: ['./transfer-call-popover.component.css']
})
export class TransferCallPopoverComponent {

  @Output() transfer = new EventEmitter<{ reason: string; notes: string }>();
  @Output() close = new EventEmitter<void>();

  private allReasons: TransferReason[] = [
    { id: 1, label: 'Back Office' },
    { id: 2, label: 'Option 2' },
    { id: 3, label: 'Option 3' },
    { id: 4, label: 'Option 4' },
    { id: 5, label: 'Option 5' },
    { id: 6, label: 'Option 6' },
  ];

  readonly searchTerm = signal('');
  readonly selectedReason = signal<TransferReason | null>(null);
  readonly notes = signal('');
  readonly maxNotesLength = 200;

  readonly filteredReasons = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.allReasons;
    return this.allReasons.filter(r => 
      r.label.toLowerCase().includes(term)
    );
  });

  readonly notesLength = computed(() => this.notes().length);

  selectReason(reason: TransferReason) {
    this.selectedReason.set(reason);
  }

  updateNotes(value: string) {
    if (value.length <= this.maxNotesLength) {
      this.notes.set(value);
    }
  }

  confirmTransfer() {
    const reason = this.selectedReason();
    if (!reason) return;

    this.transfer.emit({
      reason: reason.label,
      notes: this.notes()
    });

    this.close.emit();
    this.reset();
  }

  cancel() {
    this.close.emit();
    this.reset();
  }

  private reset() {
    this.searchTerm.set('');
    this.selectedReason.set(null);
    this.notes.set('');
  }
}