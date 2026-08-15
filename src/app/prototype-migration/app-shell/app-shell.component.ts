import {
  Component,
  AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VersionSwitcherComponent } from './components/version-switcher/version-switcher.component';
import { AlphaGroupSummaryComponent } from './components/group-summary/alpha-group-summary.component';
import { WizardShellComponent, WizardRegistryService, registerWizardComponents } from '../wizard';
import { CallCentreWidgetComponent } from '../widgets/call-centre/call-centre-widget.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    AlphaGroupSummaryComponent,
    WizardShellComponent,
    CommonModule,
    VersionSwitcherComponent,
    CallCentreWidgetComponent,
  ],
  templateUrl: './app-shell.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppShellComponent implements AfterViewInit {

  public currentView: 'group-summary' | 'work-plan' = 'work-plan';

  switchView(view: 'group-summary' | 'work-plan') {
    this.currentView = view;
  }

  ngAfterViewInit() {
    // The prototype's jQuery interaction libraries bind listeners at parse
    // time, so they must load after Angular has rendered the shell.
    this.loadScript('assets/scripts/ux-interactions-library.js');
    this.loadScript('assets/scripts/alpha-core.js');
    this.loadScript('assets/scripts/prototype-interactions.js');
  }

  private loadScript(src: string): void {
    const script = document.createElement('script');
    script.src = src;
    script.type = 'text/javascript';
    script.async = false;
    document.body.appendChild(script);
  }

  constructor() {
    registerWizardComponents(inject(WizardRegistryService));
  }
}