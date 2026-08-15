import { Component, CUSTOM_ELEMENTS_SCHEMA, signal, ViewChild, ElementRef, AfterViewInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface RecentCaller {
  id: string;
  name: string;
  role: string;
  callDateTime: string;
}

@Component({
  selector: 'alpha-caller-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './caller-selector.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CallerSelectorComponent implements AfterViewInit {

  @ViewChild('callerDialog') callerDialog!: ElementRef<HTMLDialogElement>;

  // State - Start with NO selection
  readonly hasSelectedCaller = signal(false);
  readonly selectedCallerName = signal('');
  readonly selectedCallerRole = signal('');

  @Output() callerSelected = new EventEmitter<any>();

  ngAfterViewInit() {
    // Do NOTHING on load - keep the "Select Who is Calling" button visible
  }

  openCallerDialog(): void {
    this.callerDialog.nativeElement.showModal();
  }

  closeCallerDialog(): void {
    this.callerDialog.nativeElement.close();
  }

  // Called when user manually selects from dialog (e.g. Policy Holder)
  selectPolicyHolder(): void {
    this.selectedCallerName.set('Mr Joe Bloggs');
    this.selectedCallerRole.set('Policy Holder, Life 1, Payer');
    this.hasSelectedCaller.set(true);
    this.callerSelected.emit({ name: 'Mr Joe Bloggs', role: 'Policy Holder, Life 1, Payer' });
    this.closeCallerDialog();
  }

  // Called ONLY when user clicks a Recent Caller tile
  onRecentCallerSelected(caller: RecentCaller): void {
    this.selectedCallerName.set(caller.name);
    this.selectedCallerRole.set(caller.role);
    this.hasSelectedCaller.set(true);
    this.callerSelected.emit(caller);
  }

  clearSelection(): void {
    this.hasSelectedCaller.set(false);
    this.selectedCallerName.set('');
    this.selectedCallerRole.set('');
    this.callerSelected.emit(null);
  }
}