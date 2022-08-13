import { AfterViewInit, Component, HostBinding, Input, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { emptyObject, writeObj } from '../../util/http';
import { archivePluginForm } from '../plugin/archive/archive.component';
import { audioPluginForm } from '../plugin/audio/audio.component';
import { commentPluginForm } from '../plugin/comment/comment.component';
import { embedPluginForm } from '../plugin/embed/embed.component';
import { feedForm, FeedFormComponent } from '../plugin/feed/feed.component';
import { imagePluginForm } from '../plugin/image/image.component';
import { originForm } from '../plugin/origin/origin.component';
import { pdfPluginForm } from '../plugin/pdf/pdf.component';
import { qrPluginForm } from '../plugin/qr/qr.component';
import { thumbnailPluginForm } from '../plugin/thumbnail/thumbnail.component';
import { videoPluginForm } from '../plugin/video/video.component';

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
    private fb: UntypedFormBuilder,
  ) {
    this._group = fb.group({
      [this.fieldName]: pluginsForm(fb, [])
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
      this._group.addControl(this.fieldName, pluginsForm(this.fb, this._tags || []));
    } else if (this._tags) {
      for (const t of this._tags) {
        if (!this.plugins.contains(t)) {
          const form = pluginForm(this.fb, t);
          if (form) {
            this.plugins.addControl(t, form);
          }
        }
      }
    }
  }
}

export function pluginsForm(fb: UntypedFormBuilder, tags: string[]) {
  return fb.group(tags.reduce((plugins: any, tag: string) => {
    const form = pluginForm(fb, tag);
    if (form) {
      plugins[tag] = form;
    }
    return plugins
  }, {}));
}

export function pluginForm(fb: UntypedFormBuilder, tag: string) {
  switch (tag) {
    case '+plugin/origin': return originForm(fb);
    case '+plugin/feed': return feedForm(fb);
    case 'plugin/thumbnail': return thumbnailPluginForm(fb);
    case 'plugin/archive': return archivePluginForm(fb);
    case 'plugin/pdf': return pdfPluginForm(fb);
    case 'plugin/audio': return audioPluginForm(fb);
    case 'plugin/video': return videoPluginForm(fb);
    case 'plugin/image': return imagePluginForm(fb);
    case 'plugin/embed': return embedPluginForm(fb);
    case 'plugin/qr': return qrPluginForm(fb);
    case 'plugin/comment': return commentPluginForm(fb);
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
