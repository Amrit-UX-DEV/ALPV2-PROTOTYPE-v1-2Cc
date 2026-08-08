import {
  Component,
  Input,
  OnChanges,
  OnInit,
  OnDestroy,
  SimpleChanges,
  signal,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ScriptStep,
  ContentBlock
} from './models/script-builder.models';
import { ScriptToolkitComponent } from './toolkit/script-toolkit.component';
import { ScriptPreviewComponent } from './preview/script-preview.component';
import { ConfirmPopoverComponent } from './popovers/confirm-popover/confirm-popover.component';
import { OrderStepsPopoverComponent } from './popovers/order-steps-popover/order-steps-popover.component';
import { ScriptDefinitionService } from './services/script-definition.service';


const PROMPT_VARIABLE_LABELS: Record<string, string> = {
  policyValue: 'Policy Value',
  option2: 'Option 2',
  option3: 'Option 3',
  option4: 'Option 4',
  option5: 'Option 5',
  option6: 'Option 6'
};

@Component({
  selector: 'alpha-script-builder',
  standalone: true,
  imports: [
    CommonModule,
    ScriptToolkitComponent,
    ScriptPreviewComponent,
    ConfirmPopoverComponent,
    OrderStepsPopoverComponent
  ],
  templateUrl: './script-builder.component.html',
  styleUrls: ['./script-builder.component.css']
})
export class ScriptBuilderComponent implements OnChanges, OnInit, OnDestroy {
  private readonly now = signal(Date.now());
  private timer?: ReturnType<typeof setInterval>;

  private readonly scriptDefinition = inject(ScriptDefinitionService);

  /**
   * Accept work-plan ScriptSetupSelection as-is (no extra index signature).
   * Property names resolved at runtime in resolveScriptFileId().
   */
  @Input() setup: {
    product?: string;
    requestType?: string;
    scriptName?: string;
    scriptDescription?: string;
    scriptId?: string | null;
    scriptFileId?: string | null;
    filename?: string | null;
    mode?: string;
  } | null = null;

  product = 'Policy Surrender';
  requestType = 'Full Surrender';
  scriptName = 'Surrender Script';
  scriptDescription = '';

  readonly steps = signal<ScriptStep[]>([]);
  readonly isLoadingScript = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly showToolkit = signal(false);
  readonly editingStepId = signal<string | null>(null);
  readonly insertAtIndex = signal<number | null>(null);

  readonly showPreview = signal(false);

  readonly showConfirm = signal(false);
  readonly confirmTitle = signal('');
  readonly confirmMessage = signal('');
  readonly pendingAction = signal<'move-step' | 'order-jump' | 'copy-step' | null>(null);
  readonly pendingMove = signal<{ index: number; direction: 'up' | 'down' } | null>(null);
  readonly pendingOrderJump = signal<{ sourceIndex: number; targetIndex: number } | null>(null);
  readonly pendingCopy = signal<{ sourceIndex: number; targetIndex: number } | null>(null);
  readonly skipMoveConfirm = signal(false);

  readonly showOrderPopover = signal(false);
  readonly orderMode = signal<'move' | 'copy'>('move');
  readonly orderSourceIndex = signal(0);

  ngOnInit() {
    this.timer = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['setup']) {
      this.applySetup(this.setup);
    }
  }

  private applySetup(setup: ScriptBuilderComponent['setup']) {
    if (!setup) {
      this.steps.set([]);
      this.loadError.set(null);
      return;
    }

    if (setup.product) {
      this.product = String(setup.product);
    }
    if (setup.requestType) {
      this.requestType = String(setup.requestType);
    }
    if (setup.scriptName) {
      this.scriptName = String(setup.scriptName);
    }
    if (setup.scriptDescription) {
      this.scriptDescription = String(setup.scriptDescription);
    }

    const fileId = this.resolveScriptFileId(setup);

    if (fileId) {
      void this.loadScriptById(fileId);
    } else {
      this.steps.set([]);
      this.loadError.set(null);
      this.isLoadingScript.set(false);
    }
  }

  private resolveScriptFileId(setup: NonNullable<ScriptBuilderComponent['setup']>): string | null {
    const anySetup = setup as Record<string, unknown>;
    const raw =
      anySetup['scriptFileId'] ??
      anySetup['scriptId'] ??
      anySetup['filename'] ??
      anySetup['fileId'] ??
      anySetup['id'] ??
      null;

    if (raw == null || raw === '') return null;

    let id = String(raw).trim();
    if (id.endsWith('.json')) {
      id = id.slice(0, -5);
    }
    return id || null;
  }

  private async loadScriptById(id: string) {
    this.isLoadingScript.set(true);
    this.loadError.set(null);

    try {
      const result = await this.scriptDefinition.loadBuilderSteps(id);

      if (!result) {
        this.loadError.set('Could not load script JSON.');
        this.steps.set([]);
        return;
      }

      // Loaded scripts start with no activity tags; tags are generated by user
      // actions in this editing session only.
      this.steps.set(result.steps.map(s => ({ ...s, activity: undefined })));

      if (result.title) {
        this.scriptName = result.title;
      }
      if (result.description) {
        this.scriptDescription = result.description;
      }
    } catch (err) {
      console.error('Script builder load failed', err);
      this.loadError.set('Could not load script JSON.');
      this.steps.set([]);
    } finally {
      this.isLoadingScript.set(false);
    }
  }

  sortedContent(step: ScriptStep): ContentBlock[] {
    return [...(step.content || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  getStepLabel(stepId: string): string {
    const idx = this.steps().findIndex(s => s.id === stepId);
    return idx >= 0 ? `Step ${idx + 1}` : stepId;
  }

  getActivityTags(
    step: ScriptStep
  ): { label: string; variant: 'created' | 'edited' | 'order-edited' }[] {
    const a = step.activity;
    if (!a) return [];

    const tags: { label: string; variant: 'created' | 'edited' | 'order-edited' }[] = [];

    if (a.contentEditedAt) {
      tags.push({
        label: this.formatRelativeTime('Content edited', a.contentEditedAt),
        variant: 'edited'
      });
    } else if (a.createdAt) {
      tags.push({
        label: this.formatRelativeTime('Created', a.createdAt, true),
        variant: 'created'
      });
    }

    if (a.orderChangedAt) {
      tags.push({
        label: this.formatRelativeTime('Order changed', a.orderChangedAt),
        variant: 'order-edited'
      });
    }

    return tags;
  }

  private formatRelativeTime(
    verb: string,
    timestamp: number,
    isCreated = false
  ): string {
    const diffSec = Math.floor((this.now() - timestamp) / 1000);

    if (diffSec < 30) {
      return isCreated ? `Just ${verb.toLowerCase()}` : verb;
    }

    if (diffSec < 60) {
      // Hold at 30 seconds until the one-minute threshold, rather than
      // counting every second upward.
      return `${verb} 30 seconds ago`;
    }

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return `${verb} ${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    }

    const diffHour = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    if (remMin === 0) {
      return `${verb} ${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    }
    return `${verb} ${diffHour} hour${diffHour === 1 ? '' : 's'} ${remMin} minute${remMin === 1 ? '' : 's'} ago`;
  }

  formatPromptHtml(text: string | null | undefined): string {
    if (!text) return '';
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    escaped = escaped.replace(/\{\{(\w+)\}\}/g, (_m, id: string) => {
      const label = PROMPT_VARIABLE_LABELS[id] || id;
      return `<span class="auth-prompt-variable">${label}</span>`;
    });
    return escaped
      .replace(/([.?!])\s+/g, '$1<br><br>')
      .replace(/(<br>){4,}/g, '<br><br>');
  }

  openToolkit(stepId?: string, insertAt?: number) {
    this.editingStepId.set(stepId ?? null);
    this.insertAtIndex.set(insertAt ?? null);
    this.showToolkit.set(true);
  }

  closeToolkit() {
    this.showToolkit.set(false);
    this.editingStepId.set(null);
    this.insertAtIndex.set(null);
  }

  onStepSaved(step: ScriptStep) {
    this.steps.update(list => {
      const idx = list.findIndex(s => s.id === step.id);
      if (idx >= 0) {
        const copy = [...list];
        const existingActivity = list[idx].activity;
        copy[idx] = {
          ...step,
          activity: {
            ...existingActivity,
            createdAt: existingActivity?.createdAt,
            contentEditedAt: Date.now()
          }
        };
        return copy.map((s, i) => ({ ...s, order: i + 1 }));
      }

      const insertAt = this.insertAtIndex();
      const newStep: ScriptStep = {
        ...step,
        activity: { createdAt: Date.now() }
      };
      const copy = [...list];
      if (insertAt == null || insertAt < 0 || insertAt > copy.length) {
        copy.push(newStep);
      } else {
        copy.splice(insertAt, 0, newStep);
      }
      return copy.map((s, i) => ({ ...s, order: i + 1 }));
    });
    this.closeToolkit();
  }

  onStepRemoved(stepId: string) {
    this.steps.update(list =>
      list.filter(s => s.id !== stepId).map((s, i) => ({ ...s, order: i + 1 }))
    );
    this.closeToolkit();
  }

  requestMoveStep(index: number, direction: 'up' | 'down') {
    if (this.skipMoveConfirm()) {
      this.performMoveStep(index, direction);
      return;
    }
    this.pendingAction.set('move-step');
    this.pendingMove.set({ index, direction });
    this.confirmTitle.set('Change step order?');
    this.confirmMessage.set(
      'You are about to change the order of steps in this script.'
    );
    this.showConfirm.set(true);
  }

  private performMoveStep(index: number, direction: 'up' | 'down') {
    this.steps.update(list => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      const now = Date.now();
      copy[index] = { ...copy[index], activity: { ...copy[index].activity, orderChangedAt: now } };
      copy[target] = { ...copy[target], activity: { ...copy[target].activity, orderChangedAt: now } };
      return copy.map((s, i) => ({ ...s, order: i + 1 }));
    });
  }

  openOrderPopover(sourceIndex: number) {
    this.orderMode.set('move');
    this.orderSourceIndex.set(sourceIndex);
    this.showOrderPopover.set(true);
  }

  openCopyPopover(sourceIndex: number) {
    this.orderMode.set('copy');
    this.orderSourceIndex.set(sourceIndex);
    this.showOrderPopover.set(true);
  }

  closeOrderPopover() {
    this.showOrderPopover.set(false);
  }

  onOrderPopoverConfirmed(event: { sourceIndex: number; targetIndex: number }) {
    const mode = this.orderMode();

    if (mode === 'copy') {
      this.pendingAction.set('copy-step');
      this.pendingCopy.set(event);
      this.confirmTitle.set('Copy Step?');
      this.confirmMessage.set(
        'You are about to create a copy of this step in the selected position.'
      );
      this.showConfirm.set(true);
      return;
    }

    if (event.sourceIndex === event.targetIndex) return;

    if (this.skipMoveConfirm()) {
      this.closeOrderPopover();
      this.performOrderJump(event.sourceIndex, event.targetIndex);
      return;
    }

    this.pendingAction.set('order-jump');
    this.pendingOrderJump.set(event);
    this.confirmTitle.set('Change step order?');
    this.confirmMessage.set(
      'You are about to change the order of steps in this script.'
    );
    this.showConfirm.set(true);
  }

  private performOrderJump(fromIndex: number, toIndex: number) {
    this.steps.update(list => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= list.length ||
        toIndex >= list.length ||
        fromIndex === toIndex
      ) {
        return list;
      }
      const copy = [...list];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      const now = Date.now();
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      for (let i = start; i <= end; i++) {
        copy[i] = { ...copy[i], activity: { ...copy[i].activity, orderChangedAt: now } };
      }
      return copy.map((s, i) => ({ ...s, order: i + 1 }));
    });
  }

  private performCopyStep(sourceIndex: number, targetIndex: number) {
    this.steps.update(list => {
      if (
        sourceIndex < 0 ||
        targetIndex < 0 ||
        sourceIndex >= list.length ||
        targetIndex > list.length
      ) {
        return list;
      }
      const clone = this.cloneStepFrom(list[sourceIndex]);
      const copy = [...list];
      copy.splice(targetIndex, 0, clone);
      const now = Date.now();
      for (let i = targetIndex; i < copy.length; i++) {
        copy[i] = { ...copy[i], activity: { ...copy[i].activity, orderChangedAt: now } };
      }
      return copy.map((s, i) => ({ ...s, order: i + 1 }));
    });
  }

  private cloneStepFrom(source: ScriptStep): ScriptStep {
    const stamp = Date.now();
    const newStepId = `step-${stamp}`;
    const idMap = new Map<string, string>();

    const content = (source.content || []).map((block, i) => {
      const newBlockId = `${newStepId}-block-${i + 1}-${stamp}`;
      idMap.set(block.id, newBlockId);

      const cloned = structuredClone(block) as ContentBlock;
      cloned.id = newBlockId;
      cloned.order = i + 1;

      if (cloned.options?.length) {
        cloned.options = cloned.options.map(o => ({
          text: o.text,
          nextStep: undefined
        }));
      }

      if (cloned.requiredChecks?.length) {
        cloned.requiredChecks = cloned.requiredChecks.map(c => ({
          ...c,
          options: c.options?.map(o => ({
            text: o.text,
            nextStep: undefined
          }))
        }));
      }

      return cloned;
    });

    for (const block of content) {
      if (block.condition?.dependsOn) {
        const mapped = idMap.get(block.condition.dependsOn);
        if (mapped) {
          block.condition = {
            ...block.condition,
            dependsOn: mapped
          };
        }
      }
    }

    return {
      id: newStepId,
      order: 0,
      title: source.title,
      hideTitleInJourney: source.hideTitleInJourney,
      content,
      activity: { createdAt: stamp }
    };
  }

  onConfirm(dontShowAgain: boolean) {
    if (dontShowAgain) {
      this.skipMoveConfirm.set(true);
    }

    const action = this.pendingAction();

    if (action === 'move-step' && this.pendingMove()) {
      const { index, direction } = this.pendingMove()!;
      this.performMoveStep(index, direction);
    }

    if (action === 'order-jump' && this.pendingOrderJump()) {
      const { sourceIndex, targetIndex } = this.pendingOrderJump()!;
      this.performOrderJump(sourceIndex, targetIndex);
      this.closeOrderPopover();
    }

    if (action === 'copy-step' && this.pendingCopy()) {
      const { sourceIndex, targetIndex } = this.pendingCopy()!;
      this.performCopyStep(sourceIndex, targetIndex);
      this.closeOrderPopover();
    }

    this.closeConfirm();
  }

  closeConfirm() {
    this.showConfirm.set(false);
    this.pendingAction.set(null);
    this.pendingMove.set(null);
    this.pendingOrderJump.set(null);
    this.pendingCopy.set(null);
  }

  openPreview() {
    this.showPreview.set(true);
  }

  closePreview() {
    this.showPreview.set(false);
  }
}
