import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { AdminService } from '../../../service/admin.service';
import { URI_REGEX } from '../../../util/format';

@Component({
  selector: 'app-form-qr',
  templateUrl: './qr.component.html',
  styleUrls: ['./qr.component.scss']
})
export class QrFormComponent implements OnInit {

  @Input()
  plugins!: UntypedFormGroup;
  @Input()
  fieldName = 'plugin/qr';

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

export function qrPluginForm(fb: UntypedFormBuilder, admin: AdminService) {
  const result = fb.group({
    url: fb.control('', [Validators.pattern(URI_REGEX)]),
  });
  result.patchValue(admin.status.plugins.qr?.defaults);
  return result;
}

