import { AfterViewInit, Component, HostBinding, Input } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { emptyObject, writeObj } from '../../util/http';
import { archivePluginForm } from '../plugin/archive/archive.component';
import { audioPluginForm } from '../plugin/audio/audio.component';
import { commentPluginForm } from '../plugin/comment/comment.component';
import { embedPluginForm } from '../plugin/embed/embed.component';
import { imagePluginForm } from '../plugin/image/image.component';
import { pdfPluginForm } from '../plugin/pdf/pdf.component';
import { qrPluginForm } from '../plugin/qr/qr.component';
import { thumbnailPluginForm } from '../plugin/thumbnail/thumbnail.component';
import { videoPluginForm } from '../plugin/video/video.component';

@Component({
  selector: 'app-plugins',
  templateUrl: './plugins.component.html',
  styleUrls: ['./plugins.component.scss']
})
export class PluginsComponent implements AfterViewInit {

  @Input()
  ref = '';
  @Input()
  fieldName = 'plugins';

  private _group: FormGroup;
  private _tags: string[] = [];

  constructor(
    private fb: FormBuilder,
  ) {
    this._group = fb.group({
      [this.fieldName]: pluginsForm(fb, [])
    });
  }

  ngAfterViewInit(): void {
    this.updateForm();
  }

  get group(): FormGroup {
    return this._group;
  }

  @Input()
  set group(value: FormGroup) {
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
    return this._group.get(this.fieldName) as FormGroup;
  }

  get empty() {
    return !Object.keys(this.plugins.controls).length;
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

export function pluginsForm(fb: FormBuilder, tags: string[]) {
  return fb.group(tags.reduce((plugins: any, tag: string) => {
    const form = pluginForm(fb, tag)
    if (form) {
      plugins[tag] = form;
    }
    return plugins
  }, {}));
}

export function pluginForm(fb: FormBuilder, tag: string) {
  switch (tag) {
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
