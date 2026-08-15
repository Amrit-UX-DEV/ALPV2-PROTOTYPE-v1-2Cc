import { Component, Input, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallRepScriptService, CallRepScript } from './call-rep-script.service';

@Component({
  selector: 'alpha-call-script-journey',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './call-script-journey.component.html'
})
export class CallScriptJourneyComponent implements OnInit {

  private readonly scriptService = inject(CallRepScriptService);

  @Input() scriptId: string = "surrender-001";

  readonly script = signal<CallRepScript | null>(null);
  readonly currentStepIndex = signal<number>(0);
  readonly isLoading = signal<boolean>(true);
  readonly loadError = signal<string | null>(null);
  readonly showSummary = signal<boolean>(false);

  readonly userAnswers = signal<Map<string, string[]>>(new Map());
  readonly completedChecks = signal<Set<string>>(new Set());
  readonly completedActions = signal<string[]>([]);

  readonly currentStep = computed(() => {
    const s = this.script();
    const idx = this.currentStepIndex();
    return s && idx >= 0 && idx < s.steps.length ? s.steps[idx] : null;
  });

  readonly sortedContent = computed(() => {
    const step = this.currentStep();
    if (!step?.content) return [];
    return [...step.content].sort((a, b) => (a.order || 0) - (b.order || 0));
  });

  constructor() {
    effect(() => {
      if (this.scriptService.scriptsIndex().length > 0 && this.scriptId && !this.script()) {
        this.loadScript();
      }
    });

    effect(() => {
      const step = this.currentStep();
      if (step) {
        this.markAutoChecksAsCompleted(step);
      }
    });
  }

  async ngOnInit() {
    if (this.scriptId) {
      setTimeout(() => this.loadScript(), 300);
    }
  }

  async loadScript() {
    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      const loaded = await this.scriptService.getScript(this.scriptId);
      if (loaded) {
        this.script.set(loaded);
        const firstStep = loaded.steps[0];
        if (firstStep) this.markAutoChecksAsCompleted(firstStep);
      } else {
        this.loadError.set(`Failed to load script: ${this.scriptId}`);
      }
    } catch (err) {
      console.error(err);
      this.loadError.set('Failed to load script');
    } finally {
      this.isLoading.set(false);
    }
  }

  private markAutoChecksAsCompleted(step: any) {
    if (!step?.content) return;

    step.content.forEach((item: any) => {
      if (item.type === 'required-check' && item.requiredChecks) {
        item.requiredChecks.forEach((check: any) => {
          if (check.auto) {
            const checkText = check.question 
              ? `${check.question}: ${check.answer}` 
              : (typeof check === 'string' ? check : check.text || '');
            
            if (checkText) {
              this.completedChecks.update(set => {
                set.add(checkText);
                return new Set(set);
              });
            }
          }
        });
      }
    });
  }

  selectOption(option: any, stepId: string) {
    this.userAnswers.update(map => {
      map.set(stepId, [option.text]);
      return new Map(map);
    });
  }

  selectManualCheck(option: any, question: string) {
    this.userAnswers.update(map => {
      map.set(question, [option.text]);
      return new Map(map);
    });

    this.completedChecks.update(set => {
      const prefix = `${question}: `;
      Array.from(set)
        .filter(text => text.startsWith(prefix))
        .forEach(text => set.delete(text));
      set.add(`${question}: ${option.text}`);
      return new Set(set);
    });
  }

  isOptionSelected(optionText: string, stepId: string): boolean {
    return this.userAnswers().get(stepId)?.includes(optionText) ?? false;
  }

  toggleCheck(checkText: string, checked: boolean) {
    if (!checkText) return;
    this.completedChecks.update(set => {
      checked ? set.add(checkText) : set.delete(checkText);
      return new Set(set);
    });
  }

  addAction(action: string) {
    this.completedActions.update(actions => [...actions, action]);
  }

  goToStep(index: number) {
    const total = this.script()?.steps.length ?? 0;
    if (index >= 0 && index < total) {
      this.currentStepIndex.set(index);
    }
  }

  getNextStepIndex(): number {
    const step = this.currentStep();
    if (!step) return this.currentStepIndex() + 1;

    const selectedAnswer = this.userAnswers().get(step.id)?.[0];
    if (!selectedAnswer) return this.currentStepIndex() + 1;

    const questionItem = step.content.find((item: any) => 
      item.type === 'question' && Array.isArray(item.options)
    );

    if (questionItem && Array.isArray(questionItem.options)) {
      const selectedOption = questionItem.options.find((opt: any) => opt.text === selectedAnswer);
      if (selectedOption?.nextStep) {
        const nextStepIndex = this.script()!.steps.findIndex(s => s.id === selectedOption.nextStep);
        if (nextStepIndex !== -1) return nextStepIndex;
      }
    }

    return this.currentStepIndex() + 1;
  }

  finishJourney() {
    this.showSummary.set(true);
    console.log('✅ Script Journey Completed', {
      scriptId: this.script()?.scriptId,
      answers: Object.fromEntries(this.userAnswers()),
      completedChecks: Array.from(this.completedChecks()),
      completedActions: this.completedActions()
    });
  }

  restartJourney() {
    this.currentStepIndex.set(0);
    this.userAnswers.set(new Map());
    this.completedChecks.set(new Set());
    this.completedActions.set([]);
    this.showSummary.set(false);
  }

  isConditionMet(condition: any): boolean {
    if (!condition || !condition.dependsOn) return true;

    const dependsOn = condition.dependsOn;

    if (condition.checkQuestion) {
      const target = `${condition.checkQuestion}: ${condition.answer}`;
      if (this.completedChecks().has(target)) return true;

      const manualAnswer = this.userAnswers().get(condition.checkQuestion);
      if (Array.isArray(manualAnswer) && manualAnswer.includes(condition.answer)) {
        return true;
      }

      // Auto checks are considered completed even if completedChecks hasn't been updated yet
      return this.script()?.steps.some((step: any) =>
        step.content?.some((item: any) =>
          item.type === 'required-check' &&
          item.id === dependsOn &&
          item.requiredChecks?.some((check: any) =>
            check.auto &&
            check.question === condition.checkQuestion &&
            String(check.answer) === String(condition.answer)
          )
        )
      ) ?? false;
    }

    const selectedAnswers = this.userAnswers().get(dependsOn) || [];
    if (!Array.isArray(selectedAnswers) || selectedAnswers.length === 0) {
      return false;
    }

    const requiredAnswers = (condition.answers || []).map((a: string) => String(a).trim());
    if (requiredAnswers.length === 0) {
      // No specific answers required → any answer satisfies the condition
      return true;
    }

    return requiredAnswers.some((answer: string) => selectedAnswers.includes(answer));
  }

  hasEndCallAction(): boolean {
    const step = this.currentStep();
    if (!step) return false;
    return step.content.some((item: any) => 
      item.type === 'action' && item.actionType === 'end-call'
    );
  }

  isAutoCheck(check: any): boolean {
    return typeof check === 'object' && check?.auto === true;
  }

  isManualCheck(check: any): boolean {
    return typeof check === 'object' && check?.manual === true;
  }

  formatPrompt(text: string): string {
    if (!text) return '';

    let formatted = text
      .replace(/\. /g, '.<br><br>')
      .replace(/\? /g, '?<br><br>')
      .replace(/! /g, '!<br><br>');

    formatted = formatted.replace(/£?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g, match => 
      `<span class="alp-prompt-variable">${match}</span>`
    );

    return formatted;
  }
}