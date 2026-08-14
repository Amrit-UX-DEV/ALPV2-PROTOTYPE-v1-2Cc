import {
  Component,
  ComponentRef,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { WizardStepConfig } from '../../models/wizard.models';
import { WizardContextService } from '../../services/wizard-context.service';
import { WizardRegistryService } from '../../services/wizard-registry.service';

/**
 * Dynamically renders a single wizard step component.
 *
 * - Resolves the component class from the registry by `componentId`.
 * - Sets inputs declared in the step config's `inputs` map
 *   (values come from WizardContext by source step ID).
 * - Subscribes to the component's output (named by `output` config,
 *   defaulting to "stepDataChange") and stores emitted data in WizardContext
 *   under this step's ID.
 */
@Component({
  selector: 'wizard-step-host',
  standalone: true,
  template: '',
})
export class WizardStepHostComponent implements OnInit, OnDestroy {

  @Input({ required: true }) step!: WizardStepConfig;

  private readonly vcr = inject(ViewContainerRef);
  private readonly registry = inject(WizardRegistryService);
  private readonly wizardContext = inject(WizardContextService);
  private readonly injector = inject(Injector);

  private componentRef?: ComponentRef<any>;
  private outputSub?: Subscription;

  /* ── Lifecycle ──────────────────────────────────────────────── */

  ngOnInit(): void {
    const componentClass = this.registry.get(this.step.componentId);
    if (!componentClass) {
      console.error(`[WizardStepHost] No component registered for id "${this.step.componentId}"`);
      return;
    }

    this.componentRef = this.vcr.createComponent(componentClass, { injector: this.injector });
    this.applyInputs();
    this.subscribeOutput();
  }

  ngOnDestroy(): void {
    this.outputSub?.unsubscribe();
    this.componentRef?.destroy();
    this.componentRef = undefined;
  }

  /* ── Inputs ──────────────────────────────────────────────────── */

  /**
   * Re-apply inputs when the step config or upstream data changes.
   * Called from ngOnInit and can be triggered by the parent via ngOnChanges.
   */
  refreshInputs(): void {
    if (this.componentRef) {
      this.applyInputs();
    }
  }

  private applyInputs(): void {
    if (!this.componentRef || !this.step.inputs) return;

    for (const [inputName, sourceStepId] of Object.entries(this.step.inputs)) {
      const data = this.wizardContext.getStepData(sourceStepId);
      this.componentRef.setInput(inputName, data ?? null);
    }
  }

  /* ── Output subscription ─────────────────────────────────────── */

  private subscribeOutput(): void {
    if (!this.componentRef) return;

    const outputName = this.step.output ?? 'stepDataChange';
    const instance = this.componentRef.instance;

    // Check if the component instance has the specified output
    const candidate = instance[outputName];
    if (candidate && typeof candidate.subscribe === 'function') {
      this.outputSub = candidate.subscribe((data: any) => {
        this.wizardContext.setStepData(this.step.id, data);
      });
    }
  }
}
