import { Injectable } from '@angular/core';
import {
  ScriptStep,
  ContentBlock,
  JourneyScriptFile,
  RequiredCheckItem,
  ScriptOption,
  SelectionMode,
  ContentCondition
} from '../models/script-builder.models';

@Injectable({ providedIn: 'root' })
export class ScriptDefinitionService {

  private readonly basePath = 'assets/data/call-rep-scripts';

  async loadBuilderSteps(scriptFileId: string): Promise<{
    title: string;
    description: string;
    steps: ScriptStep[];
  } | null> {
    try {
      const url = `${this.basePath}/${scriptFileId}.json?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error('Failed to load script JSON:', url, res.status);
        return null;
      }

      const data = (await res.json()) as JourneyScriptFile & Record<string, unknown>;
      console.log('📦 Loaded journey JSON:', data);

      const rawSteps = (data.steps || []) as any[];

      // Preserve JSON array order; only sort if explicit order values exist
      const hasExplicitOrder = rawSteps.some(
        s => typeof s.order === 'number' || typeof s.stepOrder === 'number'
      );
      const orderedRaw = hasExplicitOrder
        ? [...rawSteps].sort(
            (a, b) =>
              (a.order ?? a.stepOrder ?? 0) - (b.order ?? b.stepOrder ?? 0)
          )
        : rawSteps;

      const steps = orderedRaw.map((step, index) => this.mapJourneyStep(step, index));

      console.log('🔧 Mapped builder steps:', steps);

      return {
        title: (data as any).title || scriptFileId,
        description: (data as any).description || '',
        steps
      };
    } catch (err) {
      console.error('Error loading script JSON', err);
      return null;
    }
  }

  private mapJourneyStep(raw: any, index: number): ScriptStep {
    if (Array.isArray(raw.content) && raw.id) {
      const content = structuredClone(raw.content) as ContentBlock[];
      content.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return {
        id: String(raw.id),
        order: index + 1,
        title: raw.title || '',
        hideTitleInJourney: !!raw.hideTitleInJourney,
        content
      };
    }

    const stepId = String(raw.id || raw.stepId || `step-${index + 1}`);
    const content: ContentBlock[] = [];
    let order = 1;

    const stepCondition = this.normalizeCondition(raw);

    // Journey display order: prompt → question → checks → actions → end call
    const reply = this.pickString(raw, [
      'scriptedReply',
      'readPrompt',
      'prompt',
      'reply',
      'scripted_reply',
      'read_prompt'
    ]);

    if (reply) {
      const block: ContentBlock = {
        id: `${stepId}-prompt`,
        order: order++,
        type: 'prompt',
        content: reply
      };
      if (stepCondition) block.condition = stepCondition;
      content.push(block);
    }

    const question = this.pickString(raw, [
      'question',
      'questionText',
      'question_text'
    ]);

    const options = this.normalizeOptions(
      raw.options || raw.answers || raw.choices || raw.branches || []
    );

    if (question || options.length > 0) {
      content.push({
        id: `${stepId}-question`,
        order: order++,
        type: 'question',
        content: question || '(choose an option)',
        selectionMode: this.normalizeSelectionMode(raw.selectionMode || raw.selection_mode),
        options
      });
    }

    const rawChecks = raw.requiredChecks || raw.checks || raw.required_checks || [];
    if (Array.isArray(rawChecks) && rawChecks.length > 0) {
      const checks: RequiredCheckItem[] = rawChecks.map((c: any) => {
        if (typeof c === 'string') {
          return {
            question: c,
            manual: true,
            selectionMode: 'single' as SelectionMode
          };
        }
        return {
          question: c.question || c.text || c.label || '',
          answer: c.answer || c.value,
          auto: c.auto === true || c.autoAnswered === true,
          manual: c.manual != null ? !!c.manual : !(c.auto === true || c.autoAnswered === true),
          selectionMode: this.normalizeSelectionMode(c.selectionMode || c.selection_mode),
          options: this.normalizeOptions(c.options || c.answers || c.choices || [])
        };
      });

      content.push({
        id: `${stepId}-checks`,
        order: order++,
        type: 'required-check',
        content: checks.map(c => c.question).filter(Boolean).join('; ') || 'Required checks',
        requiredChecks: checks
      });
    }

    const nestedPrompts = raw.conditionalPrompts || raw.prompts || raw.conditionalReplies || [];
    if (Array.isArray(nestedPrompts)) {
      for (const p of nestedPrompts) {
        const text =
          typeof p === 'string'
            ? p
            : this.pickString(p, [
                'scriptedReply',
                'readPrompt',
                'prompt',
                'reply',
                'text',
                'content'
              ]);
        if (!text) continue;
        const block: ContentBlock = {
          id: `${stepId}-cprompt-${order}`,
          order: order++,
          type: 'prompt',
          content: text
        };
        const cond = this.normalizeCondition(p) || stepCondition;
        if (cond) block.condition = cond;
        content.push(block);
      }
    }

    const actions = raw.actions || raw.tasks || [];
    if (Array.isArray(actions)) {
      for (const action of actions) {
        const text =
          typeof action === 'string' ? action : action?.text || action?.label || '';
        if (!text) continue;
        content.push({
          id: `${stepId}-action-${order}`,
          order: order++,
          type: 'log-task',
          content: text
        });
      }
    }

    const endCall =
      raw.endCall === true ||
      raw.end_call === true ||
      raw.isEndCall === true ||
      raw.type === 'end-call' ||
      raw.type === 'endCall';

    if (endCall) {
      content.push({
        id: `${stepId}-end`,
        order: order++,
        type: 'end-call',
        content: 'End Call'
      });
    }

    if (content.length === 0) {
      content.push({
        id: `${stepId}-placeholder`,
        order: 1,
        type: 'prompt',
        content: raw.title || stepId || '(no content mapped)'
      });
    }

    content.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return {
      id: stepId,
      order: index + 1,
      title: raw.title || '',
      hideTitleInJourney: !raw.title,
      content
    };
  }

  private normalizeCondition(raw: any): ContentCondition | undefined {
    if (!raw || typeof raw !== 'object') return undefined;

    if (raw.condition && typeof raw.condition === 'object') {
      const c = raw.condition;
      const dependsOn = c.dependsOn || c.check || c.question || c.field || c.id;
      if (!dependsOn) return undefined;
      if (c.checkQuestion || c.check_question) {
        return {
          dependsOn: String(dependsOn),
          checkQuestion: String(c.checkQuestion || c.check_question),
          answer: c.answer != null ? String(c.answer) : undefined
        };
      }
      return {
        dependsOn: String(dependsOn),
        answers: this.normalizeAnswerList(c.answers ?? c.answer ?? c.equals ?? c.value)
      };
    }

    if (raw.showWhen && typeof raw.showWhen === 'object') {
      const s = raw.showWhen;
      const dependsOn = s.dependsOn || s.check || s.question || s.field || s.id;
      if (!dependsOn) return undefined;
      if (s.checkQuestion || s.check_question) {
        return {
          dependsOn: String(dependsOn),
          checkQuestion: String(s.checkQuestion || s.check_question),
          answer: s.answer != null ? String(s.answer) : undefined
        };
      }
      return {
        dependsOn: String(dependsOn),
        answers: this.normalizeAnswerList(s.answers ?? s.answer ?? s.equals ?? s.value)
      };
    }

    if (raw.dependsOn || raw.depends_on) {
      const dependsOn = raw.dependsOn || raw.depends_on;
      if (raw.checkQuestion || raw.check_question) {
        return {
          dependsOn: String(dependsOn),
          checkQuestion: String(raw.checkQuestion || raw.check_question),
          answer: raw.answer != null ? String(raw.answer) : undefined
        };
      }
      return {
        dependsOn: String(dependsOn),
        answers: this.normalizeAnswerList(
          raw.answers ?? raw.answer ?? raw.equals ?? raw.value
        )
      };
    }

    return undefined;
  }

  private normalizeAnswerList(value: unknown): string[] | undefined {
    if (value == null) return undefined;
    if (Array.isArray(value)) {
      return value.map(v => String(v)).filter(Boolean);
    }
    const s = String(value).trim();
    return s ? [s] : undefined;
  }

  private pickString(obj: any, keys: string[]): string {
    for (const key of keys) {
      const val = obj?.[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return '';
  }

  private normalizeSelectionMode(value: unknown): SelectionMode {
    if (value === 'multi' || value === 'multiple') return 'multi';
    return 'single';
  }

  private normalizeOptions(raw: any[]): ScriptOption[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((o: any) => {
        if (typeof o === 'string') return { text: o };
        const text = o.text || o.label || o.answer || o.value || '';
        const nextStep =
          o.nextStep ||
          o.next_step ||
          o.next ||
          o.targetStep ||
          o.target_step ||
          o.goto ||
          o.goTo ||
          undefined;
        return {
          text: String(text),
          nextStep: nextStep != null ? String(nextStep) : undefined
        };
      })
      .filter(o => !!o.text);
  }
}