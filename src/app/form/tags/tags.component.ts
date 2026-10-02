import { Component, ChangeDetectionStrategy, effect, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, UntypedFormArray, UntypedFormGroup, Validators } from '@angular/forms';
import { FormlyForm } from '@ngx-formly/core';
import { defer } from 'lodash-es';
import { TAG_REGEX } from '../../util/format';
import { hasPrefix, hasTag } from '../../util/tag';

@Component({
  selector: 'app-tags',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss'],
  host: { 'class': 'form-group' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormlyForm]
})
export class TagsFormComponent {
  static validators = [Validators.pattern(TAG_REGEX)];

  readonly origin = input<string | undefined>('');
  readonly groupInput = input<UntypedFormGroup | undefined>(undefined, { alias: 'group' });
  readonly fieldName = input('tags');

  field = {
    type: 'tags',
    props: {
      showLabel: true,
      label: $localize`Tags: `,
      showAdd: true,
      addText: $localize`+ Add another tag`,
    },
    fieldArray: {
      focus: false,
      props: {
        label: $localize`🏷️`,
      } as any,
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
      this.field.fieldArray.props.origin = this.origin();
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

  get tags() {
    return this.group?.get(this.fieldName()) as UntypedFormArray;
  }

  get model() {
    return this.tags?.value;
  }

  setTags(values: string[]) {
    if (!this.tags) throw 'Not ready yet!';
    while (this.tags.length > values.length) this.tags.removeAt(this.tags.length - 1, { emitEvent: false });
    while (this.tags.length < values.length) this.tags.push(this.fb.control(''), { emitEvent: false });
    this.tags.setValue(values);
  }

  addTag(...values: string[]) {
    if (!this.tags) throw 'Not ready yet!';
    if (!values.length) return;
    this.field.fieldArray.focus = true;
    for (const value of values) {
      if (value) {
        this.field.fieldArray.focus = false;
        break;
      }
    }
    values = values.filter(t => t === 'placeholder' || !hasTag(t, this.tags.value));
    if (values.length) {
      this.setTags([...this.tags.value, ...values]);
    }
  }

  update() {
    defer(() => this.tags.controls.forEach(control => control.updateValueAndValidity()));
  }

  removeTag(tag: string) {
    if (!this.tags) throw 'Not ready yet!';
    for (let i = this.tags.value.length - 1; i >= 0; i--) {
      if (hasPrefix(this.tags.value[i], tag)) {
        this.tags.removeAt(i);
      }
    }
    this.update();
  }

  removeTagAndChildren(tag: string) {
    if (!this.tags) throw 'Not ready yet!';
    let removed = false;
    for (let i = this.tags.value.length - 1; i >= 0; i--) {
      if (hasPrefix(this.tags.value[i], tag)) {
        this.tags.removeAt(i);
        removed = true;
      }
    }
    if (removed && tag.includes('/')) {
      const parent = tag.substring(0, tag.lastIndexOf('/'));
      if (!hasTag(parent, this.tags.value)) this.addTag(parent);
    }
    if (removed) this.update();
  }
}
