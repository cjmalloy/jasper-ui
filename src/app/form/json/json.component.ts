import { Component, Input, OnDestroy } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { autorun, IReactionDisposer } from 'mobx';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-json',
  templateUrl: './json.component.html',
  styleUrls: ['./json.component.scss'],
  host: { 'class': 'json-editor' },
  imports: [ReactiveFormsModule, MonacoEditorModule, ResizeHandleDirective]
})
export class JsonComponent implements OnDestroy {

  private disposers: IReactionDisposer[] = [];

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'source';

  options: any = {
    language: 'json',
    automaticLayout: true,
  };

  constructor(
    public config: ConfigService,
    private store: Store,
  ) {
    this.disposers.push(autorun(() => {
      this.options = {
        ...this.options,
        theme: store.darkTheme ? 'vs-dark' : 'vs',
      }
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
