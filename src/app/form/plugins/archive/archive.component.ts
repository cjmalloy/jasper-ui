import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { AdminService } from '../../../service/admin.service';
import { URI_REGEX } from '../../../util/format';

@Component({
  selector: 'app-form-archive',
  templateUrl: './archive.component.html',
  styleUrls: ['./archive.component.scss']
})
export class ArchiveFormComponent implements OnInit {

  @Input()
  plugins!: UntypedFormGroup;
  @Input()
  fieldName = 'plugin/archive';

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

export function archivePluginForm(fb: UntypedFormBuilder, admin: AdminService) {
  const result = fb.group({
    url: fb.control('', [Validators.pattern(URI_REGEX)]),
  });
  result.patchValue(admin.status.plugins.archive?.defaults);
  return result;
}

