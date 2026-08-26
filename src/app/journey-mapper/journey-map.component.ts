import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { JourneyCaptureService } from './journey-capture.service';
import { JourneyCloneComponent } from './journey-clone.component';
import { JourneyService } from './journey.service';

/**
 * The journey view: the path written out, one frame at a time.
 *
 * A frame is a photograph of what the rep was looking at, what they did to it,
 * and what happened. The words come from the journey file and the picture comes
 * from the capture pass, which is why the two cannot drift: the picture is of
 * the app as it is now, and if the app has moved on it is the picture that
 * changes.
 *
 * The contents beside it are the shape of the whole path, because a journey is
 * a shape as well as a sequence.
 */
@Component({
  selector: 'journey-map',
  standalone: true,
  imports: [JourneyCloneComponent],
  templateUrl: './journey-map.component.html',
  styleUrl: './journey-map.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyMapComponent {
  protected readonly journeys = inject(JourneyService);
  protected readonly capture = inject(JourneyCaptureService);

  protected readonly name = computed(() => this.journeys.journey()?.name ?? '');
  protected readonly summary = computed(() => this.journeys.journey()?.summary ?? '');

  /** The time of day the frames were taken. The date is today by definition. */
  protected readonly capturedAt = computed(() => {
    const at = this.capture.capturedAt();
    return at ? new Date(at).toLocaleTimeString() : '';
  });
}
