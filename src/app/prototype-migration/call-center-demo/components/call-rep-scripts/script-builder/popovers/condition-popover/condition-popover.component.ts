import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentBlock, ContentCondition } from '../../models/script-builder.models';

@Component({
  selector: 'alpha-condition-popover',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './condition-popover.component.html'
})
export class ConditionPopoverComponent implements AfterViewInit {
  @ViewChild('dialogRef') dialogRef!: ElementRef<HTMLDialogElement>;

  @Input() contentList: ContentBlock[] = [];
  @Input() targetId: string | null = null;

  @Output() saved = new EventEmitter<ContentCondition | null>();
  @Output() closed = new EventEmitter<void>();

  readonly step = signal<1 | 2>(1);
  readonly selectedSourceId = signal<string | null>(null);
  readonly selectedAnswers = signal<Set<string>>(new Set());

  readonly possibleSources = computed(() =>
    this.contentList.filter(c =>
      (c.type === 'question' || c.type === 'required-check') &&
      c.id !== this.targetId
    )
  );

  readonly currentSource = computed(() => {
    const id = this.selectedSourceId();
    return this.contentList.find(c => c.id === id) || null;
  });

  selectSource(id: string) {
    this.selectedSourceId.set(id);
    this.selectedAnswers.set(new Set());
    this.step.set(2);
  }

  toggleAnswer(answer: string) {
    this.selectedAnswers.update(set => {
      const next = new Set(set);
      if (next.has(answer)) next.delete(answer);
      else next.add(answer);
      return next;
    });
  }

  isAnswerSelected(answer: string): boolean {
    return this.selectedAnswers().has(answer);
  }

  selectAll() {
    const src = this.currentSource();
    if (!src?.options) return;
    this.selectedAnswers.set(new Set(src.options.map(o => o.text)));
  }

  clearAll() {
    this.selectedAnswers.set(new Set());
  }

  ngAfterViewInit() {
    this.dialogRef.nativeElement.showModal();
  }

  save() {
    const sourceId = this.selectedSourceId();
    if (!sourceId) return;

    const answers = Array.from(this.selectedAnswers());
    this.dialogRef.nativeElement.close();
    this.saved.emit({
      dependsOn: sourceId,
      answers: answers.length ? answers : undefined
    });
  }

  close() {
    this.dialogRef.nativeElement.close();
    this.closed.emit();
  }

  onDialogCancel() {
    this.closed.emit();
  }

  back() {
    this.step.set(1);
  }
}