import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'alpha-reorder-confirm',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reorder-confirm.component.html',
  styleUrls: ['./reorder-confirm.component.css']
})
export class ReorderConfirmComponent {
  @Output() confirmed = new EventEmitter<boolean>(); // true = don't show again
  @Output() cancelled = new EventEmitter<void>();

  confirm(dontShowAgain: boolean) {
    this.confirmed.emit(dontShowAgain);
  }

  cancel() {
    this.cancelled.emit();
  }
}