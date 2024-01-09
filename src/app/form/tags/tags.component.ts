import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormGroup, Validators } from '@angular/forms';
import { some } from 'lodash-es';
import { AdminService } from '../../service/admin.service';
import { TAG_REGEX } from '../../util/format';
import { includesTag } from '../../util/tag';

@Component({
  selector: 'app-tags',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss']
})
export class TagsFormComponent implements OnInit {
  static validators = [Validators.pattern(TAG_REGEX)];
  @HostBinding('class') css = 'form-group';

  @Input()
  group?: UntypedFormGroup;
  @Input('fieldName')
  fieldName = 'tags';

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
      props: {
        label: $localize`🏷️`,
      }
    },
  };

  constructor(
    private admin: AdminService,
  ) { }

  ngOnInit(): void {
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

  addTag(...values: string[]) {
    if (!this.tags) throw 'Not ready yet!';
    if (!values.length) return;
    this.model = this.tags.value;
    for (const value of values) {
      if (value && value !== 'placeholder' && this.model.includes(value)) return;
      this.model.push(value);
    }
  }

  removeTag(index: number) {
    if (!this.tags) throw 'Not ready yet!';
    this.tags.removeAt(index);
  }

  includesTag(tag: string) {
    return includesTag(tag, this.tags?.value || []);
  }

  get editingViewer() {
    if (!this.tags?.value) return false;
    return some(this.admin.editingViewer, t => includesTag(t.tag, this.tags!.value));
  }

  removeTagOrSuffix(tag: string) {
    if (!this.tags) throw 'Not ready yet!';
    let removed = false;
    const tags = this.tags.value || [];
    for (let i = tags.length - 1; i >= 0; i--) {
      if (tag === tags[i] || tags[i].startsWith(tag + '/')) {
        this.removeTag(i);
        removed = true;
      }
    }
    if (removed && tag.includes('/')) {
      const parent = tag.substring(0, tag.lastIndexOf('/'));
      if (!tags.includes(parent)) this.addTag(parent);
    }
  }
}
