import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScriptStep, ContentBlock } from '../../models/script-builder.models';

export interface OrderMoveTarget {
  kind: 'before-first' | 'after';
  afterIndex?: number;
}

export type StepPositionMode = 'move' | 'copy';

@Component({
  selector: 'alpha-order-steps-popover',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-steps-popover.component.html',
  styleUrls: ['./order-steps-popover.component.css'],
})
export class OrderStepsPopoverComponent implements AfterViewInit {
  @ViewChild('dialogRef') dialogRef!: ElementRef<HTMLDialogElement>;

  @Input({ required: true }) steps: ScriptStep[] = [];
  @Input({ required: true }) sourceIndex = 0;
  @Input() mode: StepPositionMode = 'move';

  @Output() confirmed = new EventEmitter<{
    sourceIndex: number;
    targetIndex: number;
  }>();
  @Output() cancelled = new EventEmitter<void>();

  readonly pendingTarget = signal<OrderMoveTarget | null>(null);

  readonly isMoveMode = computed(() => this.mode === 'move');
  readonly isCopyMode = computed(() => this.mode === 'copy');
  readonly sourceStepNumber = computed(() => this.sourceIndex + 1);

  readonly dialogTitle = computed(() =>
    this.isCopyMode()
      ? `Copy Step ${this.sourceStepNumber()}`
      : `Change Step ${this.sourceStepNumber()} Order`
  );
  readonly confirmButtonText = computed(() =>
    this.isCopyMode() ? 'Copy Step' : 'Change Order'
  );
  readonly moveButtonText = computed(() =>
    this.isCopyMode() ? 'Copy Here' : 'Move Here'
  );
  readonly undoButtonText = computed(() =>
    this.isCopyMode() ? 'Undo Copy' : 'Undo Move'
  );

  /**
   * After a pending move or copy: new 1-based step number for each current index.
   * When nothing selected, equals index + 1.
   */
  readonly previewNumbers = computed(() => {
    const n = this.steps.length;
    const from = this.sourceIndex;
    const p = this.pendingTarget();
    const base = Array.from({ length: n }, (_, i) => i + 1);
    if (!p) return base;

    const to = this.computeToIndex(p);
    if (to === from && this.isMoveMode()) return base;

    if (this.isCopyMode()) {
      // Source stays, copy inserted at to. Original indices shift by +1 from to onwards.
      return Array.from({ length: n }, (_, i) => (i < to ? i + 1 : i + 2));
    }

    // Move mode: reorder the source to the target position.
    const order = Array.from({ length: n }, (_, i) => i);
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item);

    const newNums = new Array<number>(n);
    order.forEach((origIdx, newIdx) => {
      newNums[origIdx] = newIdx + 1;
    });
    return newNums;
  });

  /** 1-based number the copied/moved step will become at the selected target. */
  readonly targetStepNumber = computed(() => {
    const p = this.pendingTarget();
    if (!p) return null;
    return this.computeToIndex(p) + 1;
  });

  isSource(index: number): boolean {
    return index === this.sourceIndex;
  }

  contentTypeInfos(
    step: ScriptStep
  ): { type: string; meta: string; hasDependency: boolean }[] {
    const content = [...(step.content || [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    return content.map((b: ContentBlock) => ({
      type: (b.type || '').toUpperCase(),
      meta: this.metaForBlock(b),
      hasDependency: !!b.condition,
    }));
  }

  metaForBlock(block: ContentBlock): string {
    switch (block.type) {
      case 'question':
        const optCount = block.options?.length ?? 0;
        return `${optCount} option${optCount === 1 ? '' : 's'}`;
      case 'required-check':
        const checkCount = block.requiredChecks?.length ?? 0;
        return `${checkCount} check${checkCount === 1 ? '' : 's'}`;
      case 'prompt':
        const words = block.content
          ? block.content
              .trim()
              .split(/\s+/)
              .filter((w) => w.length > 0).length
          : 0;
        return `${words} word${words === 1 ? '' : 's'}`;
      case 'log-task':
        return '1 task';
      case 'end-call':
        return 'end';
      default:
        return '';
    }
  }

  currentNumber(index: number): number {
    return index + 1;
  }

  previewNumber(index: number): number {
    return this.previewNumbers()[index] ?? index + 1;
  }

  /** * Number to display for a step card in the order/copy dialog. * Returns the original number when not renumbering, otherwise the preview number. */
  displayNumber(
    index: number,
    renumberTo: number | null,
    showRenumber: boolean
  ): number {
    return showRenumber
      ? renumberTo ?? this.previewNumber(index)
      : this.currentNumber(index);
  }
  /** * Whether the step card should show the original -> new number mapping. */
  showRenumberMapping(
    index: number,
    renumberTo: number | null,
    showRenumber: boolean
  ): boolean {
    return (
      showRenumber &&
      this.displayNumber(index, renumberTo, showRenumber) !==
        this.currentNumber(index)
    );
  }

  willRenumber(index: number): boolean {
    if (this.isMoveMode()) {
      return (
        this.pendingTarget() !== null &&
        this.previewNumber(index) !== this.currentNumber(index)
      );
    }
    // Copy mode: the source at its original location only renumbers if the copy is inserted before it.
    const p = this.pendingTarget();
    if (!p) return false;
    const to = this.computeToIndex(p);
    return index >= to;
  }

  showBeforeFirst(): boolean {
    if (this.isCopyMode()) return true;
    return this.computeToIndex({ kind: 'before-first' }) !== this.sourceIndex;
  }

  showAfter(index: number): boolean {
    if (this.isCopyMode()) return true;
    return (
      this.computeToIndex({ kind: 'after', afterIndex: index }) !==
      this.sourceIndex
    );
  }

  isSelectedBeforeFirst(): boolean {
    const p = this.pendingTarget();
    return !!p && p.kind === 'before-first';
  }

  isSelectedAfter(index: number): boolean {
    const p = this.pendingTarget();
    return !!p && p.kind === 'after' && p.afterIndex === index;
  }

  toggleBeforeFirst(): void {
    if (this.isSelectedBeforeFirst()) {
      this.pendingTarget.set(null);
      return;
    }
    this.pendingTarget.set({ kind: 'before-first' });
  }

  toggleAfter(index: number): void {
    if (this.isSelectedAfter(index)) {
      this.pendingTarget.set(null);
      return;
    }
    this.pendingTarget.set({ kind: 'after', afterIndex: index });
  }

  clearTarget(): void {
    this.pendingTarget.set(null);
  }

  canConfirm(): boolean {
    return this.pendingTarget() !== null;
  }

  ngAfterViewInit() {
    this.dialogRef.nativeElement.showModal();
  }

  onConfirmClick(): void {
    const p = this.pendingTarget();
    if (!p) return;
    const targetIndex = this.computeToIndex(p);
    if (this.isMoveMode() && targetIndex === this.sourceIndex) return;
    // Keep this dialog open as the modal backdrop; the parent will stack the
    // confirmation dialog on top. The parent destroys this component (closing
    // the dialog) only after the user confirms in the confirmation dialog.
    this.confirmed.emit({ sourceIndex: this.sourceIndex, targetIndex });
  }

  onCancel(): void {
    this.dialogRef.nativeElement.close();
    this.cancelled.emit();
  }

  onDialogCancel(): void {
    this.cancelled.emit();
  }

  computeToIndex(target: OrderMoveTarget): number {
    const from = this.sourceIndex;

    if (target.kind === 'before-first') {
      return 0;
    }

    const afterIndex = target.afterIndex ?? 0;
    if (this.isMoveMode()) {
      if (from === afterIndex) return from;
      if (from < afterIndex) return afterIndex;
      return afterIndex + 1;
    }

    // Copy mode: the target is the position after the selected index.
    return afterIndex + 1;
  }
}
