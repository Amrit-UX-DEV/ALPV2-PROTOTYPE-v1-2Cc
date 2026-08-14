/**
 * Configuration for a single wizard step.
 * Each step maps to a registered component and can receive data
 * from previous steps via the `inputs` mapping.
 */
export interface WizardStepConfig {
  /** Unique step identifier (e.g. "step-1"). */
  id: string;

  /** Human-readable label shown in the side rail and step header. */
  label: string;

  /** Component ID registered in the WizardRegistryService. */
  componentId: string;

  /**
   * Maps component input names to source step IDs.
   * Example: { "setup": "step-1" } passes step-1's data into the component's `setup` input.
   */
  inputs?: Record<string, string>;

  /**
   * Name of the component output to capture as this step's data.
   * If omitted, defaults to "stepDataChange".
   */
  output?: string;

  /** Navigation button labels and visibility. */
  navigation?: WizardStepNavigation;
}

export interface WizardStepNavigation {
  saveLabel?: string;
  nextLabel?: string;
  previousLabel?: string;
  finishLabel?: string;
  showReset?: boolean;
}

/**
 * Top-level wizard configuration loaded from JSON.
 */
export interface WizardConfig {
  id: string;
  title: string;
  exitLabel?: string;
  steps: WizardStepConfig[];
}

/**
 * Data payload stored per step in WizardContextService.
 */
export type WizardStepData = Record<string, any>;
