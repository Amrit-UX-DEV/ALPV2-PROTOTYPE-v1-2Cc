import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ContentBlock,
  SelectionMode,
  RequiredCheckItem
} from '../models/script-builder.models';

@Component({
  selector: 'alpha-content-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './content-card.component.html',
  styleUrls: ['./content-card.component.css']
})
export class ContentCardComponent {

  @Input({ required: true }) item!: ContentBlock;
  @Input() index = 0;
  @Input() total = 1;
  @Input() availableStepIds: string[] = [];
  @Input() contentList: ContentBlock[] = [];

  @Output() changed = new EventEmitter<ContentBlock>();
  @Output() moveUp = new EventEmitter<void>();
  @Output() moveDown = new EventEmitter<void>();
  @Output() removed = new EventEmitter<void>();
  @Output() openCondition = new EventEmitter<void>();
  @Output() openStepPicker = new EventEmitter<{ blockId: string; optionIndex: number; checkIndex?: number }>();

  @ViewChild('contentTextarea') contentTextarea?: ElementRef<HTMLTextAreaElement>;

  readonly showVariablePopover = signal(false);
  readonly variableSearch = signal('');
  readonly selectedVariableId = signal<string | null>(null);

  readonly promptVariables = [
    { id: 'policyValue', label: 'Policy Value' },
    { id: 'option2', label: 'Option 2' },
    { id: 'option3', label: 'Option 3' },
    { id: 'option4', label: 'Option 4' },
    { id: 'option5', label: 'Option 5' },
    { id: 'option6', label: 'Option 6' }
  ];

  readonly filteredVariables = computed(() => {
    const term = this.variableSearch().toLowerCase().trim();
    if (!term) return this.promptVariables;
    return this.promptVariables.filter(
      v =>
        v.label.toLowerCase().includes(term) ||
        v.id.toLowerCase().includes(term)
    );
  });

  /**
   * Resolve condition.dependsOn to type + id for tags.
   * Matches full id, or id ending / containing the dependsOn token (e.g. "C3").
   */
  dependencyMeta(): { type: string; id: string } | null {
    const dependsOn = (this.item.condition?.dependsOn || '').trim();
    if (!dependsOn) return null;

    const list = this.contentList || [];

    let found = list.find(b => b.id === dependsOn);

    if (!found) {
      found = list.find(
        b =>
          b.id.endsWith(dependsOn) ||
          b.id.includes(dependsOn) ||
          b.id.toLowerCase() === dependsOn.toLowerCase()
      );
    }

    if (found) {
      return { type: found.type || '', id: found.id };
    }

    return { type: '', id: dependsOn };
  }

  private emitChange(partial: Partial<ContentBlock>) {
    this.changed.emit({ ...this.item, ...partial });
  }

  updateContent(text: string) {
    this.emitChange({ content: text });
  }

  setSelectionMode(mode: SelectionMode) {
    this.emitChange({ selectionMode: mode });
  }

  addOption() {
    const options = this.item.options ? [...this.item.options, { text: '' }] : [{ text: '' }];
    this.emitChange({ options });
  }

  updateOptionText(index: number, text: string) {
    if (!this.item.options) return;
    const options = [...this.item.options];
    options[index] = { ...options[index], text };
    this.emitChange({ options });
  }

  removeOption(index: number) {
    if (!this.item.options) return;
    const options = this.item.options.filter((_, i) => i !== index);
    this.emitChange({ options });
  }

  clearDestination(index: number) {
    if (!this.item.options) return;
    const options = [...this.item.options];
    options[index] = { ...options[index], nextStep: undefined };
    this.emitChange({ options });
  }

  requestStepPicker(optionIndex: number, checkIndex?: number) {
    this.openStepPicker.emit({
      blockId: this.item.id,
      optionIndex,
      checkIndex
    });
  }

  clearCondition() {
    const { condition, ...rest } = this.item;
    this.changed.emit(rest as ContentBlock);
  }

  addAutoCheck() {
    const requiredChecks = this.item.requiredChecks
      ? [...this.item.requiredChecks, { question: '', answer: '', auto: true }]
      : [{ question: '', answer: '', auto: true }];
    this.emitChange({ requiredChecks });
  }

  addManualCheck() {
    const item: RequiredCheckItem = {
      question: '',
      manual: true,
      selectionMode: 'single',
      options: [{ text: 'Yes' }, { text: 'No' }]
    };
    const requiredChecks = this.item.requiredChecks
      ? [...this.item.requiredChecks, item]
      : [item];
    this.emitChange({ requiredChecks });
  }

  updateCheckItem(index: number, field: string, value: any) {
    if (!this.item.requiredChecks) return;
    const requiredChecks = [...this.item.requiredChecks];
    requiredChecks[index] = { ...requiredChecks[index], [field]: value };
    this.emitChange({ requiredChecks });
  }

  removeCheckItem(index: number) {
    if (!this.item.requiredChecks) return;
    const requiredChecks = this.item.requiredChecks.filter((_, i) => i !== index);
    this.emitChange({ requiredChecks });
  }

  addCheckOption(checkIndex: number) {
    if (!this.item.requiredChecks) return;
    const requiredChecks = [...this.item.requiredChecks];
    const check = { ...requiredChecks[checkIndex] };
    check.options = check.options ? [...check.options, { text: '' }] : [{ text: '' }];
    requiredChecks[checkIndex] = check;
    this.emitChange({ requiredChecks });
  }

  updateCheckOptionText(checkIndex: number, optIndex: number, text: string) {
    if (!this.item.requiredChecks) return;
    const requiredChecks = [...this.item.requiredChecks];
    const check = { ...requiredChecks[checkIndex] };
    if (!check.options) return;
    const options = [...check.options];
    options[optIndex] = { ...options[optIndex], text };
    check.options = options;
    requiredChecks[checkIndex] = check;
    this.emitChange({ requiredChecks });
  }

  removeCheckOption(checkIndex: number, optIndex: number) {
    if (!this.item.requiredChecks) return;
    const requiredChecks = [...this.item.requiredChecks];
    const check = { ...requiredChecks[checkIndex] };
    if (!check.options) return;
    check.options = check.options.filter((_, i) => i !== optIndex);
    requiredChecks[checkIndex] = check;
    this.emitChange({ requiredChecks });
  }

  clearCheckDestination(checkIndex: number, optIndex: number) {
    if (!this.item.requiredChecks) return;
    const requiredChecks = [...this.item.requiredChecks];
    const check = { ...requiredChecks[checkIndex] };
    if (!check.options) return;
    const options = [...check.options];
    options[optIndex] = { ...options[optIndex], nextStep: undefined };
    check.options = options;
    requiredChecks[checkIndex] = check;
    this.emitChange({ requiredChecks });
  }

  setCheckSelectionMode(checkIndex: number, mode: SelectionMode) {
    this.updateCheckItem(checkIndex, 'selectionMode', mode);
  }

  requestRemove() {
    this.removed.emit();
  }

  openVariablePopover() {
    this.variableSearch.set('');
    this.selectedVariableId.set(null);
    this.showVariablePopover.set(true);
  }

  closeVariablePopover() {
    this.showVariablePopover.set(false);
    this.selectedVariableId.set(null);
    this.variableSearch.set('');
  }

  selectVariable(id: string) {
    this.selectedVariableId.set(id);
  }

  onVariableSearch(event: Event) {
    this.variableSearch.set((event.target as HTMLInputElement).value);
  }

  insertSelectedVariable() {
    const id = this.selectedVariableId();
    if (!id) return;

    const token = `{{${id}}}`;
    const textarea = this.contentTextarea?.nativeElement;
    const current = this.item.content || '';

    if (textarea) {
      const start = textarea.selectionStart ?? current.length;
      const end = textarea.selectionEnd ?? current.length;
      const next = current.slice(0, start) + token + current.slice(end);
      this.updateContent(next);
      queueMicrotask(() => {
        const el = this.contentTextarea?.nativeElement;
        if (!el) return;
        const pos = start + token.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    } else {
      this.updateContent(current + token);
    }

    this.closeVariablePopover();
  }
}