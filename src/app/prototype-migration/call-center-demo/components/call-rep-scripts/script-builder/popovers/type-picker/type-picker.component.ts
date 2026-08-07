import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentType } from '../../models/script-builder.models';

@Component({
  selector: 'alpha-type-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './type-picker.component.html',
  styleUrls: ['./type-picker.component.css']
})
export class TypePickerComponent {
  @Output() selected = new EventEmitter<ContentType>();
  @Output() closed = new EventEmitter<void>();

  select(type: ContentType) {
    this.selected.emit(type);
  }

  close() {
    this.closed.emit();
  }
}