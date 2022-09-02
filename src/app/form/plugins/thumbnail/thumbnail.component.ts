import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { EmbedService } from '../../../service/embed.service';
import { URI_REGEX } from '../../../util/format';

@Component({
  selector: 'app-form-thumbnail',
  templateUrl: './thumbnail.component.html',
  styleUrls: ['./thumbnail.component.scss']
})
export class ThumbnailFormComponent implements OnInit {

  @Input()
  plugins!: UntypedFormGroup;
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
    return this.plugins.get(this.fieldName) as UntypedFormGroup;
  }

  get url() {
    return this.plugin.get('url') as UntypedFormControl;
  }
}

export function thumbnailPluginForm(fb: UntypedFormBuilder) {
  return fb.group({
    url: fb.control('', [Validators.pattern(URI_REGEX)]),
  });
}

