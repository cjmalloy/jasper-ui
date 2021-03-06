import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { EmbedService } from '../../../service/embed.service';
import { URI_REGEX } from '../../../util/format';

@Component({
  selector: 'app-form-thumbnail',
  templateUrl: './thumbnail.component.html',
  styleUrls: ['./thumbnail.component.scss']
})
export class ThumbnailFormComponent implements OnInit {

  @Input()
  plugins!: FormGroup;
  @Input()
  fieldName = 'plugin/thumbnail';
  @Input()
  ref = '';

  constructor(
    private embeds: EmbedService,
  ) {}

  ngOnInit(): void {
    if (!this.url.value) {
      this.embeds.getThumbnail(this.ref).subscribe(url => this.url.setValue(url));
    }
  }

  get plugin() {
    return this.plugins.get(this.fieldName) as FormGroup;
  }

  get url() {
    return this.plugin.get('url') as FormControl;
  }

  get width() {
    return this.plugin.get('width') as FormControl;
  }

  get height() {
    return this.plugin.get('height') as FormControl;
  }
}

export function thumbnailPluginForm(fb: FormBuilder) {
  return fb.group({
    url: fb.control('', [Validators.pattern(URI_REGEX)]),
    width: fb.control('', [Validators.min(1)]),
    height: fb.control('', [Validators.min(1)]),
  });
}

