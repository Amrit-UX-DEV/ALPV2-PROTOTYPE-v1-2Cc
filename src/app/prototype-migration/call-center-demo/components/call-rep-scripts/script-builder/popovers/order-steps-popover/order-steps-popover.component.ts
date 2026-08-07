import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScriptStep, ContentBlock } from '../../models/script-builder.models';

export interface OrderMoveTarget {
  kind: 'before-first' | 'after';
  afterIndex?: number;
}

@Component({
  selector: 'alpha-order-steps-popover',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-steps-popover.component.html',
  styleUrls: ['./order-steps-popover.component.css']
})
export class OrderStepsPopoverComponent {

  @Input({ required: true }) steps: ScriptStep[] = [];
  @Input({ required: true }) sourceIndex = 0;

  @Output() confirmed = new EventEmitter<{ fromIndex: number; toIndex: number }>();
  @Output() cancelled = new EventEmitter<void>();

  readonly pendingTarget = signal<OrderMoveTarget | null>(null);

  readonly sourceStepNumber = computed(() => this.sourceIndex + 1);

  /**
   * After a pending move: new 1-based step number for each current index.
   * When nothing selected, equals index + 1.
   */
  readonly previewNumbers = computed(() => {
    const n = this.steps.length;
    const from = this.sourceIndex;
    const p = this.pendingTarget();
    const base = Array.from({ length: n }, (_, i) => i + 1);
    if (!p) return base;

    const to = this.computeToIndex(p);
    if (to === from) return base;

    const order = Array.from({ length: n }, (_, i) => i);
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item);

    const newNums = new Array<number>(n);
    order.forEach((origIdx, newIdx) => {
      newNums[origIdx] = newIdx + 1;
    });
    return newNums;
  });

  /** 1-based number the moved step will become */
  readonly movedBecomesNumber = computed(() => {
    const p = this.pendingTarget();
    if (!p) return null;
    return this.computeToIndex(p) + 1;
  });

  isSource(index: number): boolean {
    return index === this.sourceIndex;
  }

  contentTypes(step: ScriptStep): string[] {
    const content = [...(step.content || [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    return content
      .map((b: ContentBlock) => (b.type || '').toUpperCase())
      .filter(Boolean);
  }

  currentNumber(index: number): number {
    return index + 1;
  }

  previewNumber(index: number): number {
    return this.previewNumbers()[index] ?? index + 1;
  }

  willRenumber(index: number): boolean {
    return this.pendingTarget() !== null && this.previewNumber(index) !== this.currentNumber(index);
  }

  showBeforeFirst(): boolean {
    return this.computeToIndex({ kind: 'before-first' }) !== this.sourceIndex;
  }

  showAfter(index: number): boolean {
    return this.computeToIndex({ kind: 'after', afterIndex: index }) !== this.sourceIndex;
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

  canConfirm(): boolean {
    return this.pendingTarget() !== null;
  }

  onConfirmClick(): void {
    const p = this.pendingTarget();
    if (!p) return;
    const toIndex = this.computeToIndex(p);
    if (toIndex === this.sourceIndex) return;
    this.confirmed.emit({ fromIndex: this.sourceIndex, toIndex });
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  computeToIndex(target: OrderMoveTarget): number {
    const from = this.sourceIndex;

    if (target.kind === 'before-first') {
      return 0;
    }

    const afterIndex = target.afterIndex ?? 0;
    if (from === afterIndex) return from;
    if (from < afterIndex) return afterIndex;
    return afterIndex + 1;
  }
}