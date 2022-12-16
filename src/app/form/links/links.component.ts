import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import * as _ from 'lodash-es';
import { URI_REGEX } from '../../util/format';

@Component({
  selector: 'app-links',
  templateUrl: './links.component.html',
  styleUrls: ['./links.component.scss']
})
export class LinksFormComponent implements OnInit {
  static validators = [Validators.required, Validators.pattern(URI_REGEX)];
  @HostBinding('class') css = 'form-group';

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'links';
  @Input()
  label = 'link';
  @Input()
  alt = false;

  constructor(
    private fb: UntypedFormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get links() {
    return this.group.get(this.fieldName) as UntypedFormArray;
  }

  addLink(value = '') {
    if (value && this.links.value.includes(value)) return;
    this.links.push(this.fb.control(value, LinksFormComponent.validators));
  }

  removeLink(index: number) {
    this.links.removeAt(index);
  }
}

export function linksForm(fb: UntypedFormBuilder, urls: string[]) {
  return fb.array(_.map(urls, v => fb.control(v, LinksFormComponent.validators)));
}
