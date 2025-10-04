import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { Ref, writeRef } from '../../model/ref';
import { Store } from '../../store/store';
import { DiffEditorModel } from 'ngx-monaco-editor';

@Component({
  standalone: false,
  selector: 'app-diff-editor',
  templateUrl: './diff-editor.component.html',
  styleUrl: './diff-editor.component.scss'
})
export class DiffEditorComponent implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  @Input()
  original!: Ref;
  @Input()
  modified!: Ref;

  originalModel: DiffEditorModel = { code: '', language: 'json' };
  modifiedModel: DiffEditorModel = { code: '', language: 'json' };

  diffOptions: any = {
    theme: 'vs',
    readOnly: true,
    automaticLayout: true,
    renderSideBySide: true,
  };

  constructor(
    private store: Store,
  ) {}

  ngOnInit() {
    this.originalModel = {
      code: JSON.stringify(writeRef(this.original), null, 2),
      language: 'json'
    };
    this.modifiedModel = {
      code: JSON.stringify(writeRef(this.modified), null, 2),
      language: 'json'
    };

    this.disposers.push(autorun(() => {
      this.diffOptions = {
        ...this.diffOptions,
        theme: this.store.darkTheme ? 'vs-dark' : 'vs',
      };
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
