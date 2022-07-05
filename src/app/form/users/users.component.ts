import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
  group!: FormGroup;
  @Input()
  fieldName = 'users';
  @Input()
  label = 'user';

  constructor(
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get users() {
    return this.group.get(this.fieldName) as FormArray;
  }

  addUser(value = '') {
    this.users.push(this.fb.control(value, UsersFormComponent.validators));
  }

  removeUser(index: number) {
    this.users.removeAt(index);
  }
}

export function usersForm(fb: FormBuilder, tags: string[]) {
  return fb.array(tags.map(v => fb.control(v, UsersFormComponent.validators)));
}
