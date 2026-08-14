import { Injectable, signal, computed } from '@angular/core';
import { WizardStepData } from '../models/wizard.models';

/**
 * Shared state service for passing data between wizard steps.
 * Provided at the wizard-shell component level so each wizard instance
 * gets its own isolated context.
 */
@Injectable()
export class WizardContextService {

  /** All step data keyed by step ID. */
  private readonly _stepData = signal<WizardStepData>({});

  /** Read-only view of all step data. */
  readonly stepData = this._stepData.asReadonly();

  /** Get data produced by a specific step. */
  getStepData(stepId: string): any {
    return this._stepData()[stepId];
  }

  /** Store data for a step (called automatically by the step host when the component emits). */
  setStepData(stepId: string, data: any): void {
    this._stepData.update(current => ({ ...current, [stepId]: data }));
  }

  /** Clear all step data (used on wizard reset). */
  clear(): void {
    this._stepData.set({});
  }
}
