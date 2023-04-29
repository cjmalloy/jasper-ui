import { Component, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions } from '@ngx-formly/core';
import { defer, uniq } from 'lodash-es';
import { Ext } from '../../model/ext';
import { Template } from '../../model/template';
import { getMailbox } from '../../plugin/mailbox';
import { AdminService } from '../../service/admin.service';
import { TAG_REGEX } from '../../util/format';
import { hasPrefix } from '../../util/tag';
import { linksForm } from '../links/links.component';
import { qtagsForm } from '../qtags/qtags.component';
import { queriesForm } from '../queries/queries.component';
import { tagsForm } from '../tags/tags.component';
import { themesForm } from '../themes/themes.component';
import { usersForm } from '../users/users.component';

@Component({
  selector: 'app-ext-form',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss']
})
export class ExtFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group?: UntypedFormGroup;
  @Input()
  defaults?: UntypedFormGroup;
  @Input()
  showClear = false;
  @Output()
  clear = new EventEmitter<void>();

  @ViewChild('fill')
  fill?: ElementRef;

  form?: FormlyFieldConfig[];
  advancedForm?: FormlyFieldConfig[];

  options: FormlyFormOptions = {
  };

  constructor(
    private fb: UntypedFormBuilder,
    private admin: AdminService,
  ) { }

  ngOnInit(): void {
  }

  get config() {
    return this.group?.get('config') as UntypedFormGroup || this.defaults;
  }

  get inbox() {
    if (this.defaults) return '';
    if (!this.admin.status.plugins.inbox) return null;
    if (hasPrefix(this.group!.get('tag')!.value, 'user')) return null;
    return getMailbox(this.group!.get('tag')!.value);
  }

  get modmail() {
    return this.config.get('modmail') as UntypedFormControl;
  }

  get sidebar() {
    return this.config.get('sidebar') as UntypedFormControl;
  }

  get themes() {
    return this.config.get('themes') as UntypedFormGroup;
  }

  get userThemes() {
    return this.config.get('userThemes') as UntypedFormGroup;
  }

  get themeValues() {
    return uniq([...Object.keys(this.themes?.value), ...this.admin.themes.flatMap(p => Object.keys(p.config!.themes!))]);
  }

  get userThemeValues() {
    return uniq([...Object.keys(this.userThemes?.value), ...this.admin.themes.flatMap(p => Object.keys(p.config!.themes!))]);
  }

  get theme() {
    return this.config.get('theme') as UntypedFormControl;
  }

  get subscriptions() {
    return this.config.get('subscriptions') as UntypedFormControl;
  }

  get pinned() {
    return this.config.get('pinned') as UntypedFormControl;
  }

  get bookmarks() {
    return this.config.get('bookmarks') as UntypedFormControl;
  }

  get alarms() {
    return this.config.get('alarms') as UntypedFormControl;
  }

  get editors() {
    return this.config.get('editors') as UntypedFormControl;
  }

  get userTheme() {
    return this.config.get('userTheme') as UntypedFormControl;
  }

  get maxAge() {
    return this.config.get('maxAge') as UntypedFormControl;
  }

  get bounty() {
    return this.config.get('bounty') as UntypedFormControl;
  }

  get approvers() {
    return this.config.get('approvers') as UntypedFormControl;
  }

  get columns() {
    return this.config.get('columns') as UntypedFormControl;
  }

  get showNoColumn() {
    return this.config.get('showNoColumn') as UntypedFormControl;
  }

  get swimLanes() {
    return this.config.get('swimLanes') as UntypedFormControl;
  }

  get showNoSwimLane() {
    return this.config.get('showNoSwimLane') as UntypedFormControl;
  }

  get filterTags() {
    return this.config.get('filterTags') as UntypedFormControl;
  }

  setValue(ext: Ext) {
    if (!this.form) {
      this.form = this.admin.getTemplateForm(ext.tag);
    }
    if (!this.advancedForm) {
      this.advancedForm = this.admin.getTemplateAdvancedForm(ext.tag);
    }
    defer(() => this.group!.patchValue(ext));
  }

  setDefaults(template: Template) {
    if (!this.form) {
      this.form = this.admin.getTemplateForm(template.tag);
    }
    if (!this.form) {
      this.form = this.admin.getTemplateForm(template.tag);
    }
    defer(() => this.group!.patchValue(template.defaults));
  }
}

export function extForm(fb: UntypedFormBuilder, ext: Ext, admin: AdminService, locked: boolean) {
  return fb.group({
    tag: [{value: '', disabled: locked}, [Validators.required, Validators.pattern(TAG_REGEX)]],
    name: [''],
    config: extConfigForm(fb, ext, admin),
  });
}

export function extConfigForm(fb: UntypedFormBuilder, ext: Ext, admin: AdminService) {
  let configControls = {};
  if (root(ext.tag, admin)) {
    configControls = {
      ...configControls,
      sidebar: [''],
      modmail: [true],
      pinned: linksForm(fb, ext.config?.pinned || []),
      themes: themesForm(fb, ext.config?.themes || []),
      theme: [''],
    };
  }
  if (user(ext.tag, admin)) {
    configControls = {
      ...configControls,
      subscriptions: queriesForm(fb, ext.config?.subscriptions || []),
      bookmarks: queriesForm(fb, ext.config?.bookmarks || []),
      alarms: queriesForm(fb, ext.config?.alarms || []),
      userThemes: themesForm(fb, ext.config?.userThemes),
      userTheme: [''],
      editors: tagsForm(fb, ext.config?.editors || []),
    };
  }
  if (queue(ext.tag, admin)) {
    configControls = {
      ...configControls,
      bounty: [''],
      maxAge: [''],
      approvers: usersForm(fb, ext.config?.approvers),
    };
  }
  if (kanban(ext.tag, admin)) {
    configControls = {
      ...configControls,
      columns: qtagsForm(fb, ext.config?.columns),
      showNoColumn: [false],
      noColumnTitle: [''],
      swimLanes: qtagsForm(fb, ext.config?.swimLanes || []),
      showNoSwimLane: [false],
      noSwimLaneTitle: [''],
    };
  }
  if (blog(ext.tag, admin)) {
    configControls = {
      ...configControls,
      tags: qtagsForm(fb, ext.config?.tags || []),
    };
  }
  return fb.group(configControls);
}

function root(tag: string, admin: AdminService) {
  return !!admin.status.templates.root;
}

function user(tag: string, admin: AdminService) {
  return !!admin.status.templates.user && hasPrefix(tag, 'user');
}

function queue(tag: string, admin: AdminService) {
  return !!admin.status.templates.queue && hasPrefix(tag, 'queue');
}

function kanban(tag: string, admin: AdminService) {
  return !!admin.status.templates.kanban && hasPrefix(tag, 'kanban');
}

function blog(tag: string, admin: AdminService) {
  return !!admin.status.templates.blog && hasPrefix(tag, 'blog');
}
