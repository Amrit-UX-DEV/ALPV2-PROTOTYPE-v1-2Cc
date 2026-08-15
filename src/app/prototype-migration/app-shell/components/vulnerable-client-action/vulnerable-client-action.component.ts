import { Component, Input, ViewChild, ElementRef, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-vulnerable-client-action',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vulnerable-client-action.component.html',
  styleUrls: ['./vulnerable-client-action.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class VulnerableClientActionComponent implements AfterViewInit {

  @Input() name = 'John Smith';
  @Input() role = 'Policy Holder';

  @ViewChild('vulnerabilityDialog') dialog!: ElementRef<HTMLDialogElement>;

  ngAfterViewInit() {
    // Optional: close dialog when clicking outside
    this.dialog.nativeElement.addEventListener('click', (e) => {
      if (e.target === this.dialog.nativeElement) {
        this.closeDialog();
      }
    });
  }

  openDialog() {
    this.dialog.nativeElement.showModal();
  }

  closeDialog() {
    this.dialog.nativeElement.close();
  }
}