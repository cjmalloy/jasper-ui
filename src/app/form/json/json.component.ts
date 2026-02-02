import { ChangeDetectionStrategy, Component, effect, inject, Input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-json',
  templateUrl: './json.component.html',
  styleUrls: ['./json.component.scss'],
  host: { 'class': 'json-editor' },
  imports: [ReactiveFormsModule, MonacoEditorModule, ResizeHandleDirective]
})
export class JsonComponent {
  config = inject(ConfigService);
  private store = inject(Store);


  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'source';

  options: any = {
    language: 'json',
    automaticLayout: true,
  };

  constructor() {
    const store = this.store;

    effect(() => {
      this.options = {
        ...this.options,
        theme: store.darkTheme ? 'vs-dark' : 'vs',
      }
    });
  }
}
