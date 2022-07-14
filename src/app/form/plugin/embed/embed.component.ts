import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { isTwitterEmbed, isYoutubeEmbed } from '../../../plugin/embed';
import { EmbedService } from '../../../service/embed.service';
import { URI_REGEX } from '../../../util/format';

@Component({
  selector: 'app-form-embed',
  templateUrl: './embed.component.html',
  styleUrls: ['./embed.component.scss']
})
export class EmbedFormComponent implements OnInit {

  @Input()
  plugins!: FormGroup;
  @Input()
  fieldName = 'plugin/embed';
  @Input()
  ref = '';

  constructor(
    private embeds: EmbedService,
  ) {}

  ngOnInit(): void {
    const embedUrl = this.embeds.fixUrl(this.ref);
    if (!this.url.value && this.ref !== embedUrl && embedUrl !== 'about:blank') {
      this.url.setValue(embedUrl);
    }
  }

  get youtube() {
    return isYoutubeEmbed(this.ref);
  }

  get twitter() {
    return isTwitterEmbed(this.ref);
  }

  get plugin() {
    return this.plugins.get(this.fieldName) as FormGroup;
  }

  get url() {
    return this.plugin.get('url') as FormControl;
  }
}

export function embedPluginForm(fb: FormBuilder) {
  return fb.group({
    url: fb.control('', [Validators.pattern(URI_REGEX)]),
    width: fb.control(560, [Validators.min(200)]),
    height: fb.control(315, [Validators.min(200)]),
  });
}

