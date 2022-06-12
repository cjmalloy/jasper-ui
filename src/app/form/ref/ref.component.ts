import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import * as moment from 'moment';
import { Ref } from '../../model/ref';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { AltsComponent } from '../alts/alts.component';
import { pluginsForm } from '../plugins/plugins.component';
import { SourcesComponent } from '../sources/sources.component';
import { TagsComponent } from '../tags/tags.component';

@Component({
  selector: 'app-ref-form',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss']
})
export class RefFormComponent implements OnInit {
  static base = '/';

  @Input()
  group!: FormGroup;

  @ViewChild(TagsComponent)
  tags!: TagsComponent;
  @ViewChild(SourcesComponent)
  sources!: SourcesComponent;
  @ViewChild(AltsComponent)
  alts!: AltsComponent;

  constructor(
    private fb: FormBuilder,
    private config: ConfigService,
    private editor: EditorService,
  ) {
    RefFormComponent.base = config.base;
  }

  ngOnInit(): void {
  }

  get title() {
    return this.group.get('title') as FormControl;
  }

  get comment() {
    return this.group.get('comment') as FormControl;
  }

  get published() {
    return this.group.get('published') as FormControl;
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.group);
  }

  setRef(ref: Ref) {
    const sourcesForm = this.group.get('sources') as FormArray;
    const altsForm = this.group.get('alternateUrls') as FormArray;
    const tagsForm = this.group.get('tags') as FormArray;
    while (sourcesForm.length < (ref?.sources?.length || 0)) this.sources.addSource();
    while (altsForm.length < (ref?.alternateUrls?.length || 0)) this.alts.addAlt();
    while (tagsForm.length < (ref?.tags?.length || 0)) this.tags.addTag();
    this.group.setControl('plugins', pluginsForm(this.fb, ref.tags || []));
    this.group.patchValue({
      ...ref,
      published: ref.published?.format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS),
    });
  }


}

export function refForm(fb: FormBuilder) {
  return fb.group({
    url: [''],
    published: [moment().format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS), [Validators.required]],
    title: ['', [Validators.required]],
    comment: [''],
    sources: fb.array([]),
    alternateUrls: fb.array([]),
    tags: fb.array([]),
    plugins: fb.group({})
  });
}
