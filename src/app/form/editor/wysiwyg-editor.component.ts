import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import type { Editor } from '@toast-ui/editor';
import { autorun, IReactionDisposer } from 'mobx';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { FillWidthDirective } from '../../directive/fill-width.directive';
import { Store } from '../../store/store';

export interface FileDropEvent {
  event: Event;
  items?: DataTransferItemList;
}

@Component({
  selector: 'app-wysiwyg-editor',
  templateUrl: './wysiwyg-editor.component.html',
  styleUrls: ['./wysiwyg-editor.component.scss'],
  host: { 'class': 'wysiwyg-editor' },
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, FillWidthDirective],
})
export class WysiwygEditorComponent implements AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private disposers: IReactionDisposer[] = [];
  private editorInstance?: Editor;
  private valueChanges?: Subscription;

  @Input() control!: UntypedFormControl;
  @Input() initialValue = '';
  @Input() fillWidth?: HTMLElement;
  @Input() padding = 0;
  @Input() autoFocus = false;
  @Input() id = '';

  @Output() focusIn = new EventEmitter<void>();
  @Output() textFocus = new EventEmitter<void>();
  @Output() textBlur = new EventEmitter<string>();
  @Output() fileDrop = new EventEmitter<FileDropEvent>();

  dropping = false;

  @ViewChild('wysiwygContainer')
  private wysiwygContainer?: ElementRef<HTMLDivElement>;

  constructor(private store: Store) {}

  ngAfterViewInit() {
    const container = this.wysiwygContainer;
    if (!container) return;
    void import('@toast-ui/editor').then(m => {
      if (this.wysiwygContainer !== container || this.editorInstance) return;
      const EditorClass = (m as any).default ?? (m as any).Editor;
      const editor: Editor = new EditorClass({
        el: container.nativeElement,
        height: '200px',
        initialEditType: 'wysiwyg',
        initialValue: this.initialValue,
        previewStyle: 'vertical',
        theme: this.store.darkTheme ? 'dark' : 'light',
        usageStatistics: false,
      });
      editor.on('change', () => {
        const markdown = editor.getMarkdown();
        this.control.setValue(markdown);
      });
      editor.on('focus', () => {
        this.focusIn.emit();
        this.textFocus.emit();
      });
      editor.on('blur', () => {
        this.textBlur.emit(editor.getMarkdown());
      });
      this.valueChanges = this.control.valueChanges.pipe(
        takeUntil(this.destroy$),
      ).subscribe(value => {
        value ||= '';
        if (editor.getMarkdown() !== value) editor.setMarkdown(value);
      });
      this.editorInstance = editor;
      if (this.autoFocus) editor.focus();
      this.disposers.push(autorun(() => {
        container.nativeElement.firstElementChild?.classList.toggle('toastui-editor-dark', this.store.darkTheme);
      }));
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.valueChanges?.unsubscribe();
    this.editorInstance?.destroy();
  }

  dragLeave(parent: HTMLElement, target: HTMLElement) {
    if (this.dropping && parent === target || !parent.contains(target)) {
      this.dropping = false;
    }
  }

  onDrop(event: Event, items?: DataTransferItemList) {
    this.dropping = false;
    this.fileDrop.emit({ event, items });
  }
}
