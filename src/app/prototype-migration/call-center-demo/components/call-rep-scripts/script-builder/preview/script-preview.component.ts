import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScriptStep, ContentBlock } from '../models/script-builder.models';

const PROMPT_VARIABLE_LABELS: Record<string, string> = {
  policyValue: 'Policy Value',
  option2: 'Option 2',
  option3: 'Option 3',
  option4: 'Option 4',
  option5: 'Option 5',
  option6: 'Option 6'
};

@Component({
  selector: 'alpha-script-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './script-preview.component.html'
})
export class ScriptPreviewComponent {

  @Input() set steps(value: ScriptStep[]) {
    this._steps.set(
      (value || []).map(s => ({
        ...s,
        content: [...(s.content || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      }))
    );
  }

  @Input() scriptTitle = '';
  @Output() closed = new EventEmitter<void>();

  private readonly _steps = signal<ScriptStep[]>([]);
  readonly stepsList = this._steps.asReadonly();

  readonly currentStepIndex = signal(0);
  readonly userAnswers = signal<Map<string, string[]>>(new Map());
  readonly completedChecks = signal<Set<string>>(new Set());
  readonly showSummary = signal(false);

  readonly currentStep = computed(() => {
    const list = this._steps();
    return list[this.currentStepIndex()] ?? null;
  });

  readonly isLastStep = computed(() => {
    return this.currentStepIndex() >= this._steps().length - 1;
  });

  formatPromptHtml(text: string | null | undefined): string {
    if (!text) return '';

    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    escaped = escaped.replace(/\{\{(\w+)\}\}/g, (_match, id: string) => {
      const label = PROMPT_VARIABLE_LABELS[id] || id;
      return `<span class="auth-prompt-variable">${label}</span>`;
    });

    return escaped
      .replace(/([.?!])\s+/g, '$1<br><br>')
      .replace(/(<br>){4,}/g, '<br><br>');
  }

  orderedContent(step: ScriptStep | null): ContentBlock[] {
    if (!step) return [];
    return step.content || [];
  }

  /** All answer texts selected on the current step (questions + manual checks). */
  private currentStepSelectedAnswers(): string[] {
    const step = this.currentStep();
    if (!step) return [];

    const map = this.userAnswers();
    const out: string[] = [];

    for (const b of step.content || []) {
      if (b.type === 'question') {
        const byId = map.get(b.id);
        if (byId?.length) out.push(...byId);
        if (b.content) {
          const byContent = map.get(b.content);
          if (byContent?.length) out.push(...byContent);
        }
      }

      if (b.type === 'required-check' && b.requiredChecks?.length) {
        for (const c of b.requiredChecks) {
          if (c.auto && c.answer) {
            out.push(c.answer);
          }
          if (c.question) {
            const byQ = map.get(c.question);
            if (byQ?.length) out.push(...byQ);
          }
          const byBlock = map.get(b.id);
          if (byBlock?.length) out.push(...byBlock);
        }
      }
    }

    return out.map(v => String(v).trim().toLowerCase());
  }

  /**
   * Conditional content:
   * - No condition → always visible
   * - Has condition.checkQuestion + answer → visible only if that required check is completed
   *   (auto checks are considered completed; manual checks must be in completedChecks)
   * - Has condition.answers → visible only if a CURRENT STEP selected answer matches
   * - Has condition but no answers/check → hidden until we have a clear rule
   */
  isBlockVisible(block: ContentBlock): boolean {
    if (!block.condition) return true;

    if (block.condition.checkQuestion && block.condition.answer) {
      const target = `${block.condition.checkQuestion}: ${block.condition.answer}`;
      if (this.completedChecks().has(target)) return true;

      const manualAnswer = this.userAnswers().get(block.condition.checkQuestion);
      if (Array.isArray(manualAnswer) && manualAnswer.includes(block.condition.answer)) {
        return true;
      }

      const steps = this.stepsList();
      return steps.some(step =>
        step.content?.some(item =>
          item.type === 'required-check' &&
          item.id === block.condition?.dependsOn &&
          item.requiredChecks?.some(check =>
            check.auto &&
            check.question === block.condition?.checkQuestion &&
            String(check.answer) === String(block.condition?.answer)
          )
        )
      );
    }

    const required = (block.condition.answers || [])
      .map(a => String(a).trim().toLowerCase())
      .filter(Boolean);

    if (required.length === 0) {
      return false;
    }

    const selected = this.currentStepSelectedAnswers();
    if (selected.length === 0) return false;

    return required.some(r => selected.includes(r));
  }

  selectOption(block: ContentBlock, optionText: string) {
    const isMulti = block.selectionMode === 'multi';
    this.userAnswers.update(map => {
      const next = new Map(map);
      let current = next.get(block.id) || [];
      if (isMulti) {
        current = current.includes(optionText)
          ? current.filter(t => t !== optionText)
          : [...current, optionText];
      } else {
        current = [optionText];
      }
      next.set(block.id, current);
      if (block.content) {
        next.set(block.content, current);
      }
      return next;
    });
  }

  selectOptionByKey(key: string, optionText: string) {
    this.userAnswers.update(map => {
      const next = new Map(map);
      next.set(key, [optionText]);
      return next;
    });
  }

  isOptionSelected(block: ContentBlock, optionText: string): boolean {
    return this.isOptionSelectedByKey(block.id, optionText);
  }

  isOptionSelectedByKey(key: string, optionText: string): boolean {
    return this.userAnswers().get(key)?.includes(optionText) ?? false;
  }

  toggleCheck(checkText: string, checked: boolean) {
    this.completedChecks.update(set => {
      const next = new Set(set);
      if (checked) next.add(checkText);
      else next.delete(checkText);
      return next;
    });
  }

  isCheckDone(checkText: string): boolean {
    return this.completedChecks().has(checkText);
  }

  private resolveNextStepIndex(): number | null {
    const step = this.currentStep();
    if (!step) return null;

    const steps = this._steps();
    const answers = this.userAnswers();

    for (const block of step.content || []) {
      if (block.type === 'question' && block.options?.length) {
        const selected = answers.get(block.id) || [];
        for (const opt of block.options) {
          if (selected.includes(opt.text) && opt.nextStep) {
            const idx = steps.findIndex(s => s.id === opt.nextStep);
            if (idx >= 0) return idx;
          }
        }
      }

      if (block.type === 'required-check' && block.requiredChecks?.length) {
        for (const check of block.requiredChecks) {
          if (!check.options?.length) continue;
          const keys = [check.question || '', block.id].filter(Boolean);
          let selected: string[] = [];
          for (const k of keys) {
            const v = answers.get(k);
            if (v?.length) {
              selected = v;
              break;
            }
          }
          for (const opt of check.options) {
            if (selected.includes(opt.text) && opt.nextStep) {
              const idx = steps.findIndex(s => s.id === opt.nextStep);
              if (idx >= 0) return idx;
            }
          }
        }
      }
    }

    return null;
  }

  goNext() {
    const branchedIndex = this.resolveNextStepIndex();

    if (branchedIndex !== null) {
      this.currentStepIndex.set(branchedIndex);
      this.showSummary.set(false);
      return;
    }

    if (this.isLastStep()) {
      this.showSummary.set(true);
      return;
    }

    this.currentStepIndex.update(i => i + 1);
  }

  goPrev() {
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update(i => i - 1);
      this.showSummary.set(false);
    }
  }

  shouldShowEndCall(): boolean {
    const step = this.currentStep();
    if (!step) return false;
    return step.content.some(b => b.type === 'end-call');
  }

  finishPreview() {
    this.showSummary.set(true);
  }

  close() {
    this.closed.emit();
  }

  restart() {
    this.currentStepIndex.set(0);
    this.userAnswers.set(new Map());
    this.completedChecks.set(new Set());
    this.showSummary.set(false);
  }
}