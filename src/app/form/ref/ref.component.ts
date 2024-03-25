import { Component, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { defer, uniq, without } from 'lodash-es';
import * as moment from 'moment';
import { catchError, map, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Oembed } from '../../model/oembed';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { BookmarkService } from '../../service/bookmark.service';
import { EditorService } from '../../service/editor.service';
import { OembedStore } from '../../store/oembed';
import { getScheme } from '../../util/hosts';
import { hasMedia } from '../../util/tag';
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
  ref?: Ref;

  private _editorTags: string[] = [];

  constructor(
    private fb: UntypedFormBuilder,
    public admin: AdminService,
    private bookmarks: BookmarkService,
    private editor: EditorService,
    private scrape: ScrapeService,
    private oembeds: OembedStore,
  ) { }

  ngOnInit(): void {
  }

  @ViewChild('fill')
  set setFill(value: ElementRef) {
    this.fill.next(value?.nativeElement);
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

  get editorTags(): string[] {
    return this._editorTags;
  }

  set editorTags(value: string[]) {
    const added = without(value, ...this._editorTags);
    const removed = without(this._editorTags, ...value);
    const newTags = uniq([...without(this.tags!.tags!.value, ...removed), ...added]);
    this.tags!.setTags(newTags);
    this._editorTags = value;
  }

  validate(input: HTMLInputElement) {
    if (this.title.touched) {
      if (this.title.errors?.['required']) {
        input.setCustomValidity($localize`Title must not be blank.`);
        input.reportValidity();
      }
    }
  }

  setComment(value: string) {
    this.comment.setValue(value);
    // Ignore tags and sources from new comment
    this.editor.syncEditor(this.fb, this.group, value);
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.group);
  }

  get scrape$() {
    if (this.scraped) return of(this.scraped);
    return this.scrape.webScrape(this.url.value).pipe(
      tap(ref => {
        this.scraped = ref;
        if (this.scraped.modified) {
          this.ref!.modifiedString = this.scraped.modifiedString;
          this.ref!.modified = this.scraped.modified;
          if (this.scraped.tags?.includes('_plugin/cache')) {
            this.ref!.tags!.push('_plugin/cache')
            this.ref!.plugins ||= {}
            this.ref!.plugins['_plugin/cache'] = this.scraped.plugins!['_plugin/cache'];
          }
          this.setRef(this.ref!);
        }
      }),
    );
  }

  scrapeTitle() {
    if (this.tags.includesTag('+plugin/feed')) return;
    this.scrape$.pipe(
      catchError(err => of({
        url: this.url.value,
        title: undefined,
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
    if (this.oembed) {
      // TODO: oEmbed
    } else {
      this.scrape$.subscribe(ref => {
        if (!hasMedia(ref) || hasMedia(this.group.value)) {
          this.setComment(ref.comment || '');
        }
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
  }

  togglePlugin(tag: string) {
    this.bookmarks.toggleTag(tag);
    if (tag) {
      if (this.tags.includesTag(tag)) {
        this.tags.removeTagAndChildren(tag);
      } else {
        this.tags.addTag(tag);
      }
    }
  }

  setRef(ref: Ref) {
    this.ref = ref;
    this.sources.model = [...ref?.sources || []];
    this.alts.model = [...ref?.alternateUrls || []];
    this.tags.model = [...ref.tags || []];
    this.group.setControl('plugins', pluginsForm(this.fb, this.admin, ref.tags || []));
    this.group.patchValue({
      ...ref,
      published: ref.published ? ref.published.format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : undefined,
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
