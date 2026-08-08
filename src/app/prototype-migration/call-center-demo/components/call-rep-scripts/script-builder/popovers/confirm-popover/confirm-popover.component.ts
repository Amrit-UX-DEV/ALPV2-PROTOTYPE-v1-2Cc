import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  ElementRef,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'alpha-confirm-popover',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-popover.component.html',
  styleUrls: ['./confirm-popover.component.css']
})
export class ConfirmPopoverComponent implements AfterViewInit {
  @ViewChild('dialogRef') dialogRef!: ElementRef<HTMLDialogElement>;

  @Input() title = 'Are you sure?';
  @Input() message = 'This action cannot be undone.';
  @Input() confirmLabel = 'Yes, continue';
  @Input() cancelLabel = 'Cancel';
  @Input() showDontShowAgain = false;

  @Output() confirmed = new EventEmitter<boolean>(); // true = don't show again
  @Output() cancelled = new EventEmitter<void>();

  readonly dontShowAgain = signal(false);

  ngAfterViewInit() {
    this.dialogRef.nativeElement.showModal();
  }

  onDontShowChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.dontShowAgain.set(checked);
  }

  confirm() {
    this.dialogRef.nativeElement.close();
    this.confirmed.emit(this.showDontShowAgain ? this.dontShowAgain() : false);
  }

  cancel() {
    this.dialogRef.nativeElement.close();
    this.cancelled.emit();
  }

  onDialogCancel() {
    this.cancelled.emit();
  }
}
