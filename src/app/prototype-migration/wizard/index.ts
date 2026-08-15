import { Type } from '@angular/core';
import { WizardRegistryService } from './services/wizard-registry.service';

// Step components
import { ScriptSetupComponent } from '../app-shell/components/script-management/script-setup.component';
import { ScriptBuilderComponent } from '../app-shell/components/call-rep-scripts/script-builder/script-builder.component';
import { ScriptPreviewComponent } from '../app-shell/components/call-rep-scripts/script-builder/preview/script-preview.component';
import { WizardConfirmationComponent } from './components/wizard-confirmation/wizard-confirmation.component';

/**
 * Registers all known wizard step components with the WizardRegistryService.
 * Call this once at app startup or in the component that hosts the wizard shell.
 *
 * To add a new step component for use in wizard JSON configs:
 *   1. Import the component class
 *   2. Add a line: registry.register('your-component-id', YourComponent);
 */
export function registerWizardComponents(registry: WizardRegistryService): void {
  registry.register('alpha-script-setup', ScriptSetupComponent);
  registry.register('alpha-script-builder', ScriptBuilderComponent);
  registry.register('alpha-script-preview', ScriptPreviewComponent);
  registry.register('wizard-confirmation', WizardConfirmationComponent);
}

// Re-export key types and services
export { WizardShellComponent } from './components/wizard-shell/wizard-shell.component';
export { WizardRegistryService } from './services/wizard-registry.service';
export { WizardContextService } from './services/wizard-context.service';
export { WizardConfig, WizardStepConfig } from './models/wizard.models';
