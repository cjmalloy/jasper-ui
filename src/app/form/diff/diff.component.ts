import { ChangeDetectionStrategy, Component, effect, Input, input, OnInit, output, signal, untracked } from '@angular/core';
import { DiffEditorModel, MonacoEditorModule } from 'ngx-monaco-editor';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { formatBundleDiff, formatDiff } from '../../util/diff';
import { Ref } from '../../model/ref';
import { Ext } from '../../model/ext';
import { User } from '../../model/user';
import { Plugin } from '../../model/plugin';
import { Template } from '../../model/template';
import { Mod } from '../../model/tag';

@Component({
  selector: 'app-diff',
  templateUrl: './diff.component.html',
  styleUrl: './diff.component.scss',
  host: { 'class': 'diff-editor' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MonacoEditorModule, ResizeHandleDirective]
})
export class DiffComponent<T extends Ref | Ext | User | Plugin | Template | Mod> implements OnInit {

  @Input()
  original!: T;
  @Input()
  modified!: T;
  readonly readOnly = input(false);
  @Input()
  resizable = true;
  readonly fullHeight = input(false);
  readonly modifiedChange = output<T>();

  originalModel: DiffEditorModel = { code: '', language: 'json' };
  modifiedModel: DiffEditorModel = { code: '', language: 'json' };

  private readonly _options = signal<any>({
    language: 'json',
    automaticLayout: true,
    renderSideBySide: !this.config.mobile,
  });

  constructor(
    public config: ConfigService,
    private store: Store,
  ) {
    effect(() => {
      const theme = store.darkTheme ? 'vs-dark' : 'vs';
      const readOnly = this.readOnly();
      this.options = {
        ...untracked(() => this.options),
        theme,
        readOnly,
      }
    });
  }

  get options(): any { return this._options(); }
  set options(value: any) { this._options.set(value); }

  ngOnInit() {
    const entity = this.original && (this.original.hasOwnProperty('url') || this.original.hasOwnProperty('tag'));
    this.originalModel = {
      code: (entity ? formatDiff : formatBundleDiff)(this.original as any),
      language: 'json'
    };
    this.modifiedModel = {
      code: (entity ? formatDiff : formatBundleDiff)(this.modified as any),
      language: 'json'
    };
  }

  initEditor(editor: any) {
    editor.onDidUpdateDiff(() => {
      this.modifiedModel.code = editor.getModel().modified.getValue();
    });
  }

  getModifiedContent(): T | null {
    try {
      return JSON.parse(this.modifiedModel.code);
    } catch (e) {
      // TODO: Show error in editor
      return null;
    }
  }
}
