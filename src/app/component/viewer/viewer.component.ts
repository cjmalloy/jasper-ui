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

  uis = this.admin.getPluginUi(this.currentTags);

  private _ref?: Ref;
  private _oembed?: Oembed;

  constructor(
    public admin: AdminService,
    private config: ConfigService,
    private embeds: EmbedService,
    private store: Store,
    private oembeds: OembedStore,
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
  }

  @ViewChild('iframe')
  set iframe(iframe: ElementRef) {
    if (iframe && this.currentTags.includes('plugin/embed')) {
      defer(() => {
        const width = this.embed.width || (this.config.mobile ? window.innerWidth : this.el.nativeElement.offsetWidth - 20);
        this.oembeds.get(this.embed.url || this.ref!.url, this.theme, width, this.embed.height || window.innerHeight)
          .subscribe(oembed => this.embeds.writeIframe(oembed, iframe.nativeElement));
      });
    } else {
      this._oembed = undefined;
    }
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

  get oembed() {
    if (!this.currentTags.includes('plugin/embed')) return undefined;
    return this._oembed;
  }

  private get theme() {
    return this.store.darkTheme ? 'dark' : undefined;
  }
}
