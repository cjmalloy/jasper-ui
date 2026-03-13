import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { DiffEditorModel, MonacoEditorModule } from 'ngx-monaco-editor';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { formatValueForDiff } from '../../util/diff';

@Component({
  selector: 'app-diff',
  templateUrl: './diff.component.html',
  styleUrl: './diff.component.scss',
  host: { 'class': 'diff-editor' },
  imports: [MonacoEditorModule, ResizeHandleDirective]
})
export class DiffComponent implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  @Input()
  original: unknown;
  @Input()
  modified: unknown;
  @Input()
  readOnly = false;
  @Output()
  modifiedChange = new EventEmitter<unknown>();

  originalModel: DiffEditorModel = { code: '', language: 'json' };
  modifiedModel: DiffEditorModel = { code: '', language: 'json' };

  options: any = {
    language: 'json',
    automaticLayout: true,
    renderSideBySide: !this.config.mobile,
  };

  constructor(
    public config: ConfigService,
    private store: Store,
  ) {
    this.disposers.push(autorun(() => {
      this.options = {
        ...this.options,
        theme: store.darkTheme ? 'vs-dark' : 'vs',
        readOnly: this.readOnly,
      }
    }));
  }

  ngOnInit() {
    this.originalModel = {
      code: formatValueForDiff(this.original),
      language: 'json'
    };
    this.modifiedModel = {
      code: formatValueForDiff(this.modified),
      language: 'json'
    };
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  initEditor(editor: any) {
    editor.onDidUpdateDiff(() => {
      this.modifiedModel.code = editor.getModel().modified.getValue();
    });
  }

  getModifiedContent(): any | null {
    try {
      return JSON.parse(this.modifiedModel.code);
    } catch (e) {
      // TODO: Show error in editor
      return null;
    }
  }
}
