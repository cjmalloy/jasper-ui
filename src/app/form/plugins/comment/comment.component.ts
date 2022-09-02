import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';

@Component({
  selector: 'app-form-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss']
})
export class CommentFormComponent implements OnInit {

  @Input()
  plugins!: UntypedFormGroup;
  @Input()
  fieldName = 'plugin/comment';

  constructor() {}

  ngOnInit(): void {
  }

  get plugin() {
    return this.plugins.get(this.fieldName) as UntypedFormGroup;
  }
}

export function commentPluginForm(fb: UntypedFormBuilder) {
  return fb.group({
    deleted: fb.control(false),
  });
}

