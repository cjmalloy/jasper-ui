import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { DiffEditorModel } from 'ngx-monaco-editor';
import { Ref, writeRef } from '../../model/ref';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  standalone: false,
  selector: 'app-diff',
  templateUrl: './diff.component.html',
  styleUrl: './diff.component.scss',
  host: {'class': 'diff-editor'}
})
export class DiffComponent implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  @Input()
  original!: Ref;
  @Input()
  modified!: Ref;
  @Input()
  readOnly = false;
  @Output()
  modifiedChange = new EventEmitter<Ref>();

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
      code: this.formatRefForDiff(this.original),
      language: 'json'
    };
    this.modifiedModel = {
      code: this.formatRefForDiff(this.modified),
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

  /**
   * Format ref for diff display:
   * - Exclude modified and created fields
   * - Fixed order for top-level fields
   * - Alphabetically sorted plugin keys
   */
  private formatRefForDiff(ref: Ref): string {
    const written = writeRef(ref);
    const { modified, created, ...rest } = written as any;

    // Define fixed order for top-level fields
    const ordered: any = {};
    const fieldOrder = ['url', 'origin', 'title', 'comment', 'tags', 'sources', 'alternateUrls', 'published', 'plugins'];

    // Add fields in fixed order
    for (const field of fieldOrder) {
      if (rest[field] !== undefined) {
        if (field === 'plugins' && rest.plugins) {
          // Sort plugin keys alphabetically
          const sortedPlugins: any = {};
          Object.keys(rest.plugins).sort().forEach(key => {
            sortedPlugins[key] = rest.plugins[key];
          });
          ordered.plugins = sortedPlugins;
        } else {
          ordered[field] = rest[field];
        }
      }
    }

    // Add any remaining fields not in the fixed order
    for (const key in rest) {
      if (!fieldOrder.includes(key)) {
        ordered[key] = rest[key];
      }
    }

    return JSON.stringify(ordered, null, 2);
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
