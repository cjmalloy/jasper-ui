import { Component, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions } from '@ngx-formly/core';
import { defer } from 'lodash-es';
import { Ext } from '../../model/ext';
import { getMailbox } from '../../plugin/mailbox';
import { AdminService } from '../../service/admin.service';
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
  group!: UntypedFormGroup;
  @Input()
  showClear = false;
  @Output()
  clear = new EventEmitter<void>();

  @ViewChild('fill')
  fill?: ElementRef;

  form?: FormlyFieldConfig[];

  options: FormlyFormOptions = {
  };

  constructor(
    private fb: UntypedFormBuilder,
    private admin: AdminService,
  ) { }

  ngOnInit(): void {
  }

  get config() {
    return this.group.get('config') as UntypedFormGroup;
  }

  get modmail() {
    return getMailbox(this.group.value.tag);
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
    return Object.keys(this.themes?.value);
  }

  get userThemeValues() {
    return Object.keys(this.userThemes?.value);
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
    defer(() => this.group.patchValue(ext));
  }
}

export function extForm(fb: UntypedFormBuilder, ext: Ext, admin: AdminService) {
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
      filterTags: [false],
      tags: qtagsForm(fb, ext.config?.tags || []),
    };
  }
  return fb.group({
    tag: [''],
    name: [''],
    config: fb.group(configControls),
  });
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
