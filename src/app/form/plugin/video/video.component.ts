import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { URI_REGEX } from '../../../util/format';

@Component({
  selector: 'app-form-video',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.scss']
})
export class VideoFormComponent implements OnInit {

  @Input()
  plugins!: FormGroup;
  @Input()
  fieldName = 'plugin/video';

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

export function videoPluginForm(fb: FormBuilder) {
  return fb.group({
    url: fb.control('', [Validators.pattern(URI_REGEX)]),
  });
}

