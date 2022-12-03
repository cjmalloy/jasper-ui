import {
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding,
  Inject,
  Input,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { EmbedService } from '../../service/embed.service';

@Component({
  selector: 'app-embed',
  templateUrl: './embed.component.html',
  styleUrls: ['./embed.component.scss']
})
export class EmbedComponent implements AfterViewInit {
  @HostBinding('class') css = 'embed';

  @Input()
  ref!: Ref;
  @Input()
  expandPlugins: string[] = [];

  @ViewChild('iframe')
  iframe!: ElementRef;

  constructor(
    public admin: AdminService,
    private embeds: EmbedService,
    private refs: RefService,
    @Inject(ViewContainerRef) private viewContainerRef: ViewContainerRef,
  ) { }

  ngAfterViewInit(): void {
    if (this.iframe) {
      this.embeds.writeIframe(this.embed, this.iframe.nativeElement);
    }
  }

  get embed() {
    return this.ref.plugins?.['plugin/embed']?.url || this.ref?.url;
  }

  get uis() {
    return this.admin.getPluginUi(this.expandPlugins);
  }

  cssUrl(url: string) {
    return `url("${url}")`;
  }
}
