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

  readonly originalModel = signal<DiffEditorModel>({ code: '', language: 'json' });
  readonly modifiedModel = signal<DiffEditorModel>({ code: '', language: 'json' });

  readonly options = signal<any>({
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
      this.options.set({
        ...untracked(() => this.options()),
        theme,
        readOnly,
      })
    });
  }

  ngOnInit() {
    const original = this.original();
    const modified = this.modified();
    const entity = original && (original.hasOwnProperty('url') || original.hasOwnProperty('tag'));
    this.originalModel.set({
      code: (entity ? formatDiff : formatBundleDiff)(original as any),
      language: 'json'
    });
    this.modifiedModel.set({
      code: (entity ? formatDiff : formatBundleDiff)(modified as any),
      language: 'json'
    });
  }

  initEditor(editor: any) {
    editor.onDidUpdateDiff(() => {
      this.modifiedModel.set({
        ...this.modifiedModel(),
        code: editor.getModel().modified.getValue(),
      });
    });
  }

  getModifiedContent(): T | null {
    try {
      return JSON.parse(this.modifiedModel().code);
    } catch (e) {
      // TODO: Show error in editor
      return null;
    }
  }
}
