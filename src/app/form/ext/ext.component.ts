import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions } from '@ngx-formly/core';
import * as _ from 'lodash-es';
import { Ext } from '../../model/ext';
import { AdminService } from '../../service/admin.service';
import { hasPrefix } from '../../util/tag';
import { linksForm } from '../links/links.component';
import { qtagsForm } from '../qtags/qtags.component';
import { queriesForm } from '../queries/queries.component';
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

  form?: FormlyFieldConfig[];

  options: FormlyFormOptions = {
  };

  constructor(
    private fb: UntypedFormBuilder,
    private admin: AdminService,
  ) { }

  ngOnInit(): void {
  }

  get root() {
    return root(this.group.value.tag, this.admin);
  }

  get user() {
    return user(this.group.value.tag, this.admin);
  }

  get queue() {
    return queue(this.group.value.tag, this.admin);
  }

  get kanban() {
    return kanban(this.group.value.tag, this.admin);
  }

  get blog() {
    return blog(this.group.value.tag, this.admin);
  }

  get config() {
    return this.group.get('config') as UntypedFormGroup;
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

  get userTheme() {
    return this.config.get('userTheme') as UntypedFormControl;
  }

  setValue(ext: Ext) {
    if (!this.form) {
      this.form = this.admin.getTemplateForm(ext.tag);
    }
    _.defer(() => this.group.patchValue(ext));
  }
}

export function extForm(fb: UntypedFormBuilder, ext: Ext, admin: AdminService) {
  let configControls = {};
  if (root(ext.tag, admin)) {
    configControls = {
      ...configControls,
      sidebar: [''],
      pinned: linksForm(fb, ext.config?.pinned || []),
      themes: themesForm(fb, ext.config?.themes || []),
      theme: [''],
    };
  }
  if (user(ext.tag, admin)) {
    configControls = {
      ...configControls,
      subscriptions: queriesForm(fb, ext.config?.subscriptions),
      bookmarks: queriesForm(fb, ext.config?.bookmarks),
      userThemes: themesForm(fb, ext.config?.userThemes),
      userTheme: [''],
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
  return !!admin.status.templates.user && (
    tag.startsWith('_user/') ||
    tag.startsWith('+user/'));
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
