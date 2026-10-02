import { ChangeDetectionStrategy, Component, effect, input, signal, untracked } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-json',
  templateUrl: './json.component.html',
  styleUrls: ['./json.component.scss'],
  host: { 'class': 'json-editor' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MonacoEditorModule, ResizeHandleDirective]
})
export class JsonComponent {

  readonly groupInput = input.required<UntypedFormGroup>({ alias: 'group' });
  readonly fieldName = input('source');

  private readonly _options = signal<any>({
    language: 'json',
    automaticLayout: true,
  });

  constructor(
    public config: ConfigService,
    private store: Store,
  ) {
    effect(() => {
      const theme = store.darkTheme ? 'vs-dark' : 'vs';
      this.options = {
        ...untracked(() => this.options),
        theme,
      }
    });
  }

  get group(): UntypedFormGroup { return this.groupInput(); }

  get options(): any { return this._options(); }
  set options(value: any) { this._options.set(value); }

}
