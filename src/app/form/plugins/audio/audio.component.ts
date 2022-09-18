import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { AdminService } from '../../../service/admin.service';
import { URI_REGEX } from '../../../util/format';

@Component({
  selector: 'app-form-audio',
  templateUrl: './audio.component.html',
  styleUrls: ['./audio.component.scss']
})
export class AudioFormComponent implements OnInit {

  @Input()
  plugins!: UntypedFormGroup;
  @Input()
  fieldName = 'plugin/audio';

  constructor() {}

  ngOnInit(): void {
  }

  get plugin() {
    return this.plugins.get(this.fieldName) as UntypedFormGroup;
  }

  get url() {
    return this.plugin.get('url') as UntypedFormControl;
  }
}

export function audioPluginForm(fb: UntypedFormBuilder, admin: AdminService) {
  const result = fb.group({
    url: fb.control('', [Validators.pattern(URI_REGEX)]),
  });
  result.patchValue(admin.status.plugins.audio?.defaults);
  return result;
}

