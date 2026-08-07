import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'alpha-confirm-popover',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-popover.component.html',
  styleUrls: ['./confirm-popover.component.css']
})
export class ConfirmPopoverComponent {
  @Input() title = 'Are you sure?';
  @Input() message = 'This action cannot be undone.';
  @Input() confirmLabel = 'Yes, continue';
  @Input() cancelLabel = 'Cancel';
  @Input() showDontShowAgain = false;

  @Output() confirmed = new EventEmitter<boolean>(); // true = don't show again
  @Output() cancelled = new EventEmitter<void>();

  readonly dontShowAgain = signal(false);

  onDontShowChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.dontShowAgain.set(checked);
  }

  confirm() {
    this.confirmed.emit(this.showDontShowAgain ? this.dontShowAgain() : false);
  }

  cancel() {
    this.cancelled.emit();
  }
}