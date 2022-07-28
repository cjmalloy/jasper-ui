import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
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
  group!: FormGroup;

  constructor() { }

  ngOnInit(): void {
  }

  get origin() {
    return this.group.get('origin') as FormControl;
  }

  get name() {
    return this.group.get('name') as FormControl;
  }

  get url() {
    return this.group.get('url') as FormControl;
  }

  get proxy() {
    return this.group.get('proxy') as FormControl;
  }

  setOrigin(origin: Origin) {
    this.group.patchValue(origin);
  }

}

export function originForm(fb: FormBuilder) {
  return fb.group({
    origin: ['', [Validators.pattern(ORIGIN_REGEX)]],
    name: [''],
    url: ['', [Validators.required, Validators.pattern(URI_REGEX)]],
    proxy: ['', [Validators.pattern(URI_REGEX)]],
  });
}
