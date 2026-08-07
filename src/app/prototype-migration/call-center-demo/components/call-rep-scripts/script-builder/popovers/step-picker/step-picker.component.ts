import { Component, Input, Output, EventEmitter, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'alpha-step-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step-picker.component.html',
  styleUrls: ['./step-picker.component.css']
})
export class StepPickerComponent implements OnChanges {

  @Input() stepIds: string[] = [];
  @Input() currentStepId: string | null = null;

  @Output() saved = new EventEmitter<string | null>();
  @Output() closed = new EventEmitter<void>();

  readonly selectedId = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['currentStepId']) {
      this.selectedId.set(this.currentStepId);
    }
  }

  selectTile(id: string) {
    // Toggle: click again to deselect
    if (this.selectedId() === id) {
      this.selectedId.set(null);
    } else {
      this.selectedId.set(id);
    }
  }

  save() {
    this.saved.emit(this.selectedId());
  }

  close() {
    this.closed.emit();
  }
}