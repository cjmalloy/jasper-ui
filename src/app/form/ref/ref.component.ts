import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup
} from '@angular/forms';
import { defer, some } from 'lodash-es';
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
import { AdminService } from '../../service/admin.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { OembedStore } from '../../store/oembed';
import { Store } from '../../store/store';
import { getScheme, getTitleFromFilename } from '../../util/http';
import { memo, MemoCache } from '../../util/memo';
import { hasMedia, hasPrefix, hasTag } from '../../util/tag';
import { EditorComponent } from '../editor/editor.component';
import { LinksFormComponent } from '../links/links.component';
import { PluginsFormComponent } from '../plugins/plugins.component';
import { TagsFormComponent } from '../tags/tags.component';

@Component({
  selector: 'app-ref-form',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
  host: { 'class': 'nested-form' },
  imports: [
    EditorComponent,
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
  ],
})
export class RefFormComponent implements OnChanges {

  @Input()
  origin? = '';
  @Input()
  group!: UntypedFormGroup;
  @Output()
  toggleTag = new EventEmitter<string>();

  @ViewChild('fill')
  fill?: ElementRef;
  @ViewChild(PluginsFormComponent)
  pluginsFormComponent?: PluginsFormComponent;

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
    public config: ConfigService,
    public admin: AdminService,
    private editor: EditorService,
    private scrape: ScrapeService,
    private oembeds: OembedStore,
    private store: Store,
    private fb: UntypedFormBuilder,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    MemoCache.clear(this);
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

  get tags() {
    return this.group.get('tags') as UntypedFormArray;
  }

  get sources() {
    return this.group.get('sources') as UntypedFormArray;
  }

  get alternateUrls() {
    return this.group.get('alternateUrls') as UntypedFormArray;
  }

  get plugins() {
    return this.group.get('plugins') as UntypedFormGroup;
  }

  addSource(value = '') {
    this.sources.push(this.fb.control(value, LinksFormComponent.validators));
  }

  /**
   * Add an alternate URL to the alternateUrls array through the form group.
   */
  addAlt(value = '') {
    this.alternateUrls.push(this.fb.control(value, LinksFormComponent.validators));
  }

  /**
   * Set tags array values through the form group.
   */
  setTags(values: string[]) {
    MemoCache.clear(this);
    this.setFormArray(this.tags, values, TagsFormComponent.validators);
  }

  /**
   * Add a tag to the tags array through the form group.
   */
  addTag(tag: string) {
    if (!tag || hasTag(tag, this.tags.value)) return;
    this.tags.push(this.fb.control(tag, TagsFormComponent.validators));
  }

  /**
   * Remove a tag from the tags array through the form group.
   */
  removeTag(tag: string) {
    for (let i = this.tags.value.length - 1; i >= 0; i--) {
      if (hasPrefix(this.tags.value[i], tag)) {
        this.tags.removeAt(i);
      }
    }
  }

  /**
   * Remove a tag and its children from the tags array through the form group.
   */
  removeTagAndChildren(tag: string) {
    let removed = false;
    for (let i = this.tags.value.length - 1; i >= 0; i--) {
      if (hasPrefix(this.tags.value[i], tag)) {
        this.tags.removeAt(i);
        removed = true;
      }
    }
    if (removed && tag.includes('/')) {
      const parent = tag.substring(0, tag.lastIndexOf('/'));
      if (!hasTag(parent, this.tags.value)) this.addTag(parent);
    }
  }

  /**
   * Set plugins form group values.
   * Uses defer to ensure child GenFormComponent instances are initialized.
   */
  setPlugins(value: any) {
    if (!value) return;
    if (!this.pluginsFormComponent) {
      defer(() => this.setPlugins(value));
      return;
    }
    this.pluginsFormComponent.setValue(value);
  }

  /**
   * Set links array values through the form group.
   */
  private setFormArray(formArray: UntypedFormArray, values: string[], validators: any[] = []) {
    while (formArray.length > values.length) formArray.removeAt(formArray.length - 1, { emitEvent: false });
    while (formArray.length < values.length) formArray.push(this.fb.control('', validators), { emitEvent: false });
    formArray.setValue(values);
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

  @memo
  get codeLang() {
    for (const t of this.tags.value) {
      if (hasPrefix(t, 'plugin/code')) {
        return t.split('/')[2];
      }
    }
    return '';
  }

  @memo
  get codeOptions() {
    return {
      language: this.codeLang,
      theme: this.store.darkTheme ? 'vs-dark' : 'vs',
      automaticLayout: true,
    };
  }

  @memo
  get customEditor() {
    if (!this.tags?.value) return false;
    return some(this.admin.editor, t => hasTag(t.tag, this.tags!.value));
  }

  @HostListener('dragenter')
  onDragEnter() {
    this.dropping = true;
  }

  @HostListener('window:dragend')
  onDragEnd() {
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
          if (oembed) s.title ||= oembed.title || '';
          return s;
        }),
        catchError(err => of(s)),
      )),
    ).subscribe((s: Ref) => {
      this.scrapingTitle = false;
      const title = s.title ?? getTitleFromFilename(this.url.value);
      if (title) this.group.patchValue({ title });
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
        // Set the plugins using the helper method
        this.setPlugins({
          ...this.group.value.plugins || {},
          ...s.plugins || {},
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
    MemoCache.clear(this);
    this.toggleTag.next(tag);
    if (tag) {
      if (hasTag(tag, this.tags.value)) {
        this.removeTagAndChildren(tag);
      } else {
        this.addTag(tag);
      }
    }
  }

  /**
   * Set ref values through the form group.
   * All child form arrays are updated through reactive form methods.
   */
  setRef(ref: Partial<Ref>) {
    this.ref = ref as Ref;
    // Update simple form controls
    this.group.patchValue({
      ...ref,
      published: ref.published ? ref.published.toFormat("yyyy-MM-dd'T'TT") : undefined,
    });
    // Update form arrays through the form group
    this.setFormArray(this.sources, ref.sources || [], LinksFormComponent.validators);
    this.setFormArray(this.alternateUrls, ref.alternateUrls || [], LinksFormComponent.validators);
    this.setFormArray(this.tags, ref.tags || [], TagsFormComponent.validators);
    // Set plugins using the helper method which calls PluginsFormComponent.setValue
    this.setPlugins(ref.plugins);
    MemoCache.clear(this);
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
