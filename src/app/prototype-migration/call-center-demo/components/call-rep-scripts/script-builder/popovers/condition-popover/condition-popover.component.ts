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
import { ContentBlock, ContentCondition, RequiredCheckItem } from '../../models/script-builder.models';

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
  readonly selectedCheckQuestion = signal<string | null>(null);
  readonly selectedAnswer = signal<string | null>(null);
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

  readonly currentCheck = computed(() => {
    const source = this.currentSource();
    const question = this.selectedCheckQuestion();
    if (!source?.requiredChecks || !question) return null;
    return source.requiredChecks.find(c => c.question === question) || null;
  });

  readonly checkQuestions = computed(() => {
    const source = this.currentSource();
    if (source?.type !== 'required-check' || !source.requiredChecks) return [];
    return source.requiredChecks.filter(c => c.question).map(c => c.question as string);
  });

  readonly answerOptions = computed(() => {
    const check = this.currentCheck();
    if (!check) return [];
    if (check.options?.length) return check.options.map(o => o.text);
    if (check.answer) return [check.answer];
    return [];
  });

  readonly isCheckSource = computed(() => this.currentSource()?.type === 'required-check');
  readonly isQuestionSource = computed(() => this.currentSource()?.type === 'question');

  selectSource(id: string) {
    this.selectedSourceId.set(id);
    this.selectedCheckQuestion.set(null);
    this.selectedAnswer.set(null);
    this.selectedAnswers.set(new Set());
    this.step.set(2);
  }

  selectCheckQuestion(question: string) {
    this.selectedCheckQuestion.set(question);
    this.selectedAnswer.set(null);
  }

  selectAnswer(answer: string) {
    this.selectedAnswer.set(answer);
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
    this.prepopulateCondition();
    this.dialogRef.nativeElement.showModal();
  }

  private prepopulateCondition() {
    const targetId = this.targetId();
    if (!targetId) return;
    const existing = this.contentList.find(c => c.id === targetId)?.condition;
    if (!existing) return;

    this.selectedSourceId.set(existing.dependsOn);
    this.step.set(2);

    if (existing.checkQuestion) {
      this.selectedCheckQuestion.set(existing.checkQuestion);
    }
    if (existing.answer) {
      this.selectedAnswer.set(existing.answer);
    }
    if (existing.answers?.length) {
      this.selectedAnswers.set(new Set(existing.answers));
    }
  }

  save() {
    const sourceId = this.selectedSourceId();
    if (!sourceId) return;

    const source = this.currentSource();
    let condition: ContentCondition = { dependsOn: sourceId };

    if (source?.type === 'required-check') {
      const question = this.selectedCheckQuestion();
      const answer = this.selectedAnswer();
      if (question && answer) {
        condition = { dependsOn: sourceId, checkQuestion: question, answer };
      }
    } else {
      const answers = Array.from(this.selectedAnswers());
      if (answers.length) {
        condition = { dependsOn: sourceId, answers };
      }
    }

    this.dialogRef.nativeElement.close();
    this.saved.emit(condition);
  }

  close() {
    this.dialogRef.nativeElement.close();
    this.closed.emit();
  }

  onDialogCancel() {
    this.closed.emit();
  }

  back() {
    if (this.isCheckSource() && this.selectedCheckQuestion()) {
      this.selectedCheckQuestion.set(null);
      this.selectedAnswer.set(null);
      return;
    }
    this.step.set(1);
  }
}