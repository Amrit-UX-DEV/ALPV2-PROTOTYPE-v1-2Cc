import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VulnerableClientActionComponent } from './components/vulnerable-client-action/vulnerable-client-action.component';
import { CallerSelectorComponent } from './components/caller-selector/caller-selector.component';
import { VersionSwitcherComponent } from './components/version-switcher/version-switcher.component';
import { CallScriptJourneyComponent } from './components/call-rep-scripts/journey/call-script-journey.component';
import { RecentCallersComponent } from './components/recent-callers/recent-callers.component';
import { TransferCallPopoverComponent } from './components/transfer-call-popover/transfer-call-popover.component'; 
import { AlphaGroupSummaryComponent } from './components/group-summary/alpha-group-summary.component';
import { AlphaWorkPlanComponent } from './components/work-plan/alpha-work-plan.component';

@Component({
  selector: 'app-call-center-demo',
  standalone: true,
  imports: [
    AlphaGroupSummaryComponent,
    AlphaWorkPlanComponent,
    CallerSelectorComponent, 
    CommonModule, 
    FormsModule, 
    VersionSwitcherComponent, 
    CallScriptJourneyComponent,
    RecentCallersComponent,
    TransferCallPopoverComponent,
    
    
  ],
  templateUrl: './call-center-demo.component.html',
  styleUrls: ['./call-center-demo.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CallCenterDemoComponent implements AfterViewInit {

  public currentView: 'group-summary' | 'work-plan' = 'work-plan';

  switchView(view: 'group-summary' | 'work-plan') {
    this.currentView = view;
  }

  @ViewChild(RecentCallersComponent) recentCallersComponent!: RecentCallersComponent;

  ngAfterViewInit() {
    console.log('✅ Loading custom scripts after Angular render');

    this.loadScript('assets/scripts/ux-interactions-library.js');
    this.loadScript('assets/scripts/alpha-core.js');
    this.loadScript('assets/scripts/prototype-interactions.js');

    this.updateCount();
  }

  // ==================== TRANSFER POPOVER ====================
  showTransferPopover = false;

  handleTransferCall(data: { reason: string; notes: string }) {
    console.log('Transfer initiated with data:', data);

    if (this.recentCallersComponent) {
      this.recentCallersComponent.transferCallWithReason(data.reason, data.notes);
    } else {
      console.warn('RecentCallersComponent not found');
    }
  }

  // ==================== EXISTING CODE (Completely Unchanged) ====================
  transferCall() {
    this.recentCallersComponent?.transferCall(); // keep for your existing button if needed
  }

  onRecentCallerSelected(caller: any) {
    console.log('Recent caller selected:', caller);
  }

  typedContent = '';   
  maxChars = 1000;

  @ViewChild('contentContainer') contentContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('editablePart') editablePart!: ElementRef<HTMLDivElement>;

  onType() {
    if (this.editablePart?.nativeElement) {
      this.editablePart.nativeElement.textContent = this.typedContent;
    }
    this.updateCount();
  }

  updateCount() {
    setTimeout(() => {}, 0);
  }

  get totalChars(): number {
    return this.contentContainer?.nativeElement?.textContent?.trim().length || 0;
  }

  get remaining() {
    return this.maxChars - this.totalChars;
  }

  private loadScript(src: string): void {
    const script = document.createElement('script');
    script.src = src;
    script.type = 'text/javascript';
    script.async = false;
    document.body.appendChild(script);
  }

  showDetails = false;
  toggleDetails() {
    this.showDetails = !this.showDetails;
  }

  showElement = false;
  toggle() {
    this.showElement = !this.showElement;
  }

  showScript = false;
  toggleScript() {
    this.showScript = !this.showScript;
  }

  constructor() {
    console.log('Call Center Demo Prototype Loaded');
  }

  demoClick() {
    alert('✅ This is your prototype! You can now start pasting your real HTML here.');
  }
}