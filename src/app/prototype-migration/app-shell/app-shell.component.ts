import {
  Component,
  AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
} from '@angular/core';
import { VersionSwitcherComponent } from './components/version-switcher/version-switcher.component';
import { WizardRegistryService, registerWizardComponents } from '../wizard';
import { RightDockComponent } from './regions/right-dock/right-dock.component';
import { ExplorerToolbarComponent, AppView } from './regions/explorer-toolbar/explorer-toolbar.component';
import { AppBodyComponent } from './regions/app-body/app-body.component';
import { AppHeaderComponent } from './regions/app-header/app-header.component';
import { OverlayService } from '../ui/overlay.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    VersionSwitcherComponent,
    RightDockComponent,
    ExplorerToolbarComponent,
    AppBodyComponent,
    AppHeaderComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppShellComponent implements AfterViewInit {

  protected readonly overlay = inject(OverlayService);

  public currentView: AppView = 'work-plan';

  switchView(view: AppView) {
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