import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Origin } from '../../model/origin';
import { ORIGIN_REGEX, URI_REGEX } from '../../util/format';

@Component({
  selector: 'app-origin-form',
  templateUrl: './origin.component.html',
  styleUrls: ['./origin.component.scss']
})
export class OriginFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group!: UntypedFormGroup;

  constructor() { }

  ngOnInit(): void {
  }

  get origin() {
    return this.group.get('origin') as UntypedFormControl;
  }

  get name() {
    return this.group.get('name') as UntypedFormControl;
  }

  get url() {
    return this.group.get('url') as UntypedFormControl;
  }

  get proxy() {
    return this.group.get('proxy') as UntypedFormControl;
  }

  setOrigin(origin: Origin) {
    this.group.patchValue(origin);
  }

}

export function originForm(fb: UntypedFormBuilder) {
  return fb.group({
    origin: ['', [Validators.pattern(ORIGIN_REGEX)]],
    name: [''],
    url: ['', [Validators.required, Validators.pattern(URI_REGEX)]],
    proxy: ['', [Validators.pattern(URI_REGEX)]],
  });
}
