import { Component, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { defer } from 'lodash-es';
import * as moment from 'moment';
import { catchError, map, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Oembed } from '../../model/oembed';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { EditorService } from '../../service/editor.service';
import { OembedStore } from '../../store/oembed';
import { Store } from '../../store/store';
import { getScheme } from '../../util/hosts';
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
  @Output()
  fill = new EventEmitter<HTMLDivElement>();

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;
  @ViewChild('sources')
  sources!: LinksFormComponent;
  @ViewChild('alts')
  alts!: LinksFormComponent;
  @ViewChild(PluginsFormComponent)
  plugins!: PluginsFormComponent;

  oembed?: Oembed;
  scraped?: Ref;

  constructor(
    private fb: UntypedFormBuilder,
    private admin: AdminService,
    private editor: EditorService,
    private scrape: ScrapeService,
    private store: Store,
    private oembeds: OembedStore,
  ) { }

  ngOnInit(): void {
  }

  getTags() {
    return this.group.get('tags')?.value;
  }

  @ViewChild('fill')
  set setFill(value: ElementRef) {
    this.fill.next(value.nativeElement);
  }

  get web() {
    const scheme = getScheme(this.url.value);
    return scheme === 'http:' || scheme === 'https:';
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

  scrapeTitle() {
    if (this.tags.includesTag('+plugin/feed')) return;
    this.scrape$.pipe(
      catchError(err => of({
        url: this.url.value,
        title: '' ,
      })),
      switchMap(ref => this.oembeds.get(ref.url).pipe(
        map(oembed => {
          this.oembed = oembed!;
          if (oembed) ref.title ||= oembed.title;
          return ref;
        }),
        catchError(err => of(ref)),
      )),
    ).subscribe((ref: Ref) => {
      this.group.patchValue({ title: ref.title });
    });
  }

  scrapePublished() {
    this.scrape$.subscribe(ref => {
      this.published.setValue(ref.published?.format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS));
    });
  }

  scrapeComment() {
    this.scrape$.subscribe(ref => {
      this.comment.setValue(ref.comment);
      this.tags.addTag(...(ref.tags || []));
      this.plugins.tags = this.group.value.tags;
      defer(() => {
        this.plugins.setValue({
          ...(this.group.value.plugins || {}),
          ...(ref.plugins || {}),
        });
      });
    });
  }

  togglePlugin(tag: string) {
    if (tag) {
      if (this.tags.includesTag(tag)) {
        this.tags.removeTagOrSuffix(tag);
      } else {
        this.tags.addTag(tag);
      }
    }
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
    this.group.setControl('plugins', pluginsForm(this.fb, this.admin, ref.tags || []));
    this.group.patchValue({
      ...ref,
      published: ref.published?.format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS),
    });
    defer(() => this.plugins.setValue(ref.plugins));
  }
}

export function refForm(fb: UntypedFormBuilder) {
  return fb.group({
    url: { value: '',  disabled: true },
    published: [''],
    title: [''],
    comment: [''],
    sources: fb.array([]),
    alternateUrls: fb.array([]),
    tags: fb.array([]),
    plugins: fb.group({})
  });
}
