import {
  Component,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentType } from '../../models/script-builder.models';

@Component({
  selector: 'alpha-type-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './type-picker.component.html'
})
export class TypePickerComponent implements AfterViewInit {
  @ViewChild('dialogRef') dialogRef!: ElementRef<HTMLDialogElement>;

  @Output() selected = new EventEmitter<ContentType>();
  @Output() closed = new EventEmitter<void>();

  ngAfterViewInit() {
    this.dialogRef.nativeElement.showModal();
  }

  select(type: ContentType) {
    this.dialogRef.nativeElement.close();
    this.selected.emit(type);
  }

  close() {
    this.dialogRef.nativeElement.close();
    this.closed.emit();
  }

  onDialogCancel() {
    this.closed.emit();
  }
}