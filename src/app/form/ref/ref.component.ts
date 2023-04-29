import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import * as moment from 'moment';
import { DiffEditorModel } from 'ngx-monaco-editor';
import { catchError, map, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { EditorService } from '../../service/editor.service';
import { OembedStore } from '../../store/oembed';
import { Store } from '../../store/store';
import { LinksFormComponent } from '../links/links.component';
import { pluginsForm, PluginsFormComponent } from '../plugins/plugins.component';
import { TagsFormComponent } from '../tags/tags.component';

@Component({
  selector: 'app-ref-form',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss']
})
export class RefFormComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'nested-form';
  private disposers: IReactionDisposer[] = [];

  @Input()
  group!: UntypedFormGroup;
  @Input()
  diff?: Ref;

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

  scraped?: Ref;
  diffOn = false;

  options: any = {
    language: 'json',
    automaticLayout: true,
  };
  private _refModel?: DiffEditorModel;
  private _diffModel?: DiffEditorModel;

  constructor(
    private fb: UntypedFormBuilder,
    private admin: AdminService,
    private editor: EditorService,
    private scrape: ScrapeService,
    private store: Store,
    private oembeds: OembedStore,
  ) {
    this.disposers.push(autorun(() => {
      this.options = {
        ...this.options,
        theme: store.darkTheme ? 'vs-dark' : 'vs',
      }
    }));
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  getTags() {
    return this.group.get('tags')?.value;
  }

  get refModel(): DiffEditorModel {
    if (this._refModel) return this._refModel;
    return this._refModel = {
      code: JSON.stringify(this.group.value || '', null, 2),
      language: 'text/plain'
    };
  }

  get diffModel(): DiffEditorModel {
    if (this._diffModel) return this._diffModel;
    return this._diffModel = {
      code: JSON.stringify(this.diff || '', null, 2),
      language: 'text/plain'
    };
  }

  @ViewChild('fill')
  set setFill(value: ElementRef) {
    this.fill.next(value.nativeElement);
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
    this.scrape$.pipe(
      catchError(err => of({
        url: this.url.value,
        title: '' ,
      })),
      switchMap(ref => this.oembeds.get(ref.url).pipe(
        map(oembed => {
          ref.title ||= oembed.title;
          return ref;
        }),
        catchError(err => of(ref)),
      )),
    ).subscribe((ref: Ref) => {
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
    delete this._refModel;
    delete this._diffModel;
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
