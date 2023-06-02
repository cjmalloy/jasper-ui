import { AfterViewInit, Component, EventEmitter, HostBinding, Input, Output, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { AdminService } from '../../service/admin.service';
import { emptyObject, writeObj } from '../../util/http';
import { addAllHierarchicalTags, includesTag } from '../../util/tag';
import { feedForm, FeedFormComponent } from './feed/feed.component';
import { originForm, OriginFormComponent, pullForm, pushForm } from './origin/origin.component';
import { active, Icon, ResponseAction, sortOrder, TagAction, Visibility, visible } from "../../model/tag";
import { getScheme } from "../../util/hosts";
import { Plugin } from "../../model/plugin";

@Component({
  selector: 'app-form-plugins',
  templateUrl: './plugins.component.html',
  styleUrls: ['./plugins.component.scss']
})
export class PluginsFormComponent implements AfterViewInit {
  @HostBinding('class') css = 'plugins-form';

  @Input()
  ref = '';
  @Input()
  fieldName = 'plugins';
  @Output()
  togglePlugin = new EventEmitter<string>();

  @ViewChild(FeedFormComponent)
  feed?: FeedFormComponent;
  @ViewChild(OriginFormComponent)
  origin?: OriginFormComponent;

  icons: Icon[] = [];
  forms: Plugin[] = [];

  private _group: UntypedFormGroup;
  private _tags: string[] = [];

  constructor(
    public admin: AdminService,
    private fb: UntypedFormBuilder,
  ) {
    this._group = fb.group({
      [this.fieldName]: pluginsForm(fb, admin, [])
    });
  }

  ngAfterViewInit(): void {
    this.updateForm();
  }

  get group(): UntypedFormGroup {
    return this._group;
  }

  @Input()
  set group(value: UntypedFormGroup) {
    this._group = value;
    this.updateForm();
  }

  get tags(): string[] {
    return this._tags;
  }

  @Input()
  set tags(tags: string[]) {
    this._tags = addAllHierarchicalTags(tags);
    this.updateForm();
  }

  get plugins() {
    return this._group.get(this.fieldName) as UntypedFormGroup;
  }

  get empty() {
    return !this.icons.length && !Object.keys(this.plugins.controls).length;
  }

  setValue(value: any) {
    this.plugins.patchValue(value);
    this.feed?.setValue(value)
    this.origin?.setValue(value)
  }

  updateForm() {
    if (this.plugins) {
      for (const p in this.plugins.value) {
        if (!this.tags.includes(p)) {
          this.plugins.removeControl(p);
        }
      }
    }
    if (!this.plugins) {
      this._group.addControl(this.fieldName, pluginsForm(this.fb, this.admin, this.tags));
    } else if (this.tags) {
      for (const t of this.tags) {
        if (!this.plugins.contains(t)) {
          const form = pluginForm(this.fb, this.admin, t);
          if (form) {
            this.plugins.addControl(t, form);
          }
        }
      }
    }
    this.forms = this.admin.getPluginForms(this.tags);
    this.icons = sortOrder(this.admin.getIcons(this.tags, this.plugins.value, getScheme(this.group.value.url))
      .filter(i => !this.forms.find(p => p.tag === i.tag)))
      .filter(i => this.showIcon(i));
  }

  visible(v: Visibility) {
    return visible(v, true, false);
  }

  active(a: TagAction | ResponseAction | Icon) {
    return active(this.group.value, a);
  }

  showIcon(i: Icon) {
    return this.visible(i) && this.active(i);
  }
}

export function pluginsForm(fb: UntypedFormBuilder, admin: AdminService, tags: string[]) {
  return fb.group(tags.reduce((plugins: any, tag: string) => {
    const form = pluginForm(fb, admin, tag);
    if (form) {
      plugins[tag] = form;
    }
    return plugins
  }, {}));
}

function pluginForm(fb: UntypedFormBuilder, admin: AdminService, tag: string) {
  switch (tag) {
    case '+plugin/origin': return originForm(fb, admin);
    case '+plugin/origin/push': return pushForm(fb, admin);
    case '+plugin/origin/pull': return pullForm(fb, admin);
    case '+plugin/feed': return feedForm(fb, admin);
  }
  if (admin.getPlugin(tag)?.config?.form || admin.getPlugin(tag)?.config?.advancedForm) {
    return fb.group({});
  }
  return null;
}

export function writePlugins(tags: string[], plugins: any): Record<string, any> | undefined {
  const result: Record<string, any> = {};
  for (const p in plugins) {
    if (includesTag(p, tags)) result[p] = writeObj(plugins[p]);
  }
  if (emptyObject(result)) return undefined;
  return result;
}
