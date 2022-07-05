import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
  group!: FormGroup;
  @Input()
  fieldName = 'links';
  @Input()
  label = 'link';

  constructor(
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get links() {
    return this.group.get(this.fieldName) as FormArray;
  }

  addLink(value = '') {
    this.links.push(this.fb.control(value, LinksFormComponent.validators));
  }

  removeLink(index: number) {
    this.links.removeAt(index);
  }
}

export function linksForm(fb: FormBuilder, urls: string[]) {
  return fb.array(urls.map(v => fb.control(v, LinksFormComponent.validators)));
}
