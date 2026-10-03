import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  computed,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import {
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup
} from '@angular/forms';
import { defer, isEqual, some } from 'lodash-es';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { LoadingComponent } from '../../component/loading/loading.component';
import { SelectPluginComponent } from '../../component/select-plugin/select-plugin.component';
import { FillWidthDirective } from '../../directive/fill-width.directive';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { Oembed } from '../../model/oembed';
import { Ref } from '../../model/ref';
import { CssUrlPipe } from '../../pipe/css-url.pipe';
import { ThumbnailPipe } from '../../pipe/thumbnail.pipe';
import { AdminService } from '../../service/admin.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { OembedStore } from '../../store/oembed';
import { Store } from '../../store/store';
import { getScheme, getTitleFromFilename } from '../../util/http';
import { hasMedia, hasPrefix, hasTag } from '../../util/tag';
import { EditorComponent } from '../editor/editor.component';
import { LinksFormComponent } from '../links/links.component';
import { PluginsFormComponent } from '../plugins/plugins.component';
import { TagsFormComponent } from '../tags/tags.component';
import { controlState, controlValue } from '../../util/form';

@Component({
  selector: 'app-ref-form',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
  host: {
    'class': 'nested-form',
    '[class.show-drops]': 'dropping()',
    '(dragenter)': 'onDragEnter()',
    '(window:dragend)': 'onDragEnd()',
    '(jasper-drag-end)': 'onDragEnd()',
    '(jasper-drag-start)': 'onCdkDragStart()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    forwardRef(() => EditorComponent),
    CdkDropListGroup,
    ReactiveFormsModule,
    LinksFormComponent,
    LoadingComponent,
    SelectPluginComponent,
    PluginsFormComponent,
    MonacoEditorModule,
    ResizeHandleDirective,
    FillWidthDirective,
    TagsFormComponent,
    AsyncPipe,
    ThumbnailPipe,
    CssUrlPipe,
  ],
})
export class RefFormComponent {
  private readonly rootControlState = controlValue(() => this.group());

  protected readonly controlState0 = controlValue(() => this.url());
  private readonly controlState1 = controlValue(() => this.group());
  private readonly controlState2 = controlValue(() => this.sources());
  private readonly controlState3 = controlValue(() => this.tags());


  readonly origin = input<string | undefined>('');
  readonly group = input.required<UntypedFormGroup>();
  readonly creating = input(false);
  private readonly tagsValue = controlValue<string[]>(() => this.tags());
  readonly toggleTag = output<string>();

  readonly tagsFormComponent = viewChild.required<TagsFormComponent>('tagsFormComponent');
  readonly sourcesFormComponent = viewChild.required<LinksFormComponent>('sources');
  readonly altsFormComponent = viewChild.required<LinksFormComponent>('alts');
  readonly pluginsFormComponent = viewChild.required<PluginsFormComponent>('pluginsFormComponent');
  readonly fill = viewChild<ElementRef>('fill');
  readonly editorComponent = viewChild<EditorComponent>('ed');

  readonly dropping = signal(false);

  id = 'ref-' + uuid();
  readonly oembed = signal<Oembed | undefined>(undefined);
  readonly scraped = signal<Ref | undefined>(undefined);
  readonly ref = signal<Ref | undefined>(undefined);
  readonly scrapingTitle = signal(false);
  readonly scrapingPublished = signal(false);
  readonly scrapingAll = signal(false);
  readonly completedUploads = signal<Ref[]>([]);

  constructor(
    public config: ConfigService,
    public admin: AdminService,
    private editor: EditorService,
    private scrape: ScrapeService,
    private oembeds: OembedStore,
    private store: Store,
    private fb: UntypedFormBuilder,
    private cd: ChangeDetectorRef,
    private el: ElementRef<HTMLElement>,
  ) { }

  readonly web = computed(() => {
    this.rootControlState();
    this.controlState0();
    const scheme = getScheme(this.url().value);
    return scheme === 'http:' || scheme === 'https:';
  });

  readonly url = computed(() => {
    this.rootControlState();
    return this.group().get('url') as UntypedFormControl;
  });

  readonly title = computed(() => {
    this.rootControlState();
    return this.group().get('title') as UntypedFormControl;
  });

  readonly comment = computed(() => {
    this.rootControlState();
    return this.group().get('comment') as UntypedFormControl;
  });

  readonly published = computed(() => {
    this.rootControlState();
    return this.group().get('published') as UntypedFormControl;
  });
  protected readonly publishedRequired = controlState(this.published, c => c.touched && !!c.errors?.['required']);

  readonly tags = computed(() => {
    this.rootControlState();
    return this.group().get('tags') as UntypedFormArray;
  });

  readonly sources = computed(() => {
    this.rootControlState();
    return this.group().get('sources') as UntypedFormArray;
  });

  readonly thumbnail = computed(() => {
    this.rootControlState();
    this.controlState1();
    if (!this.admin.getPlugin('plugin/thumbnail')) return false;
    if (hasTag('plugin/thumbnail', this.group().value)) return true;
    return !!this.admin.getPlugin('plugin/image') && hasTag('plugin/image', this.group().value);
  });

  readonly thumbnailRefs = computed(() => {
    this.rootControlState();
    this.controlState1();
    return [{ ...this.group().getRawValue(), origin: this.creating() ? this.store.account.origin() : this.origin() }];
  });

  readonly thumbnailPlugin = computed(() => {
    this.rootControlState();
    this.controlState1();
    const plugin = this.group().value.plugins?.['plugin/thumbnail'];
    return plugin && typeof plugin === 'object' && !Array.isArray(plugin) ? plugin : undefined;
  });

  readonly thumbnailColor = computed(() => {
    this.rootControlState();
    return this.thumbnailPlugin()?.color || '';
  });

  readonly thumbnailEmoji = computed(() => {
    this.rootControlState();
    return this.thumbnailPlugin()?.emoji || '';
  });

  readonly thumbnailRadius = computed(() => {
    this.rootControlState();
    return this.thumbnailPlugin()?.radius || 0;
  });

  readonly top = computed(() => {
    this.rootControlState();
    this.controlState2();
    this.controlState0();
    return this.sources().value[1] || this.sources().value[0] || this.ref()?.url || this.url().value;
  });

  addSource(value = '') {
    while (this.sources().value.length < 2) {
      this.sources().push(this.fb.control(this.top(), LinksFormComponent.validators));
    }
    this.sources().push(this.fb.control(value, LinksFormComponent.validators));
  }

  setTags(value: string[]) {
    const tagsFormComponent = this.tagsFormComponent();
    if (!tagsFormComponent?.tags()) {
      defer(() => this.setTags(value));
      return;
    }
    tagsFormComponent.setTags(value);
  }

  readonly editorLabel = computed(() => {
    this.rootControlState();
    this.controlState3();
    // TODO: Move to config
    if (hasTag('+plugin/secret', this.tags().value)) return $localize`Secret Key`;
    if (hasTag('plugin/alt', this.tags().value)) return $localize`Alt Text`;
    return $localize`Abstract`;
  });

  readonly addEditorLabel = computed(() => {
    this.rootControlState();
    return $localize`+ Add ` + this.editorLabel().toLowerCase();
  });

  readonly addEditorTitle = computed(() => {
    this.rootControlState();
    return $localize`Add ` + this.editorLabel().toLowerCase();
  });

  readonly codeLang = computed(() => {
    this.rootControlState();
    for (const t of this.tagsValue() || []) {
      if (hasPrefix(t, 'plugin/code')) {
        return t.split('/')[2];
      }
    }
    return '';
  });

  readonly codeOptions = computed(() => ({
    language: this.codeLang(),
    theme: this.store.darkTheme() ? 'vs-dark' : 'vs',
    automaticLayout: true,
  }), { equal: isEqual });

  readonly customEditor = computed(() => {
    this.rootControlState();
    const tags = this.tagsValue();
    if (!tags) return false;
    return some(this.admin.editor(), t => hasTag(t.tag, tags));
  });

  onDragEnter() {
    this.dropping.set(true);
  }

  onDragEnd() {
    this.dropping.set(false);
  }

  onCdkDragStart() {
    this.dropping.set(true);
    // Render empty drop lists synchronously so CDK caches their positions,
    // host bindings are not updated by detectChanges
    this.el.nativeElement.classList.add('show-drops');
    this.cd.detectChanges();
  }

  validate(input: HTMLInputElement) {
    if (this.title().touched) {
      if (this.title().errors?.['required']) {
        input.setCustomValidity($localize`Title must not be blank.`);
        input.reportValidity();
      }
    }
  }

  setComment(value: string) {
    this.comment().setValue(value);
    // Ignore tags and sources from new comment
    this.editor.syncEditor(this.fb, this.group(), value);
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.group());
  }

  get scrape$() {
    const scraped = this.scraped();
    if (scraped) return of(scraped);
    return this.scrape.webScrape(hasTag('plugin/repost', this.tags().value) ? this.sources().value?.[0] : this.url().value).pipe(
      tap(s => {
        this.scraped.set(s);
        const current = this.ref();
        if (s.modified && current?.modified) {
          const ref: Ref = {
            ...current,
            modifiedString: s.modifiedString,
            modified: s.modified,
            tags: [...current.tags || []],
            plugins: { ...current.plugins || {} },
          };
          if (hasTag('_plugin/cache', s)) {
            if (!hasTag('_plugin/cache', ref)) {
              ref.tags ||= [];
              ref.tags.push('_plugin/cache');
            }
            ref.plugins ||= {}
            ref.plugins['_plugin/cache'] = s.plugins?.['_plugin/cache'];
          }
          this.setRef(ref);
        }
      }),
    );
  }

  scrapeTitle() {
    this.scrapingTitle.set(true);
    this.scrape$.pipe(
      catchError(err => {
        this.scrapingTitle.set(false);
        return of({
          url: this.url().value,
          title: undefined,
        })
      }),
      switchMap(s => this.oembeds.get(s.url).pipe(
        map(oembed => {
          this.oembed.set(oembed!);
          if (oembed) s.title ||= oembed.title || '';
          return s;
        }),
        catchError(err => of(s)),
      )),
    ).subscribe((s: Ref) => {
      this.scrapingTitle.set(false);
      const title = s.title ?? getTitleFromFilename(this.url().value);
      if (title) this.group().patchValue({ title });
    });
  }

  scrapePublished() {
    this.scrapingPublished.set(true);
    this.scrape$.pipe(
      catchError(err => {
        this.scrapingPublished.set(false);
        // TODO: Write error
        return throwError(() => err);
      })
    ).subscribe(ref => {
      this.scrapingPublished.set(false);
      this.published().setValue(ref.published?.toFormat("YYYY-MM-DD'T'TT"));
    });
  }

  scrapeAll() {
    if (this.oembed()) {
      // TODO: oEmbed
    } else {
      this.scrapingAll.set(true);
      this.scrape$.pipe(
        catchError(err => {
          this.scrapingAll.set(false);
          return throwError(() => err);
        })
      ).subscribe(s => {
        if (!hasMedia(s) || hasMedia(this.group().value)) {
          this.scrapeComment();
        }
        this.scrapePlugins();
        this.scrapingAll.set(false);
      });
    }
  }

  scrapePlugins() {
    if (this.oembed()) {
      // TODO: oEmbed
    } else {
      this.scrape$.subscribe(s => {
        for (const t of s.tags || []) {
          if (!hasTag(t, this.tags().value)) this.togglePlugin(t);
        }
        defer(() => {
          this.pluginsFormComponent().setValue({
            ...this.group().value.plugins || {},
            ...s.plugins || {},
          });
        });
      });
    }
  }

  scrapeComment() {
    if (this.oembed()) {
      // TODO: oEmbed
    } else {
      this.scrape$.subscribe(s => this.setComment(s.comment || ''));
    }
  }

  addCompletedUpload(ref: Ref) {
    this.completedUploads.update(uploads => [...uploads, ref]);
  }

  togglePlugin(tag: string) {
    this.toggleTag.emit(tag);
    if (tag) {
      if (hasTag(tag, this.tags().value)) {
        this.tagsFormComponent().removeTagAndChildren(tag);
      } else {
        this.tagsFormComponent().addTag(tag);
      }
    }
  }

  setRef(ref: Partial<Ref>) {
    this.ref.set(ref as Ref);
    this.group().patchValue({
      ...ref,
      published: ref.published ? ref.published.toFormat("yyyy-MM-dd'T'TT") : undefined,
    });
    defer(() => {
      this.sourcesFormComponent().setLinks(ref.sources || []);
      this.altsFormComponent().setLinks(ref.alternateUrls || []);
      this.tagsFormComponent().setTags(ref.tags || []);
      this.pluginsFormComponent().setValue(ref.plugins);
    });
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
