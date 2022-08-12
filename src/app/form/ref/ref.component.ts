import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import * as _ from 'lodash-es';
import * as moment from 'moment';
import { Ref } from '../../model/ref';
import { EditorService } from '../../service/editor.service';
import { LinksFormComponent } from '../links/links.component';
import { pluginsForm, PluginsFormComponent } from '../plugins/plugins.component';
import { TagsFormComponent } from '../tags/tags.component';

@Component({
  selector: 'app-ref-form',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss']
})
export class RefFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group!: UntypedFormGroup;

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;
  @ViewChild('sources')
  sources!: LinksFormComponent;
  @ViewChild('alts')
  alts!: LinksFormComponent;
  @ViewChild(PluginsFormComponent)
  plugins!: PluginsFormComponent;

  constructor(
    private fb: UntypedFormBuilder,
    private editor: EditorService,
  ) { }

  ngOnInit(): void {
  }

  get title() {
    return this.group.get('title') as UntypedFormControl;
  }

  get comment() {
    return this.group.get('comment') as UntypedFormControl;
  }

  get published() {
    return this.group.get('published') as UntypedFormControl;
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.group);
  }

  setRef(ref: Ref) {
    const sourcesForm = this.group.get('sources') as UntypedFormArray;
    const altsForm = this.group.get('alternateUrls') as UntypedFormArray;
    const tagsForm = this.group.get('tags') as UntypedFormArray;
    while (sourcesForm.length > (ref?.sources?.length || 0)) this.sources.removeLink(0);
    while (sourcesForm.length < (ref?.sources?.length || 0)) this.sources.addLink();
    while (altsForm.length > (ref?.alternateUrls?.length || 0)) this.alts.removeLink(0);
    while (altsForm.length < (ref?.alternateUrls?.length || 0)) this.alts.addLink();
    while (tagsForm.length > (ref?.tags?.length || 0)) this.tags.removeTag(0);
    while (tagsForm.length < (ref?.tags?.length || 0)) this.tags.addTag();
    this.group.setControl('plugins', pluginsForm(this.fb, ref.tags || []));
    this.group.patchValue({
      ...ref,
      published: ref.published?.format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS),
    });
    _.defer(() => this.plugins.setValue(ref.plugins));
  }

}

export function refForm(fb: UntypedFormBuilder) {
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
