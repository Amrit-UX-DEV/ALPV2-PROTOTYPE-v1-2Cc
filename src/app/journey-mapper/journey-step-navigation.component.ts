import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { JourneyService } from './journey.service';

/** The one step navigator used wherever a journey frame is being read. */
@Component({
  selector: 'journey-step-navigation',
  standalone: true,
  template: `
    <div class="jm-step-navigation">
      <button
        type="button"
        class="alp-btn alp-btn--sm alp-btn--secondary"
        [disabled]="!journeys.hasPrevious()"
        (click)="journeys.previous()">
        <i aria-hidden="true" class="fas fa-chevron-left"></i>
        Previous
      </button>

      <span class="jm-step-navigation__count" aria-live="polite">
        @if (journeys.stepCount()) {
          Step {{ journeys.stepNumber() }} of {{ journeys.stepCount() }}
        } @else {
          No journey
        }
      </span>

      <button
        type="button"
        class="alp-btn alp-btn--sm alp-btn--secondary"
        [disabled]="!journeys.hasNext()"
        (click)="journeys.next()">
        Next
        <i aria-hidden="true" class="fas fa-chevron-right"></i>
      </button>
    </div>
  `,
  styleUrl: './journey-step-navigation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyStepNavigationComponent {
  protected readonly journeys = inject(JourneyService);
}
