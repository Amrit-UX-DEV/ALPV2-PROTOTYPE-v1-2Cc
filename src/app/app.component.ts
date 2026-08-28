import { DOCUMENT } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { AppShellComponent } from './prototype-migration/app-shell/app-shell.component';
import { JourneyShellComponent } from './journey-mapper/journey-shell.component';
import { isFullView } from './view-mode';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppShellComponent, JourneyShellComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);

  /**
   * The full view is a property of the entry point rather than of the mapper.
   * Any prototype projected into the shell can therefore be opened without
   * carrying a second bootstrap or a mapper-specific route.
   */
  protected readonly fullView = isFullView(this.document);
}