import { Component, ChangeDetectionStrategy, effect, input } from '@angular/core';
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
  host: { 'class': 'form-group' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormlyForm]
})
export class LinksFormComponent {
  static validators = [Validators.pattern(URI_REGEX)];

  readonly groupInput = input<UntypedFormGroup | undefined>(undefined, { alias: 'group' });
  readonly fieldName = input('links');

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

  readonly emoji = input<string | undefined>(undefined);
  readonly label = input<string | undefined>(undefined);
  readonly showLabel = input<boolean | undefined>(undefined);
  readonly add = input<string | undefined>(undefined);
  readonly showAdd = input<boolean | undefined>(undefined);

  constructor(
    private fb: FormBuilder,
  ) {
    effect(() => {
      const emoji = this.emoji();
      if (emoji !== undefined) this.field.fieldArray.props.label = emoji;
      const label = this.label();
      if (label !== undefined) this.field.props.label = label;
      const showLabel = this.showLabel();
      if (showLabel !== undefined) this.field.props.showLabel = showLabel;
      const add = this.add();
      if (add !== undefined) this.field.props.addText = add;
      const showAdd = this.showAdd();
      if (showAdd !== undefined) this.field.props.showAdd = showAdd;
    });
  }

  get group() {
    return this.groupInput();
  }

  get links() {
    return this.group?.get(this.fieldName()) as UntypedFormArray | undefined;
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
