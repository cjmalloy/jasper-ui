import { ChangeDetectionStrategy, Component, effect, input, OnInit, output, signal, untracked } from '@angular/core';
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

  readonly original = input.required<T>();
  readonly modified = input.required<T>();
  readonly readOnly = input(false);
  readonly resizable = input(true);
  readonly fullHeight = input(false);
  readonly modifiedChange = output<T>();

  private readonly _originalModel = signal<DiffEditorModel>({ code: '', language: 'json' });
  private readonly _modifiedModel = signal<DiffEditorModel>({ code: '', language: 'json' });

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
  get originalModel() { return this._originalModel(); }
  set originalModel(value: DiffEditorModel) { this._originalModel.set(value); }
  get modifiedModel() { return this._modifiedModel(); }
  set modifiedModel(value: DiffEditorModel) { this._modifiedModel.set(value); }

  ngOnInit() {
    const original = this.original();
    const modified = this.modified();
    const entity = original && (original.hasOwnProperty('url') || original.hasOwnProperty('tag'));
    this.originalModel = {
      code: (entity ? formatDiff : formatBundleDiff)(original as any),
      language: 'json'
    };
    this.modifiedModel = {
      code: (entity ? formatDiff : formatBundleDiff)(modified as any),
      language: 'json'
    };
  }

  initEditor(editor: any) {
    editor.onDidUpdateDiff(() => {
      this.modifiedModel = {
        ...this.modifiedModel,
        code: editor.getModel().modified.getValue(),
      };
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
