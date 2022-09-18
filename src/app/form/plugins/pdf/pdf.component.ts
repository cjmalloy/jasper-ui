import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { AdminService } from '../../../service/admin.service';
import { URI_REGEX } from '../../../util/format';

@Component({
  selector: 'app-form-pdf',
  templateUrl: './pdf.component.html',
  styleUrls: ['./pdf.component.scss']
})
export class PdfFormComponent implements OnInit {

  @Input()
  plugins!: UntypedFormGroup;
  @Input()
  fieldName = 'plugin/pdf';

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

export function pdfPluginForm(fb: UntypedFormBuilder, admin: AdminService) {
  const result = fb.group({
    url: fb.control('', [Validators.pattern(URI_REGEX)]),
  });
  result.patchValue(admin.status.plugins.pdf?.defaults);
  return result;
}
