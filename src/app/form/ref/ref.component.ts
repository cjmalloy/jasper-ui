import {
  ChangeDetectionStrategy, Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { defer } from 'lodash-es';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { Oembed } from '../../model/oembed';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { EditorService } from '../../service/editor.service';
import { OembedStore } from '../../store/oembed';
import { Store } from '../../store/store';
import { getScheme } from '../../util/http';
import { hasMedia, hasTag } from '../../util/tag';
import { LinksFormComponent } from '../links/links.component';
import { PluginsFormComponent } from '../plugins/plugins.component';
import { TagsFormComponent } from '../tags/tags.component';

@Component({
  standalone: false,
  selector: 'app-ref-form',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
  host: {'class': 'nested-form'}
})
export class RefFormComponent {

  @Input()
  origin? = '';
  @Input()
  group!: UntypedFormGroup;
  @Output()
  toggleTag = new EventEmitter<string>();

  @ViewChild(TagsFormComponent)
  tagsFormComponent!: TagsFormComponent;
  @ViewChild('sources')
  sourcesFormComponent!: LinksFormComponent;
  @ViewChild('alts')
  altsFormComponent!: LinksFormComponent;
  @ViewChild(PluginsFormComponent)
  pluginsFormComponent!: PluginsFormComponent;
  @ViewChild('fill')
  fill?: ElementRef;

  @HostBinding('class.show-drops')
  dropping = false;

  id = 'ref-' + uuid();
  oembed?: Oembed;
  scraped?: Ref;
  ref?: Ref;
  scrapingTitle = false;
  scrapingPublished = false;
  scrapingAll = false;

  constructor(
    private fb: UntypedFormBuilder,
    public admin: AdminService,
    private editor: EditorService,
    private scrape: ScrapeService,
    private oembeds: OembedStore,
    private store: Store,
  ) { }

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

  get tags() {
    return this.group.get('tags') as UntypedFormArray;
  }

  get sources() {
    return this.group.get('sources') as UntypedFormArray;
  }

  addSource(value = '') {
    this.sources.push(this.fb.control(value, LinksFormComponent.validators));
  }

  setTags(value: string[]) {
    if (!this.tagsFormComponent?.tags) {
      defer(() => this.setTags(value));
      return;
    }
    this.tagsFormComponent.setTags(value);
  }

  get editorLabel() {
    // TODO: Move to config
    if (hasTag('+plugin/secret', this.tags.value)) return $localize`Secret Key`;
    if (hasTag('plugin/alt', this.tags.value)) return $localize`Alt Text`;
    return $localize`Abstract`;
  }

  get addEditorLabel() {
    return $localize`+ Add ` + this.editorLabel.toLowerCase();
  }

  get addEditorTitle() {
    return $localize`Add ` + this.editorLabel.toLowerCase();
  }

  @HostListener('dragenter')
  onDragEnter() {
    this.dropping = true;
  }

  @HostListener('window:dragend')
  OnDragEnd() {
    this.dropping = false;
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
    return this.scrape.webScrape(hasTag('plugin/repost', this.tags.value) ? this.sources.value?.[0] : this.url.value).pipe(
      tap(s => {
        this.scraped = s;
        if (s.modified && this.ref?.modified) {
          this.ref!.modifiedString = s.modifiedString;
          this.ref!.modified = s.modified;
          if (hasTag('_plugin/cache', s)) {
            if (!hasTag('_plugin/cache', this.ref)) {
              this.ref!.tags ||= [];
              this.ref!.tags.push('_plugin/cache');
            }
            this.ref!.plugins ||= {}
            this.ref!.plugins['_plugin/cache'] = s.plugins?.['_plugin/cache'];
          }
          this.setRef(this.ref!);
        }
      }),
    );
  }

  scrapeTitle() {
    this.scrapingTitle = true;
    this.scrape$.pipe(
      catchError(err => {
        this.scrapingTitle = false;
        return of({
          url: this.url.value,
          title: undefined,
        })
      }),
      switchMap(s => this.oembeds.get(s.url).pipe(
        map(oembed => {
          this.oembed = oembed!;
          if (oembed) s.title ||= oembed.title;
          return s;
        }),
        catchError(err => of(s)),
      )),
    ).subscribe((s: Ref) => {
      this.scrapingTitle = false;
      if (s.title) this.group.patchValue({ title: s.title });
    });
  }

  scrapePublished() {
    this.scrapingPublished = true;
    this.scrape$.pipe(
      catchError(err => {
        this.scrapingPublished = false;
        // TODO: Write error
        return throwError(() => err);
      })
    ).subscribe(ref => {
      this.scrapingPublished = false;
      this.published.setValue(ref.published?.toFormat("YYYY-MM-DD'T'TT"));
    });
  }

  scrapeAll() {
    if (this.oembed) {
      // TODO: oEmbed
    } else {
      this.scrapingAll = true;
      this.scrape$.pipe(
        catchError(err => {
          this.scrapingAll = false;
          return throwError(() => err);
        })
      ).subscribe(s => {
        if (!hasMedia(s) || hasMedia(this.group.value)) {
          this.scrapeComment();
        }
        this.scrapePlugins();
        this.scrapingAll = false;
      });
    }
  }

  scrapePlugins() {
    if (this.oembed) {
      // TODO: oEmbed
    } else {
      this.scrape$.subscribe(s => {
        for (const t of s.tags || []) {
          if (!hasTag(t, this.tags.value)) this.togglePlugin(t);
        }
        defer(() => {
          this.pluginsFormComponent.setValue({
            ...this.group.value.plugins || {},
            ...s.plugins || {},
          });
        });
      });
    }
  }

  scrapeComment() {
    if (this.oembed) {
      // TODO: oEmbed
    } else {
      this.scrape$.subscribe(s => this.setComment(s.comment || ''));
    }
  }

  togglePlugin(tag: string) {
    this.toggleTag.next(tag);
    if (tag) {
      if (hasTag(tag, this.tags.value)) {
        this.tagsFormComponent.removeTagAndChildren(tag);
      } else {
        this.tagsFormComponent.addTag(tag);
      }
    }
  }

  setRef(ref: Partial<Ref>) {
    this.ref = ref as Ref;
    this.group.patchValue({
      ...ref,
      published: ref.published ? ref.published.toFormat("yyyy-MM-dd'T'TT") : undefined,
    });
    defer(() => this.sourcesFormComponent.setLinks(ref.sources || []));
    defer(() => this.altsFormComponent.setLinks(ref.alternateUrls || []));
    defer(() => this.tagsFormComponent.setTags(ref.tags || []));
    defer(() => this.pluginsFormComponent.setValue(ref.plugins));
  }
}

export function refForm(fb: UntypedFormBuilder) {
  return fb.group({
    url: { value: '',  disabled: true },
    published: [''],
    modified: [''],
    modifiedString: [''],
    title: [''],
    comment: [''],
    sources: fb.array([]),
    alternateUrls: fb.array([]),
    tags: fb.array([]),
    plugins: fb.group({})
  });
}
