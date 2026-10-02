import { controlValue } from '../../util/form';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
  private readonly rootControlState = controlValue(() => this.group());


  readonly group = input.required<UntypedFormGroup>();
  readonly fieldName = input('source');

  readonly options = computed(() => ({
    language: 'json',
    automaticLayout: true,
    theme: this.store.darkTheme() ? 'vs-dark' : 'vs',
  }));

  constructor(
    public config: ConfigService,
    private store: Store,
  ) { }

}
