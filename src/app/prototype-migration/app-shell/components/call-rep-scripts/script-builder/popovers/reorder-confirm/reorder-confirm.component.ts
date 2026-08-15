import {
  Component,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'alpha-reorder-confirm',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reorder-confirm.component.html'
})
export class ReorderConfirmComponent implements AfterViewInit {
  @ViewChild('dialogRef') dialogRef!: ElementRef<HTMLDialogElement>;

  @Output() confirmed = new EventEmitter<boolean>(); // true = don't show again
  @Output() cancelled = new EventEmitter<void>();

  ngAfterViewInit() {
    this.dialogRef.nativeElement.showModal();
  }

  confirm(dontShowAgain: boolean) {
    this.dialogRef.nativeElement.close();
    this.confirmed.emit(dontShowAgain);
  }

  cancel() {
    this.dialogRef.nativeElement.close();
    this.cancelled.emit();
  }

  onDialogCancel() {
    this.cancelled.emit();
  }
}