import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { URI_REGEX } from '../../../util/format';

@Component({
  selector: 'app-form-qr',
  templateUrl: './qr.component.html',
  styleUrls: ['./qr.component.scss']
})
export class QrFormComponent implements OnInit {

  @Input()
  plugins!: FormGroup;
  @Input()
  fieldName = 'plugin/qr';

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

export function qrPluginForm(fb: FormBuilder) {
  return fb.group({
    url: fb.control('', [Validators.pattern(URI_REGEX)]),
  });
}

