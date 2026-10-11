import { Component, computed, inject, input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { isEqual } from 'lodash-es';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { controlValue } from '../../util/form';

@Component({
  selector: 'app-json',
  templateUrl: './json.component.html',
  styleUrls: ['./json.component.scss'],
  host: { 'class': 'json-editor' },
  imports: [ReactiveFormsModule, MonacoEditorModule, ResizeHandleDirective]
})
export class JsonComponent {
  config = inject(ConfigService);
  private store = inject(Store);

  private readonly rootControlState = controlValue(() => this.group());


  readonly group = input.required<UntypedFormGroup>();
  readonly fieldName = input('source');

  readonly options = computed(() => ({
    language: 'json',
    automaticLayout: true,
    theme: this.store.darkTheme() ? 'vs-dark' : 'vs',
  }), { equal: isEqual });

}
