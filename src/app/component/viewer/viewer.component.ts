import { Component, ElementRef, HostBinding, Inject, Input, ViewChild, ViewContainerRef } from '@angular/core';
import { defer } from 'lodash-es';
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

  @ViewChild('iframe')
  iframe!: ElementRef;

  uis = this.admin.getPluginUi(this.currentTags);

  private _ref?: Ref;

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

  set oembed(value: Oembed) {
    if (!this.iframe) defer(() => this.oembed = value);
    this.embeds.writeIframe(value, this.iframe.nativeElement);
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
