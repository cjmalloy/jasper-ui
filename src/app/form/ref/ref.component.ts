import { Component, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import * as _ from 'lodash-es';
import * as moment from 'moment';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { EditorService } from '../../service/editor.service';
import { hasTag } from '../../util/tag';
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

  @Output()
  editorTags = new EventEmitter<string[]>();

  @ViewChild('fill')
  fill?: ElementRef;
  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;
  @ViewChild('sources')
  sources!: LinksFormComponent;
  @ViewChild('alts')
  alts!: LinksFormComponent;
  @ViewChild(PluginsFormComponent)
  plugins!: PluginsFormComponent;

  scraped?: Ref;

  constructor(
    public el: ElementRef,
    private fb: UntypedFormBuilder,
    private admin: AdminService,
    private editor: EditorService,
    private scrape: ScrapeService,
  ) { }

  ngOnInit(): void {
  }

  getTags() {
    return this.group.get('tags')?.value;
  }

  get url() {
    return this.group.get('url') as UntypedFormControl;
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

  get scrape$() {
    if (this.scraped) return of(this.scraped);
    return this.scrape.webScrape(this.url.value).pipe(
      tap(ref => this.scraped = ref),
    );
  }

  scrapeAll() {
    this.scrape$.subscribe(ref => {
      this.group.patchValue({
        ...ref,
        published: ref.published?.format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS),
      });
    });
  }

  scrapeTitle() {
    this.scrape$.subscribe(ref => {
      this.title.setValue(ref.title);
    });
  }

  scrapePublished() {
    this.scrape$.subscribe(ref => {
      this.published.setValue(ref.published?.format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS));
    });
  }

  setRef(ref: Ref) {
    if (hasTag('chat', ref)) {
      this.title.setValidators([]);
    }
    const sourcesForm = this.group.get('sources') as UntypedFormArray;
    const altsForm = this.group.get('alternateUrls') as UntypedFormArray;
    const tagsForm = this.group.get('tags') as UntypedFormArray;
    while (sourcesForm.length > (ref?.sources?.length || 0)) this.sources.removeLink(0);
    while (sourcesForm.length < (ref?.sources?.length || 0)) this.sources.addLink();
    while (altsForm.length > (ref?.alternateUrls?.length || 0)) this.alts.removeLink(0);
    while (altsForm.length < (ref?.alternateUrls?.length || 0)) this.alts.addLink();
    while (tagsForm.length > (ref?.tags?.length || 0)) this.tags.removeTag(0);
    while (tagsForm.length < (ref?.tags?.length || 0)) this.tags.addTag();
    this.group.setControl('plugins', pluginsForm(this.fb, this.admin, ref.tags || []));
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
