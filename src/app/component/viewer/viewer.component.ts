import { Component, ElementRef, HostBinding, Inject, Input, ViewChild, ViewContainerRef } from '@angular/core';
import { defer, without } from 'lodash-es';
import { Oembed } from '../../model/oembed';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { ConfigService } from '../../service/config.service';
import { EmbedService } from '../../service/embed.service';
import { OembedStore } from '../../store/oembed';
import { Store } from '../../store/store';

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss']
})
export class ViewerComponent {
  @HostBinding('class') css = 'embed';

  @Input()
  text? = '';
  @Input()
  tags?: string[];

  image? : string;
  uis = this.admin.getPluginUi(this.currentTags);

  private _ref?: Ref;
  private _oembed?: Oembed;
  private _iframe!: ElementRef;

  constructor(
    public admin: AdminService,
    private config: ConfigService,
    private oembeds: OembedStore,
    private embeds: EmbedService,
    private store: Store,
    @Inject(ViewContainerRef) private viewContainerRef: ViewContainerRef,
    private el: ElementRef,
  ) { }

  get ref() {
    return this._ref;
  }

  @Input()
  set ref(value: Ref | undefined) {
    this._ref = value;
    this.uis = this.admin.getPluginUi(this.currentTags);
    if (this.currentTags.includes('plugin/embed')) {
      const width = this.embed.width || (this.config.mobile ? window.innerWidth : this.el.nativeElement.parentElement.offsetWidth - 20);
      this.oembeds.get(this.embed.url || value!.url, this.theme, width, this.embed.height || window.innerHeight)
        .subscribe(oembed => this.oembed = oembed);
    }
  }

  get iframe(): ElementRef {
    return this._iframe;
  }

  @ViewChild('iframe')
  set iframe(value: ElementRef) {
    this._iframe = value;
    this.oembed = this.oembed;
  }

  set oembed(oembed: Oembed | undefined) {
    if (!this._iframe) {
      defer(() => this.oembed = oembed);
    } else {
      this._oembed = oembed;
      if (oembed) {
        if (oembed.url && oembed.type === 'photo') {
          // Image embed
          this.tags = without(this.currentTags, "plugin/embed");
          this.image = oembed.url;
        } else {
          this.embeds.writeIframe(oembed, this._iframe.nativeElement);
        }
      } else {
        this.embeds.writeIframeHtml('', this._iframe.nativeElement);
      }
    }
  }

  get oembed() {
    return this._oembed;
  }

  get currentText() {
    return this.text || this.ref?.comment || '';
  }

  get currentTags() {
    return this.tags || this.ref?.tags || [];
  }

  get embed() {
    if (!this.currentTags.includes('plugin/embed')) return undefined;
    return this.ref?.plugins?.['plugin/embed'];
  }

  private get theme() {
    return this.store.darkTheme ? 'dark' : undefined;
  }
}
