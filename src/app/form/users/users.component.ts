import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { map } from 'lodash-es';
import { USER_REGEX } from '../../util/format';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersFormComponent implements OnInit {
  static validators = [Validators.required, Validators.pattern(USER_REGEX)];
  @HostBinding('class') css = 'form-group';

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'users';
  @Input()
  label = $localize`user`;

  constructor(
    private fb: UntypedFormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get users() {
    return this.group.get(this.fieldName) as UntypedFormArray;
  }

  addUser(value = '') {
    if (value && this.users.value.includes(value)) return;
    this.users.push(this.fb.control(value, UsersFormComponent.validators));
  }

  removeUser(index: number) {
    this.users.removeAt(index);
  }
}

export function usersForm(fb: UntypedFormBuilder, tags: string[]) {
  return fb.array(map(tags, v => fb.control(v, UsersFormComponent.validators)));
}
