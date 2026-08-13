import { Component, CUSTOM_ELEMENTS_SCHEMA, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScriptSetupComponent } from '../script-management/script-setup.component';
import { ScriptBuilderComponent } from '../call-rep-scripts/script-builder/script-builder.component';
import { ScriptSetupSelection } from '../call-rep-scripts/script-builder/models/script-builder.models';

/** Wizard step definition used for the side rail and step containers. */
interface WizardStep {
  id: string;
  label: string;
}

@Component({
  selector: 'alpha-work-plan',
  standalone: true,
  imports: [
    CommonModule,
    ScriptSetupComponent,
    ScriptBuilderComponent
  ],
  templateUrl: './alpha-work-plan.component.html',
  styleUrls: ['./alpha-work-plan.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AlphaWorkPlanComponent {

  /* ── Step definitions ─────────────────────────────────────────── */

  readonly steps: WizardStep[] = [
    { id: 'step-1', label: 'Script Association' },
    { id: 'step-2', label: 'View / Build Script' },
    { id: 'step-3', label: 'Preview Script' },
    { id: 'step-4', label: 'Confirmation' }
  ];

  /* ── Navigation state ─────────────────────────────────────────── */

  /** Zero-based index of the step the user is currently viewing. */
  readonly currentStepIndex = signal(0);

  /** Highest step index the user has unlocked (advanced to). */
  readonly maxReachedStep = signal(0);

  readonly currentStep = computed(() => this.steps[this.currentStepIndex()]);
  readonly isLastStep = computed(() => this.currentStepIndex() === this.steps.length - 1);
  readonly isFirstStep = computed(() => this.currentStepIndex() === 0);

  /* ── Script setup state (passed from Step 1 to Step 2) ────────── */

  readonly setupSelection = signal<ScriptSetupSelection | null>(null);

  /* ── Step status helpers (used by template for styling) ────────── */

  stepStatus(index: number): 'complete' | 'active' | 'incomplete' {
    if (index < this.currentStepIndex()) return 'complete';
    if (index === this.currentStepIndex()) return 'active';
    return 'incomplete';
  }

  canGoToStep(index: number): boolean {
    return index <= this.maxReachedStep();
  }

  /* ── Navigation methods ───────────────────────────────────────── */

  goToStep(index: number): void {
    if (index < 0 || index >= this.steps.length) return;
    if (index > this.maxReachedStep()) return;
    this.currentStepIndex.set(index);
  }

  nextStep(): void {
    const next = this.currentStepIndex() + 1;
    if (next >= this.steps.length) return;
    this.currentStepIndex.set(next);
    if (next > this.maxReachedStep()) {
      this.maxReachedStep.set(next);
    }
  }

  previousStep(): void {
    const prev = this.currentStepIndex() - 1;
    if (prev < 0) return;
    this.currentStepIndex.set(prev);
  }

  exitWizard(): void {
    // Placeholder — parent component can wire this to navigation
    console.log('Exit wizard clicked');
  }

  /* ── Step 1 → Step 2 handshake ────────────────────────────────── */

  /** Stores the script selection from Step 1. Does NOT advance the wizard. */
  onSetupContinue(selection: ScriptSetupSelection): void {
    this.setupSelection.set(selection);
  }
}
