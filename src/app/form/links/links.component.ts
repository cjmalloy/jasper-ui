import { Component, HostBinding, Input } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { FormlyForm } from '@ngx-formly/core';
import { map } from 'lodash-es';
import { URI_REGEX } from '../../util/format';

@Component({
  selector: 'app-links',
  templateUrl: './links.component.html',
  styleUrls: ['./links.component.scss'],
  imports: [ReactiveFormsModule, FormlyForm]
})
export class LinksFormComponent {
  static validators = [Validators.pattern(URI_REGEX)];
  @HostBinding('class') css = 'form-group';

  @Input()
  group?: UntypedFormGroup;
  @Input()
  fieldName = 'links';

  model: string[] = [];
  field = {
    type: 'refs',
    props: {
      showLabel: true,
      label: $localize`Sources: `,
      showAdd: true,
      addText: $localize`+ Add another source`,
    },
    fieldArray: {
      focus: false,
      props: {
        label: $localize`🔗️`,
      }
    },
  };

  constructor(
    private fb: FormBuilder,
  ) { }

  @Input()
  set emoji(value: string) {
    this.field.fieldArray.props.label = value;
  }

  @Input()
  set label(value: string) {
    this.field.props.label = value;
  }

  @Input()
  set showLabel(value: boolean) {
    this.field.props.showLabel = value;
  }

  @Input()
  set add(value: string) {
    this.field.props.addText = value;
  }

  @Input()
  set showAdd(value: boolean) {
    this.field.props.showAdd = value;
  }

  get links() {
    return this.group?.get(this.fieldName) as UntypedFormArray | undefined;
  }

  setLinks(values: string[]) {
    const next = [...values];
    this.model = next;
    if (!this.links) return;
    while (this.links.length > next.length) this.links.removeAt(this.links.length - 1, { emitEvent: false });
    while (this.links.length < next.length) this.links.push(this.fb.control(''), { emitEvent: false });
    this.links.setValue(next);
  }

  addLink(...values: string[]) {
    if (!values.length) return;
    const current = [...(this.links?.value || this.model)];
    this.field.fieldArray.focus = true;
    for (const value of values) {
      if (value) this.field.fieldArray.focus = false;
      if (value && value !== 'placeholder' && current.includes(value)) return;
      current.push(value);
    }
    this.setLinks(current);
  }

  removeLink(index: number) {
    if (!this.links) return;
    this.links.removeAt(index);
  }
}

export function linksForm(fb: UntypedFormBuilder, urls: string[]) {
  return fb.array(map(urls, v => fb.control(v, LinksFormComponent.validators)));
}
