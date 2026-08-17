import {
  Component,
  inject,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CallScriptJourneyComponent } from '../journey/call-script-journey.component';
import { PrototypeContextService } from '../../../../context/prototype-context.service';

/**
 * The call action options panel inside the call information step.
 *
 * Owns the call note scratch pad and the script/journey disclosure toggles.
 *
 * `showDetails` is NOT owned here. The panel holds the button that flips it,
 * but the summary tiles further up the step read the same flag, so the step
 * owns the state and this panel reports the click upwards. Keeping a local
 * copy would leave the summary tile unresponsive.
 *
 * The selector is an attribute so the host stays the existing
 * <div class="overlay--local-container call-action-options">; prototype-only.css
 * styles `.overlay--local-container.call-action-options > div`, which an
 * element selector would break.
 */
@Component({
  selector: 'div[alpha-call-action-options]',
  standalone: true,
  imports: [CommonModule, FormsModule, CallScriptJourneyComponent],
  templateUrl: './call-action-options.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CallActionOptionsComponent {
  /** The policy the call is about, read in the template as ctx.policy(). */
  protected readonly ctx = inject(PrototypeContextService);

  @Input() showDetails = false;
  @Output() detailsToggled = new EventEmitter<void>();

  toggleDetails() {
    this.detailsToggled.emit();
  }

  // ==================== CALL NOTE SCRATCH PAD ====================
  typedContent = '';
  maxChars = 1000;

  @ViewChild('contentContainer') contentContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('editablePart') editablePart!: ElementRef<HTMLDivElement>;

  onType() {
    if (this.editablePart?.nativeElement) {
      this.editablePart.nativeElement.textContent = this.typedContent;
    }
  }

  get totalChars(): number {
    return this.contentContainer?.nativeElement?.textContent?.trim().length || 0;
  }

  get remaining() {
    return this.maxChars - this.totalChars;
  }

  // ==================== DISCLOSURE TOGGLES ====================
  showElement = false;
  toggle() {
    this.showElement = !this.showElement;
  }

  showScript = false;
  toggleScript() {
    this.showScript = !this.showScript;
  }
}
