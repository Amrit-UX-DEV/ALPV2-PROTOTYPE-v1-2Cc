import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ScriptStep,
  ContentBlock,
  ContentType,
  ContentCondition
} from '../models/script-builder.models';
import { ContentCardComponent } from '../content-card/content-card.component';
import { TypePickerComponent } from '../popovers/type-picker/type-picker.component';
import { ConditionPopoverComponent } from '../popovers/condition-popover/condition-popover.component';
import { StepPickerComponent } from '../popovers/step-picker/step-picker.component';
import { ConfirmPopoverComponent } from '../popovers/confirm-popover/confirm-popover.component';

@Component({
  selector: 'alpha-script-toolkit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ContentCardComponent,
    TypePickerComponent,
    ConditionPopoverComponent,
    StepPickerComponent,
    ConfirmPopoverComponent
  ],
  templateUrl: './script-toolkit.component.html',
  styleUrls: ['./script-toolkit.component.css']
})
export class ScriptToolkitComponent implements OnChanges {

  @Input() stepId: string | null = null;
  @Input() insertAtIndex: number | null = null;
  @Input() existingSteps: ScriptStep[] = [];

  @Output() saved = new EventEmitter<ScriptStep>();
  @Output() removed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();


  readonly title = signal('');
  readonly hideTitleInJourney = signal(false);
  readonly currentContent = signal<ContentBlock[]>([]);
  readonly editingId = signal<string | null>(null);

  readonly showTypePicker = signal(false);
  readonly showConditionPopover = signal(false);
  readonly conditionTargetId = signal<string | null>(null);

  readonly showStepPicker = signal(false);
  readonly stepPickerBlockId = signal<string | null>(null);
  readonly stepPickerOptionIndex = signal(0);
  readonly stepPickerCheckIndex = signal<number | undefined>(undefined);
  readonly stepPickerCurrentValue = signal<string | null>(null);

  readonly showConfirm = signal(false);
  readonly confirmTitle = signal('');
  readonly confirmMessage = signal('');
  readonly pendingConfirmAction = signal<
    'move-content' | 'remove-content' | 'remove-step' | null
  >(null);
  readonly pendingMove = signal<{ index: number; direction: 'up' | 'down' } | null>(null);
  readonly pendingRemoveContentId = signal<string | null>(null);
  readonly skipMoveConfirm = signal(false);

  readonly isEditMode = computed(() => !!this.stepId);

  readonly stepNumber = computed(() => {
    if (this.isEditMode()) {
      const idx = (this.existingSteps || []).findIndex(s => s.id === this.stepId);
      return idx >= 0 ? idx + 1 : null;
    }
    return this.insertAtIndex != null ? this.insertAtIndex + 1 : null;
  });

  readonly headerTitle = computed(() => {
    const n = this.stepNumber();
    const suffix = n != null ? ` ${n}` : '';
    return this.isEditMode() ? `Edit Step${suffix}` : `Add Step${suffix}`;
  });

  readonly availableStepIds = computed(() =>
    (this.existingSteps || []).map(s => s.id)
  );

  ngOnChanges(changes: SimpleChanges) {
    if (changes['stepId'] || changes['existingSteps']) {
      this.bootstrap();
    }
  }

  private bootstrap() {
    const id = this.stepId;
    this.editingId.set(id);

    if (id) {
      const existing = this.existingSteps.find(s => s.id === id);
      if (existing) {
        this.title.set(existing.title || '');
        this.hideTitleInJourney.set(!!existing.hideTitleInJourney);
        this.currentContent.set(
          structuredClone(existing.content || []).sort(
            (a, b) => (a.order ?? 0) - (b.order ?? 0)
          )
        );
        return;
      }
    }

    this.title.set('');
    this.hideTitleInJourney.set(false);
    this.currentContent.set([]);
  }

  private newBlockId(type: string): string {
    return `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  /* ---------- Type picker ---------- */
  openTypePicker() {
    this.showTypePicker.set(true);
  }

  closeTypePicker() {
    this.showTypePicker.set(false);
  }

  onTypeSelected(type: ContentType) {
    this.addContent(type);
    this.closeTypePicker();
  }

  addContent(type: ContentType) {
    const list = [...this.currentContent()];
    const order = list.length + 1;
    const id = this.newBlockId(type);

    const block: ContentBlock = {
      id,
      order,
      type,
      content: type === 'end-call' ? 'End Call' : '',
      ...(type === 'question'
        ? {
            selectionMode: 'single' as const,
            options: [{ text: 'Yes' }, { text: 'No' }]
          }
        : {}),
      ...(type === 'required-check' ? { requiredChecks: [] } : {})
    };

    list.push(block);
    this.currentContent.set(list.map((b, i) => ({ ...b, order: i + 1 })));
  }

  /* ---------- Content changes ---------- */
  onContentChanged(updated: ContentBlock) {
    this.currentContent.update(list =>
      list.map(b => (b.id === updated.id ? { ...updated } : b))
    );
  }

  requestMove(index: number, direction: 'up' | 'down') {
    if (this.skipMoveConfirm()) {
      this.performMove(index, direction);
      return;
    }
    this.pendingConfirmAction.set('move-content');
    this.pendingMove.set({ index, direction });
    this.confirmTitle.set('Change content order?');
    this.confirmMessage.set(
      'You are about to change the order of content within this step.'
    );
    this.showConfirm.set(true);
  }

  private performMove(index: number, direction: 'up' | 'down') {
    this.currentContent.update(list => {
      const copy = [...list];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= copy.length) return list;
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy.map((b, i) => ({ ...b, order: i + 1 }));
    });
  }

  requestRemoveContent(contentId: string) {
    this.pendingConfirmAction.set('remove-content');
    this.pendingRemoveContentId.set(contentId);
    this.confirmTitle.set('Remove this content?');
    this.confirmMessage.set(
      'This will permanently delete this content block from the step.'
    );
    this.showConfirm.set(true);
  }

  private performRemoveContent(contentId: string) {
    this.currentContent.update(list =>
      list.filter(b => b.id !== contentId).map((b, i) => ({ ...b, order: i + 1 }))
    );
  }

  /* ---------- Condition ---------- */
  openCondition(blockId: string) {
    this.conditionTargetId.set(blockId);
    this.showConditionPopover.set(true);
  }

  closeCondition() {
    this.showConditionPopover.set(false);
    this.conditionTargetId.set(null);
  }

  onConditionSaved(condition: ContentCondition | null) {
    const targetId = this.conditionTargetId();
    if (!targetId) {
      this.closeCondition();
      return;
    }

    this.currentContent.update(list =>
      list.map(b => {
        if (b.id !== targetId) return b;
        if (!condition) {
          const { condition: _c, ...rest } = b;
          return rest as ContentBlock;
        }
        return { ...b, condition: { ...condition } };
      })
    );
    this.closeCondition();
  }

  /* ---------- Step picker (nextStep) ---------- */
  openStepPicker(event: {
    blockId: string;
    optionIndex: number;
    checkIndex?: number;
  }) {
    this.stepPickerBlockId.set(event.blockId);
    this.stepPickerOptionIndex.set(event.optionIndex);
    this.stepPickerCheckIndex.set(event.checkIndex);

    let current: string | null = null;
    const block = this.currentContent().find(b => b.id === event.blockId);
    if (block) {
      if (event.checkIndex != null && block.requiredChecks?.[event.checkIndex]?.options) {
        current =
          block.requiredChecks[event.checkIndex].options![event.optionIndex]
            ?.nextStep || null;
      } else if (block.options) {
        current = block.options[event.optionIndex]?.nextStep || null;
      }
    }
    this.stepPickerCurrentValue.set(current);
    this.showStepPicker.set(true);
  }

  closeStepPicker() {
    this.showStepPicker.set(false);
    this.stepPickerBlockId.set(null);
  }

  onStepPickerSaved(stepId: string | null) {
    if (!stepId) {
      this.closeStepPicker();
      return;
    }

    const blockId = this.stepPickerBlockId();
    const optionIndex = this.stepPickerOptionIndex();
    const checkIndex = this.stepPickerCheckIndex();
    if (!blockId) return;

    this.currentContent.update(list =>
      list.map(block => {
        if (block.id !== blockId) return block;

        if (checkIndex != null && block.requiredChecks) {
          const requiredChecks = [...block.requiredChecks];
          const check = { ...requiredChecks[checkIndex] };
          if (!check.options) return block;
          const options = [...check.options];
          options[optionIndex] = { ...options[optionIndex], nextStep: stepId };
          check.options = options;
          requiredChecks[checkIndex] = check;
          return { ...block, requiredChecks };
        }

        if (block.options) {
          const options = [...block.options];
          options[optionIndex] = { ...options[optionIndex], nextStep: stepId };
          return { ...block, options };
        }

        return block;
      })
    );

    this.closeStepPicker();
  }

  /* ---------- Confirm ---------- */
  onConfirm(dontShowAgain: boolean) {
    if (dontShowAgain && this.pendingConfirmAction() === 'move-content') {
      this.skipMoveConfirm.set(true);
    }

    const action = this.pendingConfirmAction();

    if (action === 'move-content' && this.pendingMove()) {
      const { index, direction } = this.pendingMove()!;
      this.performMove(index, direction);
    }

    if (action === 'remove-content' && this.pendingRemoveContentId()) {
      this.performRemoveContent(this.pendingRemoveContentId()!);
    }

    if (action === 'remove-step') {
      const id = this.editingId();
      if (id) this.removed.emit(id);
    }

    this.closeConfirm();
  }

  closeConfirm() {
    this.showConfirm.set(false);
    this.pendingConfirmAction.set(null);
    this.pendingMove.set(null);
    this.pendingRemoveContentId.set(null);
  }

  /* ---------- Step actions ---------- */
  removeStep() {
    this.pendingConfirmAction.set('remove-step');
    this.confirmTitle.set('Remove this step?');
    this.confirmMessage.set(
      'This will permanently delete the step and all of its content.'
    );
    this.showConfirm.set(true);
  }

  /**
   * Clone: keep content + conditions; new ids; clear nextStep only.
   */

  private buildStepPayload(): ScriptStep {
    const id = this.editingId() || `step-${Date.now()}`;
    return {
      id,
      order: 0,
      title: this.title(),
      hideTitleInJourney: this.hideTitleInJourney(),
      content: this.currentContent().map((b, i) => ({ ...b, order: i + 1 }))
    };
  }

  save() {
    this.saved.emit(this.buildStepPayload());
  }

  cancel() {
    this.cancelled.emit();
  }
}
