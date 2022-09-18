import { AfterViewInit, Component, HostBinding, Input, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { AdminService } from '../../service/admin.service';
import { emptyObject, writeObj } from '../../util/http';
import { archivePluginForm } from './archive/archive.component';
import { audioPluginForm } from './audio/audio.component';
import { commentPluginForm } from './comment/comment.component';
import { embedPluginForm } from './embed/embed.component';
import { feedForm, FeedFormComponent } from './feed/feed.component';
import { imagePluginForm } from './image/image.component';
import { originForm } from './origin/origin.component';
import { pdfPluginForm } from './pdf/pdf.component';
import { qrPluginForm } from './qr/qr.component';
import { thumbnailPluginForm } from './thumbnail/thumbnail.component';
import { videoPluginForm } from './video/video.component';

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

  @ViewChild(FeedFormComponent)
  feed?: FeedFormComponent;

  private _group: UntypedFormGroup;
  private _tags: string[] = [];

  constructor(
    private admin: AdminService,
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
    this._tags = tags;
    this.updateForm();
  }

  get plugins() {
    return this._group.get(this.fieldName) as UntypedFormGroup;
  }

  get empty() {
    return !Object.keys(this.plugins.controls).length;
  }

  setValue(value: any) {
    if (this.feed) {
      this.feed.setValue(value['+plugin/feed']);
    }
    this.group.patchValue(value);
  }

  updateForm() {
    if (this.plugins) {
      for (const p in this.plugins.value) {
        if (!this._tags || !this._tags.includes(p)) {
          this.plugins.removeControl(p);
        }
      }
    }
    if (!this.plugins) {
      this._group.addControl(this.fieldName, pluginsForm(this.fb, this.admin, this._tags || []));
    } else if (this._tags) {
      for (const t of this._tags) {
        if (!this.plugins.contains(t)) {
          const form = pluginForm(this.fb, this.admin, t);
          if (form) {
            this.plugins.addControl(t, form);
          }
        }
      }
    }
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
    case '+plugin/feed': return feedForm(fb, admin);
    case 'plugin/thumbnail': return thumbnailPluginForm(fb, admin);
    case 'plugin/archive': return archivePluginForm(fb, admin);
    case 'plugin/pdf': return pdfPluginForm(fb, admin);
    case 'plugin/audio': return audioPluginForm(fb, admin);
    case 'plugin/video': return videoPluginForm(fb, admin);
    case 'plugin/image': return imagePluginForm(fb, admin);
    case 'plugin/embed': return embedPluginForm(fb, admin);
    case 'plugin/qr': return qrPluginForm(fb, admin);
    case 'plugin/comment': return commentPluginForm(fb, admin);
  }
  return null;
}

export function writePlugins(plugins: any): Record<string, any> | undefined {
  const result: Record<string, any> = {};
  for (const p in plugins) {
    result[p] = writeObj(plugins[p]);
  }
  if (emptyObject(result)) return undefined;
  return result;
}
