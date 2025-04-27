import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, Subscription, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { LinksFormComponent } from '../../../form/links/links.component';
import { PluginsFormComponent, writePlugins } from '../../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../../form/ref/ref.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { wikiTitleFormat, wikiUriFormat } from '../../../mods/wiki';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { EditorService } from '../../../service/editor.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';
import { hasTag } from '../../../util/tag';

@Component({
  standalone: false,
  selector: 'app-submit-text',
  templateUrl: './text.component.html',
  styleUrls: ['./text.component.scss'],
  host: {'class': 'full-page-form'}
})
export class SubmitTextPage implements AfterViewInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];

  submitted = false;
  textForm: UntypedFormGroup;
  advanced = false;
  serverError: string[] = [];

  @ViewChild('fill')
  fill?: ElementRef;

  @ViewChild(TagsFormComponent)
  tagsFormComponent!: TagsFormComponent;
  @ViewChild(PluginsFormComponent)
  plugins!: PluginsFormComponent;

  submitting?: Subscription;
  addAnother = false;
  private oldSubmit: string[] = [];
  private savedRef?: Ref;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    private router: Router,
    public store: Store,
    public bookmarks: BookmarkService,
    private editor: EditorService,
    private refs: RefService,
    private ts: TaggingService,
    private fb: UntypedFormBuilder,
  ) {
    mod.setTitle($localize`Submit: Text Post`);
    this.textForm = refForm(fb);
    runInAction(() => store.submit.wikiPrefix = admin.getWikiPrefix());
  }

  saveChanges() {
    // TODO: Just save in drafts
    return !this.textForm?.dirty;
  }

  ngAfterViewInit() {
    if (this.store.account.localTag) this.addTag(this.store.account.localTag);
    this.disposers.push(autorun(() => {
      let url = this.store.submit.url || 'comment:' + uuid();
      if (!this.admin.isWikiExternal() && this.store.submit.wiki) {
        url = wikiUriFormat(url, this.admin.getWikiPrefix());
        this.mod.setTitle($localize`Submit: Wiki`);
        this.title.setValue(wikiTitleFormat(url, this.admin.getWikiPrefix()));
        this.title.disable();
      } else if (this.store.submit.title) {
        this.title.setValue(this.store.submit.title);
      }
      this.url.setValue(url);
      this.url.disable();
      const tags = [...this.store.submit.tags, ...(this.store.account.localTag ? [this.store.account.localTag] : [])];
      const added = without(tags, ...this.oldSubmit);
      const removed = without(this.oldSubmit, ...tags);
      if (added.length || removed.length) {
        const newTags = uniq([...without(this.tagsFormComponent!.tags!.value, ...removed), ...added]);
        this.tagsFormComponent!.setTags(newTags);
        this.oldSubmit = tags;
      }
      let plugins = {};
      if (this.store.submit.thumbnail) {
        this.addTag('plugin/thumbnail');
        this.plugins.setValue(plugins = {
          ...plugins,
          'plugin/thumbnail': { url: this.store.submit.thumbnail },
        });
      }
      if (this.store.submit.pluginUpload) {
        this.addTag(this.store.submit.plugin);
        this.plugins.setValue(plugins = {
          ...plugins,
          [this.store.submit.plugin]: { url: this.store.submit.pluginUpload },
        });
        if (this.store.submit.plugin === 'plugin/image' || this.store.submit.plugin === 'plugin/video') {
          this.addTag('plugin/thumbnail');
        }
      }
      for (const s of this.store.submit.sources) {
        this.addSource(s)
      }
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get randomURL() {
    return !this.store.submit.url && (this.admin.isWikiExternal() || !this.store.submit.wiki) ;
  }

  showAdvanced() {
    const tags = uniq(this.textForm.value.tags);
    const published = this.textForm.value.published ? DateTime.fromISO(this.textForm.value.published) : DateTime.now();
    this.savedRef = {
      ...this.textForm.value,
      url: this.url.value, // Need to pull separately since control is locked
      title: this.title.value, // Need to pull separately if disabled by wiki mode
      origin: this.store.account.origin,
      published,
      tags,
      plugins: writePlugins(this.textForm.value.tags, this.textForm.value.plugins),
    };
    this.advanced = true;
  }

  @ViewChild('advancedForm')
  set advancedForm(value: RefFormComponent | undefined) {
    if (this.savedRef && value) {
      value.setRef(this.savedRef);
      delete this.savedRef;
    }
  }

  get url() {
    return this.textForm.get('url') as UntypedFormControl;
  }

  get title() {
    return this.textForm.get('title') as UntypedFormControl;
  }

  get comment() {
    return this.textForm.get('comment') as UntypedFormControl;
  }

  get sources() {
    return this.textForm.get('sources') as UntypedFormArray;
  }

  get tags() {
    return this.textForm.get('tags') as UntypedFormArray;
  }

  setTags(value: string[]) {
    if (!this.tagsFormComponent?.tags) {
      defer(() => this.setTags(value));
      return;
    }
    this.tagsFormComponent.setTags(value);
  }

  validate(input: HTMLInputElement) {
    if (this.title.touched) {
      if (this.title.errors?.['required']) {
        input.setCustomValidity($localize`Title must not be blank.`);
        input.reportValidity();
      }
    }
  }

  addTag(...values: string[]) {
    if (!this.tagsFormComponent?.tags) {
      defer(() => this.addTag(...values));
      return;
    }
    this.tagsFormComponent.addTag(...values);
    this.submitted = false;
  }

  addSource(value = '') {
    this.sources.push(this.fb.control(value, LinksFormComponent.validators))
    this.submitted = false;
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.textForm);
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.textForm.markAllAsTouched();
    this.syncEditor();
    if (!this.textForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const tags = uniq(this.textForm.value.tags);
    const published = this.textForm.value.published ? DateTime.fromISO(this.textForm.value.published) : DateTime.now();
    const ref = {
      ...this.textForm.value,
      url: this.url.value, // Need to pull separately since control is locked
      title: this.title.value, // Need to pull separately if disabled by wiki mode
      origin: this.store.account.origin,
      published,
      tags,
      plugins: writePlugins(this.textForm.value.tags, this.textForm.value.plugins),
    };
    this.submitting = this.refs.create(ref).pipe(
      tap(() => {
        if (this.admin.getPlugin('plugin/user/vote/up')) {
          this.ts.createResponse('plugin/user/vote/up', this.url.value).subscribe();
        }
      }),
      catchError((res: HttpErrorResponse) => {
        delete this.submitting;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      delete this.submitting;
      this.textForm.markAsPristine();
      if (this.addAnother) {
        this.url.enable();
        this.url.setValue('comment:' + uuid());
        this.url.disable();
      } else if (hasTag('plugin/thread', ref)) {
        this.router.navigate(['/ref', this.url.value, 'thread'], { queryParams: { published }, replaceUrl: true });
      } else {
        this.router.navigate(['/ref', this.url.value], { queryParams: { published }, replaceUrl: true});
      }
    });
  }
}
