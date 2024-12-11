import { Component, EventEmitter, HostBinding, Input, OnDestroy, Output } from '@angular/core';
import { FormBuilder, UntypedFormArray, UntypedFormGroup, Validators } from '@angular/forms';
import { FormlyFormOptions } from '@ngx-formly/core';
import { FormlyValueChangeEvent } from '@ngx-formly/core/lib/models';
import { some } from 'lodash-es';
import { Subject } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { TAG_REGEX } from '../../util/format';
import { hasTag } from '../../util/tag';

@Component({
  standalone: false,
  selector: 'app-tags',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss']
})
export class TagsFormComponent implements OnDestroy {
  static validators = [Validators.pattern(TAG_REGEX)];
  @HostBinding('class') css = 'form-group';

  @Input()
  group?: UntypedFormGroup;
  @Input()
  fieldName = 'tags';
  @Output()
  syncTags = new EventEmitter<string[]>();

  model: string[] = [];
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
      }
    },
  };

  options: FormlyFormOptions = {
    fieldChanges: new Subject<FormlyValueChangeEvent>(),
  };

  constructor(
    private admin: AdminService,
    private fb: FormBuilder,
  ) {
    this.options.fieldChanges?.subscribe(() => this.syncTags.emit(this.tags!.value))
  }

  ngOnDestroy() {
    this.options.fieldChanges?.complete();
  }

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

  get tags() {
    return this.group?.get(this.fieldName) as UntypedFormArray | undefined;
  }

  setTags(values: string[]) {
    if (!this.tags) throw 'Not ready yet!';
    this.group!.setControl(this.fieldName, this.fb.array(values));
    this.model = [...values];
  }

  addTag(...values: string[]) {
    if (!this.tags) throw 'Not ready yet!';
    if (!values.length) return;
    this.model = this.tags.value;
    this.field.fieldArray.focus = true;
    for (const value of values) {
      if (value) this.field.fieldArray.focus = false;
      if (value && value !== 'placeholder' && this.model.includes(value)) return;
      this.model.push(value);
    }
  }

  hasTag(tag: string) {
    return hasTag(tag, this.tags?.value || []);
  }

  get editingViewer() {
    if (!this.tags?.value) return false;
    return some(this.admin.editingViewer, t => hasTag(t.tag, this.tags!.value));
  }

  removeTag(...values: string[]) {
    if (!this.tags) throw 'Not ready yet!';
    const tags = this.tags.value || [];
    for (let i = tags.length - 1; i >= 0; i--) {
      if (values.includes(tags[i])) this.tags.removeAt(i);
    }
  }

  removeTagAndChildren(tag: string) {
    if (!this.tags) throw 'Not ready yet!';
    let removed = false;
    const tags = this.tags.value || [];
    for (let i = tags.length - 1; i >= 0; i--) {
      if (tag === tags[i] || tags[i].startsWith(tag + '/')) {
        this.tags.removeAt(i);
        removed = true;
      }
    }
    if (removed && tag.includes('/')) {
      const parent = tag.substring(0, tag.lastIndexOf('/'));
      if (!tags.includes(parent)) this.addTag(parent);
    }
  }
}
