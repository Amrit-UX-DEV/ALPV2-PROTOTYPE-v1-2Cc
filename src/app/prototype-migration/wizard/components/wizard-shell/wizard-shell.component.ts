import {
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  input,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { WizardConfig, WizardStepConfig } from '../../models/wizard.models';
import { WizardContextService } from '../../services/wizard-context.service';
import { WizardRegistryService } from '../../services/wizard-registry.service';
import { WizardStepHostComponent } from '../wizard-step-host/wizard-step-host.component';

/**
 * Generic, JSON-driven wizard shell.
 *
 * Usage:
 *   <wizard-shell [configUrl]="'configs/script-management.wizard.json'">
 *   </wizard-shell>
 *
 * The shell handles the header, side rail, step containers, and navigation.
 * Step components are loaded dynamically via WizardStepHostComponent.
 */
@Component({
  selector: 'wizard-shell',
  standalone: true,
  imports: [
    CommonModule,
    WizardStepHostComponent,
  ],
  providers: [WizardContextService],
  templateUrl: './wizard-shell.component.html',
  styleUrls: ['./wizard-shell.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class WizardShellComponent implements OnInit {

  /** Path to the wizard JSON config (relative to assets root). */
  readonly configUrl = input<string>('');

  /**
   * The rep is done with this wizard, by exiting it or by finishing it.
   *
   * The shell does not know where they should go next, since it is the same
   * shell for every wizard; whatever hosted it does.
   */
  @Output() readonly exit = new EventEmitter<void>();

  /* ── Internal state ──────────────────────────────────────────── */

  private readonly http = inject(HttpClient);
  private readonly wizardContext = inject(WizardContextService);

  readonly config = signal<WizardConfig | null>(null);

  readonly steps = computed<WizardStepConfig[]>(() => this.config()?.steps ?? []);
  readonly title = computed<string>(() => this.config()?.title ?? 'Wizard');
  readonly exitLabel = computed<string>(() => this.config()?.exitLabel ?? 'Exit');

  readonly currentStepIndex = signal(0);
  readonly maxReachedStep = signal(0);

  readonly currentStep = computed(() => this.steps()[this.currentStepIndex()]);
  readonly isLastStep = computed(() => this.currentStepIndex() === this.steps().length - 1);
  readonly isFirstStep = computed(() => this.currentStepIndex() === 0);

  /**
   * Whether the step on screen has been given what it asks for.
   *
   * Read off the data the step has already reported, rather than asked of the
   * step component: the shell holds no reference to it, and a step that reports
   * what it has is a step whose progress the rail and the buttons can both see.
   *
   * An empty array counts as nothing, so a list of what was supplied with
   * nothing ticked does not pass for an answer.
   */
  readonly canAdvance = computed(() => {
    const step = this.currentStep();
    const required = step?.requires ?? [];
    if (required.length === 0) return true;

    const data = this.wizardContext.stepData()[step.id] as Record<string, unknown> | undefined;
    if (!data) return false;

    return required.every((name) => {
      const value = data[name];
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    });
  });

  /* ── Lifecycle ────────────────────────────────────────────────── */

  ngOnInit(): void {
    const url = this.configUrl();
    if (!url) return;

    this.http.get<WizardConfig>(url).subscribe({
      next: (cfg) => this.config.set(cfg),
      error: (err) => console.error(`[WizardShell] Failed to load config from ${url}`, err),
    });
  }

  /* ── Step status helpers ──────────────────────────────────────── */

  stepStatus(index: number): 'complete' | 'active' | 'incomplete' {
    if (index < this.currentStepIndex()) return 'complete';
    if (index === this.currentStepIndex()) return 'active';
    return 'incomplete';
  }

  canGoToStep(index: number): boolean {
    return index <= this.maxReachedStep();
  }

  /* ── Navigation ───────────────────────────────────────────────── */

  goToStep(index: number): void {
    if (index < 0 || index >= this.steps().length) return;
    if (index > this.maxReachedStep()) return;
    this.currentStepIndex.set(index);
  }

  nextStep(): void {
    if (!this.canAdvance()) return;

    const next = this.currentStepIndex() + 1;
    if (next >= this.steps().length) return;
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
    this.exit.emit();
  }

  resetWizard(): void {
    this.currentStepIndex.set(0);
    this.maxReachedStep.set(0);
    this.wizardContext.clear();
  }
}
