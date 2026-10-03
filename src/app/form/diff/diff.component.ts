import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { isEqual } from 'lodash-es';
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
export class DiffComponent<T extends Ref | Ext | User | Plugin | Template | Mod> {

  readonly original = input.required<T>();
  readonly modified = input.required<T>();
  readonly readOnly = input(false);
  readonly resizable = input(true);
  readonly fullHeight = input(false);
  readonly modifiedChange = output<T>();

  private readonly entity = computed(() => 'url' in this.original() || 'tag' in this.original());
  /**
   * Models and options bound to the Monaco diff editor must stay referentially
   * stable: every new reference makes ngx-monaco-editor rebuild the editor.
   */
  readonly originalModel = computed<DiffEditorModel>(() => ({
    code: (this.entity() ? formatDiff : formatBundleDiff)(this.original() as any),
    language: 'json',
  }), { equal: isEqual });
  readonly modifiedModel = computed<DiffEditorModel>(() => ({
    code: (this.entity() ? formatDiff : formatBundleDiff)(this.modified() as any),
    language: 'json',
  }), { equal: isEqual });

  readonly options = computed(() => ({
    language: 'json',
    automaticLayout: true,
    renderSideBySide: !this.config.mobile,
    theme: this.store.darkTheme() ? 'vs-dark' : 'vs',
    readOnly: this.readOnly(),
  }), { equal: isEqual });

  private editor?: any;

  constructor(
    public config: ConfigService,
    private store: Store,
  ) { }

  initEditor(editor: any) {
    this.editor = editor;
  }

  getModifiedContent(): T | null {
    try {
      return JSON.parse(this.editor?.getModel()?.modified?.getValue() ?? this.modifiedModel().code);
    } catch (e) {
      // TODO: Show error in editor
      return null;
    }
  }
}
