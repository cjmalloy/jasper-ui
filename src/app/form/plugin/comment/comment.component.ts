import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-form-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss']
})
export class CommentFormComponent implements OnInit {

  @Input()
  plugins!: FormGroup;
  @Input()
  fieldName = 'plugin/comment';

  constructor() {}

  ngOnInit(): void {
  }

  get plugin() {
    return this.plugins.get(this.fieldName) as FormGroup;
  }
}

export function commentPluginForm(fb: FormBuilder) {
  return fb.group({
    deleted: fb.control(false),
  });
}

