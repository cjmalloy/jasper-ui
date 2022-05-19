import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { URI_REGEX } from '../../../util/format';

@Component({
  selector: 'app-form-embed',
  templateUrl: './embed.component.html',
  styleUrls: ['./embed.component.scss']
})
export class EmbedFormComponent implements OnInit {

  @Input()
  plugins!: FormGroup;
  @Input()
  fieldName = 'plugin/embed';

  constructor() {}

  ngOnInit(): void {
  }

  get plugin() {
    return this.plugins.get(this.fieldName) as FormGroup;
  }

  get url() {
    return this.plugin.get('url') as FormControl;
  }
}

export function embedPluginForm(fb: FormBuilder) {
  return fb.group({
    url: fb.control('', [Validators.pattern(URI_REGEX)]),
  });
}

