import { Component, HostBinding, Input } from '@angular/core';
import { FormBuilder, UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { FormlyModule } from '@ngx-formly/core';
import { map } from 'lodash-es';
import { URI_REGEX } from '../../util/format';

@Component({
    selector: 'app-links',
    templateUrl: './links.component.html',
    styleUrls: ['./links.component.scss'],
    imports: [FormlyModule]
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
    this.model = values;
    if (!this.links) return;
    while (this.links.length > values.length) this.links.removeAt(this.links.length - 1, { emitEvent: false });
    while (this.links.length < values.length) this.links.push(this.fb.control(''), { emitEvent: false });
    this.links.setValue(values);
  }

  addLink(...values: string[]) {
    if (!values.length) return;
    this.model = this.links!.value;
    this.field.fieldArray.focus = true;
    for (const value of values) {
      if (value) this.field.fieldArray.focus = false;
      if (value && value !== 'placeholder' && this.model.includes(value)) return;
      this.model.push(value);
    }
  }

  removeLink(index: number) {
    if (!this.links) return;
    this.links.removeAt(index);
  }
}

export function linksForm(fb: UntypedFormBuilder, urls: string[]) {
  return fb.array(map(urls, v => fb.control(v, LinksFormComponent.validators)));
}
